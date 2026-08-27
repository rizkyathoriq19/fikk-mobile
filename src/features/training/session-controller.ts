import {
  decodeMessage,
  DEVICE_STATES,
  encodeMessage,
  MESSAGE_TYPES,
  type ProtocolMessage,
} from '../../protocol/codec';
import { ACK_STATUS, COMPLETION_REASONS } from '../../protocol/constants';
import type { ConnectionSnapshot } from '../bluetooth/connection-controller';

export const MVP_TARGET_COUNT = 6 as const;

export type TrainingState = 'idle' | 'starting' | 'active' | 'completed' | 'error';

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
  deviceName: string | null;
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
  subscribeMessages(listener: (message: ProtocolMessage) => void): () => void;
}

type TrainingSessionControllerOptions = {
  connection: TrainingConnection;
  sessionIdFactory?: () => number;
  clock?: () => string;
  startAckTimeoutMs?: number;
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
  deviceName: null,
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
  private readonly unsubscribeFromMessages: () => void;
  private pendingStart: PendingStart | null = null;
  private highestSequence = 0;

  constructor(private readonly options: TrainingSessionControllerOptions) {
    this.sessionIdFactory = options.sessionIdFactory ?? createSessionId;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.startAckTimeoutMs = options.startAckTimeoutMs ?? 3000;
    this.unsubscribeFromMessages = options.connection.subscribeMessages((message) => this.handleMessage(message));
  }

  get snapshot(): TrainingSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: TrainingSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
      deviceName: this.options.connection.snapshot.connectedDevice?.name ?? null,
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
    this.unsubscribeFromMessages();
    this.listeners.clear();
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

    const sessionId = this.currentSnapshot.sessionId;
    if (sessionId === null || message.sessionId !== sessionId || !this.isNewSequence(message.sequence)) {
      return;
    }

    if (message.messageType === MESSAGE_TYPES.PROGRESS && this.currentSnapshot.state === 'active') {
      if (!isValidProgress(message.payload.count, message.payload.elapsedMs, this.currentSnapshot)) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({ count: message.payload.count, elapsedMs: message.payload.elapsedMs });
      return;
    }

    if (message.messageType === MESSAGE_TYPES.COMPLETE && this.currentSnapshot.state === 'active') {
      if (
        !isValidProgress(message.payload.count, message.payload.durationMs, this.currentSnapshot) ||
        !isCompletionReason(message.payload.reason)
      ) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({
        state: 'completed',
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
      return;
    }

    if (message.messageType === MESSAGE_TYPES.STATE && this.currentSnapshot.state === 'active') {
      if (
        message.payload.state !== DEVICE_STATES.ACTIVE ||
        !isValidProgress(message.payload.count, message.payload.elapsedMs, this.currentSnapshot)
      ) {
        return;
      }
      this.highestSequence = message.sequence;
      this.update({ count: message.payload.count, elapsedMs: message.payload.elapsedMs });
      return;
    }

    if (message.messageType === MESSAGE_TYPES.ERROR) {
      this.highestSequence = message.sequence;
      this.fail(new Error(`Device error 0x${message.payload.errorCode.toString(16)}`));
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
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
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

function createSessionId(): number {
  const sessionId = Math.floor(Math.random() * 0x100000000);
  return sessionId === 0 ? 1 : sessionId;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
