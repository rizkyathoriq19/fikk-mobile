import {
  decodeMessage,
  DEVICE_STATES,
  encodeMessage,
  MESSAGE_TYPES,
  type ProtocolMessage,
} from '../../protocol/codec';
import { ACK_STATUS, COMPLETION_REASONS } from '../../protocol/constants';
import type { TrainingSession, TrainingSessionRepository } from '../history/session-repository';
import type { PersistedTrainingSession, TrainingSessionStore } from './session-store';
import type { ConnectionSnapshot } from '../bluetooth/connection-controller';

export const MVP_TARGET_COUNT = 6 as const;

export type TrainingState = 'idle' | 'starting' | 'recovering' | 'active' | 'completed' | 'error';

export type TrainingResult = {
  count: number;
  durationMs: number;
  reason: number;
  sequence: number;
};

export type TrainingSnapshot = {
  state: TrainingState;
  sessionId: number | null;
  notes: string;
  deviceKey: string | null;
  deviceName: string | null;
  localId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  targetCount: typeof MVP_TARGET_COUNT;
  count: number;
  elapsedMs: number;
  result: TrainingResult | null;
  error: string | null;
};

export interface TrainingConnection {
  readonly snapshot: ConnectionSnapshot;
  writeControl(value: Uint8Array): Promise<void>;
  read(channel: 'STATE'): Promise<Uint8Array>;
  reconnectLastDevice(): Promise<void>;
  sync(sessionId: number): Promise<void>;
  subscribe(listener: (snapshot: ConnectionSnapshot) => void): () => void;
  subscribeMessages(listener: (message: ProtocolMessage) => void): () => void;
}

type TrainingSessionControllerOptions = {
  connection: TrainingConnection;
  repository?: TrainingSessionRepository;
  sessionStore?: TrainingSessionStore;
  sessionIdFactory?: () => number;
  clock?: () => string;
  startAckTimeoutMs?: number;
  recoveryResponseTimeoutMs?: number;
};

type TrainingSnapshotPatch = Partial<TrainingSnapshot>;
type TrainingSnapshotListener = (snapshot: TrainingSnapshot) => void;
type StateMessage = Extract<ProtocolMessage, { messageType: typeof MESSAGE_TYPES.STATE }>;

type PendingStart = {
  sessionId: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type PendingRecovery = {
  sessionId: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

class StartTimeoutError extends Error {
  constructor() {
    super('START acknowledgement timed out after 3 seconds');
    this.name = 'StartTimeoutError';
  }
}

const initialSnapshot: TrainingSnapshot = {
  state: 'idle',
  sessionId: null,
  notes: '',
  deviceKey: null,
  deviceName: null,
  localId: null,
  startedAt: null,
  completedAt: null,
  targetCount: MVP_TARGET_COUNT,
  count: 0,
  elapsedMs: 0,
  result: null,
  error: null,
};

export class TrainingSessionController {
  private currentSnapshot: TrainingSnapshot = initialSnapshot;
  private readonly listeners = new Set<TrainingSnapshotListener>();
  private readonly sessionIdFactory: () => number;
  private readonly clock: () => string;
  private readonly startAckTimeoutMs: number;
  private readonly recoveryResponseTimeoutMs: number;
  private readonly unsubscribeFromConnection: () => void;
  private readonly unsubscribeFromMessages: () => void;
  private pendingStart: PendingStart | null = null;
  private pendingRecovery: PendingRecovery | null = null;
  private resultAction: Promise<TrainingSession> | null = null;
  private recoveryAction: Promise<void> | null = null;
  private completedRecoveryAction: Promise<void> | null = null;
  private persistenceChain: Promise<void> = Promise.resolve();
  private highestSequence = 0;

  constructor(private readonly options: TrainingSessionControllerOptions) {
    this.sessionIdFactory = options.sessionIdFactory ?? createSessionId;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.startAckTimeoutMs = options.startAckTimeoutMs ?? 3000;
    this.recoveryResponseTimeoutMs = options.recoveryResponseTimeoutMs ?? 3000;
    this.unsubscribeFromConnection = options.connection.subscribe((snapshot) => {
      this.handleConnectionSnapshot(snapshot);
    });
    this.unsubscribeFromMessages = options.connection.subscribeMessages((message) => this.handleMessage(message));
  }

  get snapshot(): TrainingSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: TrainingSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async saveResult(): Promise<TrainingSession> {
    if (this.resultAction !== null) {
      return this.resultAction;
    }
    const action = this.persistResult();
    this.resultAction = action;
    try {
      return await action;
    } finally {
      if (this.resultAction === action) {
        this.resultAction = null;
      }
    }
  }

  async discardResult(): Promise<void> {
    const { session, resultSequence } = this.completedResult();
    await this.sendResultAcknowledgement(session.bleSessionId, resultSequence);
    this.resetToIdle();
  }

  listSessions(): Promise<TrainingSession[]> {
    return this.requireRepository().list();
  }

  getSession(id: string): Promise<TrainingSession | null> {
    return this.requireRepository().get(id);
  }

  async restore(): Promise<void> {
    const sessionStore = this.options.sessionStore;
    if (sessionStore === undefined) {
      return;
    }
    let persisted: PersistedTrainingSession | null;
    try {
      persisted = await sessionStore.load();
    } catch (error) {
      this.currentSnapshot = {
        ...this.currentSnapshot,
        state: 'error',
        error: `Unable to restore the training session: ${toError(error).message}`,
      };
      this.notify();
      return;
    }
    if (persisted === null) {
      return;
    }

    this.highestSequence = persisted.highestSequence;
    this.currentSnapshot = {
      ...initialSnapshot,
      state: persisted.state,
      sessionId: persisted.sessionId,
      notes: persisted.notes,
      deviceKey: persisted.deviceKey,
      deviceName: persisted.deviceName,
      localId: persisted.localId,
      startedAt: persisted.startedAt,
      completedAt: persisted.completedAt,
      targetCount: MVP_TARGET_COUNT,
      count: persisted.count,
      elapsedMs: persisted.elapsedMs,
      result: persisted.result,
      error: null,
    };

    if (persisted.state === 'completed' && persisted.result !== null) {
      this.notify();
      this.beginCompletedRecovery();
      return;
    }

    this.update({ state: 'recovering', error: 'Restoring the device-owned session…' });
    this.beginRecovery();
  }

  async start(notes: string): Promise<void> {
    const normalizedNotes = normalizeNotes(notes);
    if (this.currentSnapshot.state === 'starting' || this.currentSnapshot.state === 'active') {
      throw new Error('a training session is already starting or active');
    }
    if (!this.isConnectionReady()) {
      const error = new Error('Bluetooth device is not Ready');
      this.update({ state: 'error', error: error.message });
      throw error;
    }

    const sessionId = this.sessionIdFactory();
    if (!isValidSessionId(sessionId)) {
      const error = new Error('session ID must be a non-zero uint32');
      this.update({ state: 'error', error: error.message });
      throw error;
    }

    this.highestSequence = 0;
    this.update({
      state: 'starting',
      sessionId,
      notes: normalizedNotes,
      deviceKey: this.options.connection.snapshot.connectedDevice?.id ?? null,
      deviceName: this.options.connection.snapshot.connectedDevice?.name ?? null,
      localId: createLocalId(),
      startedAt: null,
      completedAt: null,
      targetCount: MVP_TARGET_COUNT,
      count: 0,
      elapsedMs: 0,
      result: null,
      error: null,
    });

    const packet = encodeMessage({
      version: 1,
      messageType: MESSAGE_TYPES.START,
      sessionId,
      sequence: 0,
      payload: { targetCount: MVP_TARGET_COUNT },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.writeAndWaitForStartAck(packet, sessionId);
        await this.persistenceChain;
        return;
      } catch (error) {
        if (!(error instanceof StartTimeoutError) || attempt === 1) {
          this.fail(error);
          throw error;
        }

        let state: StateMessage;
        try {
          state = await this.readStateForRetry();
        } catch (stateError) {
          this.fail(stateError);
          throw stateError;
        }

        if (state.sessionId !== sessionId) {
          continue;
        }
        if (state.payload.state === DEVICE_STATES.ACTIVE) {
          this.acceptActiveState(state);
          await this.persistenceChain;
          return;
        }
        if (state.payload.state === DEVICE_STATES.COMPLETED) {
          const completedError = new Error('device completed the session before START was acknowledged');
          this.fail(completedError);
          throw completedError;
        }
      }
    }
  }

  dispose(): void {
    this.clearPendingStart();
    this.clearPendingRecovery();
    this.unsubscribeFromConnection();
    this.unsubscribeFromMessages();
    this.listeners.clear();
  }

  private handleConnectionSnapshot(snapshot: ConnectionSnapshot): void {
    const liveSession = this.currentSnapshot.state === 'starting' || this.currentSnapshot.state === 'active';
    const disconnected = snapshot.status !== 'ready' || snapshot.connectedDevice === null;

    if (liveSession && disconnected) {
      this.update({
        state: 'recovering',
        error: 'Device disconnected — session may still be running on the device.',
      });
      this.beginRecovery();
      return;
    }

    if (this.currentSnapshot.state === 'recovering' && !disconnected) {
      this.beginRecovery();
    }
  }

  private beginRecovery(): void {
    if (this.recoveryAction !== null || this.currentSnapshot.sessionId === null) {
      return;
    }
    const action = Promise.resolve().then(() => this.recover());
    this.recoveryAction = action;
    void action.finally(() => {
      if (this.recoveryAction === action) {
        this.recoveryAction = null;
      }
    });
  }

  private beginCompletedRecovery(): void {
    if (this.completedRecoveryAction !== null || this.currentSnapshot.sessionId === null) {
      return;
    }
    const action = Promise.resolve().then(() => this.reconnectCompletedResult());
    this.completedRecoveryAction = action;
    void action.finally(() => {
      if (this.completedRecoveryAction === action) {
        this.completedRecoveryAction = null;
      }
    });
  }

  private async reconnectCompletedResult(): Promise<void> {
    const sessionId = this.currentSnapshot.sessionId;
    if (sessionId === null) {
      return;
    }

    try {
      await this.options.connection.reconnectLastDevice();
      if (
        this.options.connection.snapshot.status !== 'ready' ||
        this.options.connection.snapshot.connectedDevice === null
      ) {
        throw new Error('Unable to reconnect to the training device');
      }
      await this.options.connection.sync(sessionId);
    } catch (error) {
      this.update({ error: `Completed result recovery failed: ${toError(error).message}` });
    }
  }

  private async recover(): Promise<void> {
    const sessionId = this.currentSnapshot.sessionId;
    if (sessionId === null) {
      return;
    }

    try {
      await this.options.connection.reconnectLastDevice();
      if (
        this.options.connection.snapshot.status !== 'ready' ||
        this.options.connection.snapshot.connectedDevice === null
      ) {
        throw new Error('Unable to reconnect to the training device');
      }

      const response = this.waitForRecoveryResponse(sessionId);
      await this.options.connection.sync(sessionId);
      await response;
    } catch (error) {
      this.clearPendingRecovery();
      this.fail(new Error(`Session recovery failed: ${toError(error).message}`));
    }
  }

  private waitForRecoveryResponse(sessionId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRecovery?.sessionId === sessionId) {
          this.pendingRecovery = null;
        }
        reject(new Error('Timed out waiting for the device recovery state'));
      }, this.recoveryResponseTimeoutMs);
      this.pendingRecovery = { sessionId, resolve, reject, timeoutId };
    });
  }

  private clearPendingRecovery(): void {
    if (this.pendingRecovery === null) {
      return;
    }
    clearTimeout(this.pendingRecovery.timeoutId);
    this.pendingRecovery = null;
  }

  private resolveRecovery(): void {
    const pendingRecovery = this.pendingRecovery;
    if (pendingRecovery === null) {
      return;
    }
    this.clearPendingRecovery();
    pendingRecovery.resolve();
  }

  private rejectRecovery(error: Error): void {
    const pendingRecovery = this.pendingRecovery;
    if (pendingRecovery === null) {
      return;
    }
    this.clearPendingRecovery();
    pendingRecovery.reject(error);
  }

  private async persistResult(): Promise<TrainingSession> {
    const { session, resultSequence } = this.completedResult();
    await this.requireRepository().upsert(session);
    await this.sendResultAcknowledgement(session.bleSessionId, resultSequence);
    this.resetToIdle();
    return session;
  }

  private completedResult(): { session: TrainingSession; resultSequence: number } {
    const result = this.currentSnapshot.result;
    if (
      this.currentSnapshot.state !== 'completed' ||
      this.currentSnapshot.sessionId === null ||
      this.currentSnapshot.deviceKey === null ||
      this.currentSnapshot.localId === null ||
      this.currentSnapshot.startedAt === null ||
      this.currentSnapshot.completedAt === null ||
      result === null
    ) {
      throw new Error('a completed training result is required');
    }

    return {
      session: {
        id: this.currentSnapshot.localId,
        bleSessionId: this.currentSnapshot.sessionId,
        notes: this.currentSnapshot.notes || null,
        targetCount: this.currentSnapshot.targetCount,
        finalCount: result.count,
        durationMs: result.durationMs,
        startedAt: this.currentSnapshot.startedAt,
        completedAt: this.currentSnapshot.completedAt,
        deviceKey: this.currentSnapshot.deviceKey,
        deviceName: this.currentSnapshot.deviceName,
        status: 'completed',
        protocolVersion: 1,
      },
      resultSequence: result.sequence,
    };
  }

  private async sendResultAcknowledgement(sessionId: number, resultSequence: number): Promise<void> {
    await this.options.connection.writeControl(
      encodeMessage({
        version: 1,
        messageType: MESSAGE_TYPES.ACK_RESULT,
        sessionId,
        sequence: 0,
        payload: { resultSequence },
      }),
    );
  }

  private requireRepository(): TrainingSessionRepository {
    if (this.options.repository === undefined) {
      throw new Error('a training session repository is required');
    }
    return this.options.repository;
  }

  private resetToIdle(): void {
    this.update({ ...initialSnapshot });
  }

  private async writeAndWaitForStartAck(packet: Uint8Array, sessionId: number): Promise<void> {
    const acknowledgement = this.waitForStartAck(sessionId);
    try {
      await this.options.connection.writeControl(packet);
      await acknowledgement;
    } catch (error) {
      this.clearPendingStart(sessionId);
      throw toError(error);
    }
  }

  private waitForStartAck(sessionId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingStart?.sessionId === sessionId) {
          this.pendingStart = null;
        }
        reject(new StartTimeoutError());
      }, this.startAckTimeoutMs);
      this.pendingStart = { sessionId, resolve, reject, timeoutId };
    });
  }

  private handleMessage(message: ProtocolMessage): void {
    const pendingStart = this.pendingStart;
    if (
      message.messageType === MESSAGE_TYPES.ACK &&
      pendingStart !== null &&
      message.sessionId === pendingStart.sessionId &&
      message.payload.command === MESSAGE_TYPES.START
    ) {
      this.clearPendingStart();
      if (message.payload.status === ACK_STATUS.ACCEPTED) {
        this.highestSequence = message.sequence;
        this.update({ state: 'active', startedAt: this.clock(), error: null });
        pendingStart.resolve();
      } else {
        pendingStart.reject(new Error(`START rejected with status ${message.payload.status}`));
      }
      return;
    }

    if (
      message.messageType === MESSAGE_TYPES.ERROR &&
      pendingStart !== null &&
      message.sessionId === pendingStart.sessionId
    ) {
      const error = new Error(`Device error 0x${message.payload.errorCode.toString(16)}`);
      this.clearPendingStart();
      pendingStart.reject(error);
      this.fail(error);
      return;
    }

    if (
      this.currentSnapshot.state === 'recovering' &&
      message.messageType === MESSAGE_TYPES.STATE &&
      message.payload.state === DEVICE_STATES.READY
    ) {
      const error = new Error('Device no longer retains this session; start a new session.');
      this.rejectRecovery(error);
      this.fail(error);
      return;
    }

    const sessionId = this.currentSnapshot.sessionId;
    if (sessionId === null || message.sessionId !== sessionId || !this.isNewSequence(message.sequence)) {
      return;
    }

    if (message.messageType === MESSAGE_TYPES.PROGRESS) {
      if (
        this.currentSnapshot.state !== 'active' ||
        !isValidProgress(message.payload.count, message.payload.elapsedMs, this.currentSnapshot)
      ) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({ count: message.payload.count, elapsedMs: message.payload.elapsedMs });
      return;
    }

    if (
      message.messageType === MESSAGE_TYPES.COMPLETE &&
      (this.currentSnapshot.state === 'active' || this.currentSnapshot.state === 'recovering')
    ) {
      if (
        !isValidProgress(message.payload.count, message.payload.durationMs, this.currentSnapshot) ||
        !isCompletionReason(message.payload.reason)
      ) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({
        state: 'completed',
        startedAt: this.currentSnapshot.startedAt ?? this.clock(),
        count: message.payload.count,
        elapsedMs: message.payload.durationMs,
        completedAt: this.clock(),
        result: {
          count: message.payload.count,
          durationMs: message.payload.durationMs,
          reason: message.payload.reason,
          sequence: message.sequence,
        },
        error: null,
      });
      this.resolveRecovery();
      return;
    }

    if (message.messageType === MESSAGE_TYPES.STATE) {
      if (
        message.payload.state !== DEVICE_STATES.ACTIVE ||
        !isValidProgress(message.payload.count, message.payload.elapsedMs, this.currentSnapshot)
      ) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({
        state: 'active',
        startedAt: this.currentSnapshot.startedAt ?? this.clock(),
        count: message.payload.count,
        elapsedMs: message.payload.elapsedMs,
        error: null,
      });
      this.resolveRecovery();
      return;
    }

    if (message.messageType === MESSAGE_TYPES.ERROR) {
      this.highestSequence = message.sequence;
      const error = new Error(`Device error 0x${message.payload.errorCode.toString(16)}`);
      this.rejectRecovery(error);
      this.fail(error);
    }
  }

  private async readStateForRetry(): Promise<StateMessage> {
    const message = decodeMessage(await this.options.connection.read('STATE'));
    if (message.messageType !== MESSAGE_TYPES.STATE) {
      throw new Error('STATE characteristic returned a non-STATE message');
    }
    return message;
  }

  private acceptActiveState(state: StateMessage): void {
    this.highestSequence = state.sequence;
    this.update({
      state: 'active',
      startedAt: this.currentSnapshot.startedAt ?? this.clock(),
      count: state.payload.count,
      elapsedMs: state.payload.elapsedMs,
      error: null,
    });
  }

  private isConnectionReady(): boolean {
    return (
      this.options.connection.snapshot.status === 'ready' &&
      this.options.connection.snapshot.connectedDevice !== null &&
      this.options.connection.snapshot.deviceState?.state === DEVICE_STATES.READY
    );
  }

  private isNewSequence(sequence: number): boolean {
    return sequence > this.highestSequence;
  }

  private clearPendingStart(sessionId?: number): void {
    if (this.pendingStart === null || (sessionId !== undefined && this.pendingStart.sessionId !== sessionId)) {
      return;
    }
    clearTimeout(this.pendingStart.timeoutId);
    this.pendingStart = null;
  }

  private fail(error: unknown): void {
    this.update({ state: 'error', error: toError(error).message });
  }

  private update(patch: TrainingSnapshotPatch): void {
    this.currentSnapshot = { ...this.currentSnapshot, ...patch };
    this.queuePersistence();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }

  private queuePersistence(): void {
    const sessionStore = this.options.sessionStore;
    if (sessionStore === undefined) {
      return;
    }
    const snapshot = this.currentSnapshot;
    const highestSequence = this.highestSequence;
    this.persistenceChain = this.persistenceChain
      .then(async () => {
        const persisted = toPersistedSession(snapshot, highestSequence);
        if (persisted === null) {
          await sessionStore.clear();
        } else {
          await sessionStore.save(persisted);
        }
      })
      .catch(() => undefined);
  }
}

function isValidProgress(count: number, elapsedMs: number, snapshot: TrainingSnapshot): boolean {
  return (
    count >= snapshot.count &&
    count <= snapshot.targetCount &&
    elapsedMs >= snapshot.elapsedMs
  );
}

function isCompletionReason(reason: number): boolean {
  return (Object.values(COMPLETION_REASONS) as number[]).includes(reason);
}

function normalizeNotes(notes: string): string {
  const normalized = notes.trim();
  if (normalized.length > 500) {
    throw new Error('training notes must be 500 characters or fewer');
  }
  return normalized;
}

function isValidSessionId(sessionId: number): boolean {
  return Number.isInteger(sessionId) && sessionId > 0 && sessionId <= 0xffffffff;
}

function toPersistedSession(snapshot: TrainingSnapshot, highestSequence: number): PersistedTrainingSession | null {
  if (
    snapshot.state === 'idle' ||
    snapshot.sessionId === null ||
    snapshot.deviceKey === null ||
    snapshot.localId === null
  ) {
    return null;
  }

  const state: PersistedTrainingSession['state'] =
    snapshot.state === 'completed'
      ? 'completed'
      : snapshot.state === 'active'
        ? 'active'
        : snapshot.state === 'starting'
          ? 'starting'
          : 'recovering';

  return {
    state,
    sessionId: snapshot.sessionId,
    notes: snapshot.notes,
    deviceKey: snapshot.deviceKey,
    deviceName: snapshot.deviceName,
    localId: snapshot.localId,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    targetCount: snapshot.targetCount,
    count: snapshot.count,
    elapsedMs: snapshot.elapsedMs,
    result: snapshot.result,
    highestSequence,
  };
}

function createSessionId(): number {
  const sessionId = Math.floor(Math.random() * 0x100000000);
  return sessionId === 0 ? 1 : sessionId;
}

function createLocalId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
