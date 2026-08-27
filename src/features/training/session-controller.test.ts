import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeMessage,
  DEVICE_STATES,
  MESSAGE_TYPES,
  type ProtocolMessage,
  encodeMessage,
} from '../../protocol/codec';
import { ACK_STATUS, COMPLETION_REASONS } from '../../protocol/constants';
import { FIKK_BLE_PROFILE } from '../../ble/fikk-profile';
import type { BleAdapterState, BleDevice } from '../../ble/transport';
import type { ConnectionSnapshot } from '../bluetooth/connection-controller';
import type { TrainingSession, TrainingSessionRepository } from '../history/session-repository';
import type { PersistedTrainingSession, TrainingSessionStore } from './session-store';
import {
  TrainingSessionController,
  type TrainingConnection,
} from './session-controller';

const device: BleDevice = {
  id: 'device-1',
  name: 'Fikk-ESP32',
  rssi: -42,
  serviceUuids: [FIKK_BLE_PROFILE.serviceUuid],
};

class FakeTrainingConnection implements TrainingConnection {
  snapshot: ConnectionSnapshot = {
    status: 'ready' as const,
    adapterState: 'on' as BleAdapterState,
    devices: [device] as readonly BleDevice[],
    connectedDevice: device as BleDevice | null,
    deviceInfo: 'firmware=0.1.0',
    deviceState: { state: DEVICE_STATES.READY as 0 | 1 | 2 | 3, count: 0, elapsedMs: 0 },
    lastDeviceId: device.id as string | null,
    error: null as string | null,
  };
  readonly writes: Uint8Array[] = [];
  readonly recoveryCalls: string[] = [];
  private readonly listeners = new Set<(message: ProtocolMessage) => void>();
  private readonly snapshotListeners = new Set<(snapshot: TrainingConnection['snapshot']) => void>();
  private stateBytes = encodeMessage({
    version: 1,
    messageType: MESSAGE_TYPES.STATE,
    sessionId: 0,
    sequence: 1,
    payload: { state: DEVICE_STATES.READY, count: 0, elapsedMs: 0 },
  });
  onWrite: ((value: Uint8Array) => void) | null = null;
  onReconnect: (() => Promise<void> | void) | null = null;
  onSync: ((sessionId: number) => Promise<void> | void) | null = null;

  async writeControl(value: Uint8Array): Promise<void> {
    this.writes.push(new Uint8Array(value));
    this.onWrite?.(value);
  }

  async reconnectLastDevice(): Promise<void> {
    this.recoveryCalls.push('reconnect');
    await this.onReconnect?.();
  }

  async sync(sessionId: number): Promise<void> {
    this.recoveryCalls.push(`sync:${sessionId}`);
    await this.onSync?.(sessionId);
  }

  subscribe(listener: (snapshot: TrainingConnection['snapshot']) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  setConnectionSnapshot(patch: Partial<TrainingConnection['snapshot']>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.snapshotListeners) {
      listener(this.snapshot);
    }
  }

  async read(): Promise<Uint8Array> {
    return new Uint8Array(this.stateBytes);
  }

  subscribeMessages(listener: (message: ProtocolMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: ProtocolMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  setState(message: ProtocolMessage): void {
    this.stateBytes = encodeMessage(message);
  }
}

class MemoryTrainingSessionRepository implements TrainingSessionRepository {
  readonly sessions = new Map<string, TrainingSession>();
  saveCalls = 0;
  onSave: (() => void) | null = null;

  async upsert(session: TrainingSession): Promise<void> {
    this.saveCalls += 1;
    this.onSave?.();
    this.sessions.set(`${session.deviceKey}:${session.bleSessionId}`, { ...session });
  }

  async list(): Promise<TrainingSession[]> {
    return [...this.sessions.values()].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  async get(id: string): Promise<TrainingSession | null> {
    return [...this.sessions.values()].find((session) => session.id === id) ?? null;
  }
}

class MemoryTrainingSessionStore implements TrainingSessionStore {
  session: PersistedTrainingSession | null = null;

  async load(): Promise<PersistedTrainingSession | null> {
    return this.session === null
      ? null
      : { ...this.session, result: this.session.result === null ? null : { ...this.session.result } };
  }

  async save(session: PersistedTrainingSession): Promise<void> {
    this.session = { ...session, result: session.result === null ? null : { ...session.result } };
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

function acceptedStart(sessionId: number): ProtocolMessage {
  return {
    version: 1,
    messageType: MESSAGE_TYPES.ACK,
    sessionId,
    sequence: 1,
    payload: { command: MESSAGE_TYPES.START, status: ACK_STATUS.ACCEPTED },
  };
}

function complete(sessionId: number, sequence: number, count: number, durationMs: number): ProtocolMessage {
  return {
    version: 1,
    messageType: MESSAGE_TYPES.COMPLETE,
    sessionId,
    sequence,
    payload: { count, durationMs, reason: COMPLETION_REASONS.TARGET_REACHED },
  };
}

test('start trims notes, encodes START, and enters Active only after accepted ACK', async () => {
  const connection = new FakeTrainingConnection();
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 0x01020304,
    startAckTimeoutMs: 50,
  });

  const start = controller.start('  morning session  ');
  await Promise.resolve();
  assert.equal(controller.snapshot.state, 'starting');
  assert.equal(connection.writes.length, 1);
  assert.deepEqual([...connection.writes[0]], [1, 1, 4, 3, 2, 1, 0, 0, 6]);

  connection.emit(acceptedStart(0x01020304));
  await start;

  assert.equal(controller.snapshot.state, 'active');
  assert.equal(controller.snapshot.sessionId, 0x01020304);
  assert.equal(controller.snapshot.notes, 'morning session');
  assert.equal(controller.snapshot.targetCount, 6);
});

test('progress is accepted for the active session and duplicate starts are blocked', async () => {
  const connection = new FakeTrainingConnection();
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 7,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('notes');
  await Promise.resolve();
  connection.emit(acceptedStart(7));
  await start;

  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 7,
    sequence: 2,
    payload: { count: 2, elapsedMs: 900 },
  });

  assert.deepEqual(
    {
      state: controller.snapshot.state,
      count: controller.snapshot.count,
      elapsedMs: controller.snapshot.elapsedMs,
    },
    { state: 'active', count: 2, elapsedMs: 900 },
  );
  await assert.rejects(() => controller.start('again'), /already starting or active/i);
  assert.equal(connection.writes.length, 1);
});

test('start rejects notes over 500 characters and non-ready devices', async () => {
  const connection = new FakeTrainingConnection();
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 1,
    startAckTimeoutMs: 50,
  });

  await assert.rejects(() => controller.start('x'.repeat(501)), /500 characters/i);
  connection.snapshot.deviceState = { state: DEVICE_STATES.ACTIVE, count: 1, elapsedMs: 100 };
  await assert.rejects(() => controller.start('notes'), /not Ready/i);
  assert.equal(controller.snapshot.state, 'error');
  assert.equal(connection.writes.length, 0);
});

test('START timeout reads state and does not blindly retry an already active session', async () => {
  const connection = new FakeTrainingConnection();
  const sessionId = 99;
  connection.setState({
    version: 1,
    messageType: MESSAGE_TYPES.STATE,
    sessionId,
    sequence: 3,
    payload: { state: DEVICE_STATES.ACTIVE, count: 2, elapsedMs: 900 },
  });
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => sessionId,
    startAckTimeoutMs: 5,
  });

  await controller.start('notes');

  assert.equal(connection.writes.length, 1);
  assert.deepEqual(
    {
      state: controller.snapshot.state,
      count: controller.snapshot.count,
      elapsedMs: controller.snapshot.elapsedMs,
    },
    { state: 'active', count: 2, elapsedMs: 900 },
  );
});

test('START timeout retries once after a Ready state check', async () => {
  const connection = new FakeTrainingConnection();
  const sessionId = 100;
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => sessionId,
    startAckTimeoutMs: 5,
  });
  connection.onWrite = () => {
    if (connection.writes.length === 2) {
      connection.emit(acceptedStart(sessionId));
    }
  };

  await controller.start('notes');

  assert.equal(connection.writes.length, 2);
  assert.equal(controller.snapshot.state, 'active');
});

test('complete uses authoritative values and ignores stale or regressing progress', async () => {
  const connection = new FakeTrainingConnection();
  let timestamp = 0;
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 55,
    clock: () => `timestamp-${++timestamp}`,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('session notes');
  await Promise.resolve();
  connection.emit(acceptedStart(55));
  await start;

  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 55,
    sequence: 2,
    payload: { count: 4, elapsedMs: 2400 },
  });
  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 55,
    sequence: 1,
    payload: { count: 2, elapsedMs: 900 },
  });
  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 55,
    sequence: 3,
    payload: { count: 3, elapsedMs: 1200 },
  });

  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 999,
    sequence: 4,
    payload: { count: 6, elapsedMs: 3600 },
  });
  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 55,
    sequence: 4,
    payload: { count: 7, elapsedMs: 3600 },
  });
  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.COMPLETE,
    sessionId: 55,
    sequence: 5,
    payload: { count: 6, durationMs: 3600, reason: 99 },
  });

  assert.equal(controller.snapshot.count, 4);
  assert.equal(controller.snapshot.elapsedMs, 2400);

  connection.emit(complete(55, 6, 6, 3600));

  assert.equal(controller.snapshot.state, 'completed');
  assert.deepEqual(controller.snapshot.result, {
    count: 6,
    durationMs: 3600,
    reason: COMPLETION_REASONS.TARGET_REACHED,
    sequence: 6,
  });
  assert.equal(controller.snapshot.startedAt, 'timestamp-1');
  assert.equal(controller.snapshot.completedAt, 'timestamp-2');
  assert.equal(controller.snapshot.notes, 'session notes');
  assert.equal(controller.snapshot.deviceName, 'Fikk-ESP32');

  connection.emit(complete(55, 4, 1, 100));
  assert.equal(controller.snapshot.result?.count, 6);
});

async function makeCompletedSession(
  repository: TrainingSessionRepository,
  sessionId = 42,
): Promise<{ connection: FakeTrainingConnection; controller: TrainingSessionController }> {
  const connection = new FakeTrainingConnection();
  let timestamp = 0;
  const controller = new TrainingSessionController({
    connection,
    repository,
    sessionIdFactory: () => sessionId,
    clock: () => `timestamp-${++timestamp}`,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('  saved notes  ');
  await Promise.resolve();
  connection.emit(acceptedStart(sessionId));
  await start;
  connection.emit(complete(sessionId, 2, 6, 1600));
  assert.equal(controller.snapshot.state, 'completed');
  return { connection, controller };
}

test('Save persists one result before sending ACK_RESULT, including repeated Save calls', async () => {
  const repository = new MemoryTrainingSessionRepository();
  const { connection, controller } = await makeCompletedSession(repository);
  const operations: string[] = [];
  repository.onSave = () => operations.push('persist');
  connection.onWrite = () => operations.push('write');

  const firstSave = controller.saveResult();
  const secondSave = controller.saveResult();
  const [saved] = await Promise.all([firstSave, secondSave]);

  assert.equal(repository.saveCalls, 1);
  assert.deepEqual(operations, ['persist', 'write']);
  assert.equal(saved.bleSessionId, 42);
  assert.equal(saved.notes, 'saved notes');
  assert.equal(saved.targetCount, 6);
  assert.equal(saved.finalCount, 6);
  assert.equal(saved.durationMs, 1600);
  assert.equal(saved.startedAt, 'timestamp-1');
  assert.equal(saved.completedAt, 'timestamp-2');
  assert.equal(saved.deviceKey, 'device-1');
  assert.equal(saved.deviceName, 'Fikk-ESP32');
  assert.equal(saved.status, 'completed');
  assert.equal(saved.protocolVersion, 1);
  assert.deepEqual(decodeMessage(connection.writes[1]), {
    version: 1,
    messageType: MESSAGE_TYPES.ACK_RESULT,
    sessionId: 42,
    sequence: 0,
    payload: { resultSequence: 2 },
  });
  assert.equal(controller.snapshot.state, 'idle');
});

test('Discard sends ACK_RESULT without persisting the completed result', async () => {
  const repository = new MemoryTrainingSessionRepository();
  const { connection, controller } = await makeCompletedSession(repository, 43);

  await controller.discardResult();

  assert.equal(repository.saveCalls, 0);
  assert.equal(repository.sessions.size, 0);
  assert.deepEqual(decodeMessage(connection.writes[1]), {
    version: 1,
    messageType: MESSAGE_TYPES.ACK_RESULT,
    sessionId: 43,
    sequence: 0,
    payload: { resultSequence: 2 },
  });
  assert.equal(controller.snapshot.state, 'idle');
  assert.equal(controller.snapshot.sessionId, null);
});

async function waitForTrainingState(
  controller: TrainingSessionController,
  state: 'active' | 'completed' | 'error',
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (controller.snapshot.state === state) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(controller.snapshot.state, state);
}

test('disconnect recovers an active session with SYNC and never sends START again', async () => {
  const connection = new FakeTrainingConnection();
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 77,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('active recovery');
  await Promise.resolve();
  connection.emit(acceptedStart(77));
  await start;
  connection.onReconnect = () => {
    connection.setConnectionSnapshot({
      status: 'ready',
      connectedDevice: device,
      deviceState: { state: DEVICE_STATES.ACTIVE, count: 2, elapsedMs: 900 },
    });
  };
  connection.onSync = (sessionId) => {
    connection.emit({
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId,
      sequence: 3,
      payload: { state: DEVICE_STATES.ACTIVE, count: 2, elapsedMs: 900 },
    });
  };

  connection.setConnectionSnapshot({ status: 'disconnected', connectedDevice: null, deviceState: null });
  await waitForTrainingState(controller, 'active');

  assert.equal(controller.snapshot.sessionId, 77);
  assert.deepEqual(connection.recoveryCalls, ['reconnect', 'sync:77']);
  assert.equal(connection.writes.length, 1);
  assert.equal(controller.snapshot.count, 2);
  assert.equal(controller.snapshot.elapsedMs, 900);
});

test('disconnect recovery surfaces a retained completed Result', async () => {
  const connection = new FakeTrainingConnection();
  let timestamp = 0;
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 88,
    clock: () => `recovery-${++timestamp}`,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('completed recovery');
  await Promise.resolve();
  connection.emit(acceptedStart(88));
  await start;
  connection.onReconnect = () => {
    connection.setConnectionSnapshot({ status: 'ready', connectedDevice: device });
  };
  connection.onSync = (sessionId) => {
    connection.emit({
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId,
      sequence: 3,
      payload: { state: DEVICE_STATES.COMPLETED, count: 6, elapsedMs: 3200 },
    });
    connection.emit(complete(sessionId, 4, 6, 3200));
  };

  connection.setConnectionSnapshot({ status: 'disconnected', connectedDevice: null, deviceState: null });
  await waitForTrainingState(controller, 'completed');

  assert.equal(controller.snapshot.sessionId, 88);
  assert.equal(controller.snapshot.result?.durationMs, 3200);
  assert.equal(controller.snapshot.result?.sequence, 4);
  assert.deepEqual(connection.recoveryCalls, ['reconnect', 'sync:88']);
});

test('disconnect recovery reports when the device no longer retains the session', async () => {
  const connection = new FakeTrainingConnection();
  const controller = new TrainingSessionController({
    connection,
    sessionIdFactory: () => 99,
    startAckTimeoutMs: 50,
  });
  const start = controller.start('lost recovery');
  await Promise.resolve();
  connection.emit(acceptedStart(99));
  await start;
  connection.onReconnect = () => {
    connection.setConnectionSnapshot({ status: 'ready', connectedDevice: device });
  };
  connection.onSync = () => {
    connection.emit({
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId: 0,
      sequence: 3,
      payload: { state: DEVICE_STATES.READY, count: 0, elapsedMs: 0 },
    });
  };

  connection.setConnectionSnapshot({ status: 'disconnected', connectedDevice: null, deviceState: null });
  await waitForTrainingState(controller, 'error');

  assert.match(controller.snapshot.error ?? '', /no longer retains|start a new session/i);
  assert.equal(controller.snapshot.sessionId, 99);
});

async function flushPersistence(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('relaunch restores an active session and synchronizes without sending START', async () => {
  const store = new MemoryTrainingSessionStore();
  const connection = new FakeTrainingConnection();
  const original = new TrainingSessionController({
    connection,
    sessionStore: store,
    sessionIdFactory: () => 123,
    startAckTimeoutMs: 50,
  });
  const start = original.start('relaunch active');
  await Promise.resolve();
  connection.emit(acceptedStart(123));
  await start;
  connection.emit({
    version: 1,
    messageType: MESSAGE_TYPES.PROGRESS,
    sessionId: 123,
    sequence: 2,
    payload: { count: 2, elapsedMs: 900 },
  });
  await flushPersistence();
  original.dispose();

  connection.recoveryCalls.length = 0;
  connection.setConnectionSnapshot({ status: 'disconnected', connectedDevice: null, deviceState: null });
  connection.onReconnect = () => {
    connection.setConnectionSnapshot({ status: 'ready', connectedDevice: device });
  };
  connection.onSync = (sessionId) => {
    connection.emit({
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId,
      sequence: 3,
      payload: { state: DEVICE_STATES.ACTIVE, count: 3, elapsedMs: 1400 },
    });
  };

  const restored = new TrainingSessionController({
    connection,
    sessionStore: store,
    recoveryResponseTimeoutMs: 50,
  });
  await restored.restore();
  await waitForTrainingState(restored, 'active');

  assert.equal(restored.snapshot.sessionId, 123);
  assert.equal(restored.snapshot.count, 3);
  assert.equal(restored.snapshot.elapsedMs, 1400);
  assert.deepEqual(connection.recoveryCalls, ['reconnect', 'sync:123']);
  assert.equal(connection.writes.length, 1);
});

test('relaunch restores a completed result without creating a new session', async () => {
  const store = new MemoryTrainingSessionStore();
  const connection = new FakeTrainingConnection();
  const original = new TrainingSessionController({
    connection,
    sessionStore: store,
    sessionIdFactory: () => 456,
    clock: (() => {
      let timestamp = 0;
      return () => `completed-${++timestamp}`;
    })(),
    startAckTimeoutMs: 50,
  });
  const start = original.start('relaunch completed');
  await Promise.resolve();
  connection.emit(acceptedStart(456));
  await start;
  connection.emit(complete(456, 2, 6, 2200));
  await flushPersistence();
  original.dispose();
  connection.recoveryCalls.length = 0;

  const restored = new TrainingSessionController({ connection, sessionStore: store });
  await restored.restore();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(restored.snapshot.state, 'completed');
  assert.equal(restored.snapshot.sessionId, 456);
  assert.equal(restored.snapshot.result?.durationMs, 2200);
  assert.deepEqual(connection.recoveryCalls, ['reconnect', 'sync:456']);
  assert.equal(connection.writes.length, 1);
});

test('relaunch recovery failure preserves the unresolved session without fabricating a result', async () => {
  const store = new MemoryTrainingSessionStore();
  const connection = new FakeTrainingConnection();
  const original = new TrainingSessionController({
    connection,
    sessionStore: store,
    sessionIdFactory: () => 789,
    startAckTimeoutMs: 50,
  });
  const start = original.start('relaunch failure');
  await Promise.resolve();
  connection.emit(acceptedStart(789));
  await start;
  await flushPersistence();
  original.dispose();
  connection.setConnectionSnapshot({ status: 'disconnected', connectedDevice: null, deviceState: null });
  connection.onReconnect = () => undefined;

  const restored = new TrainingSessionController({
    connection,
    sessionStore: store,
    recoveryResponseTimeoutMs: 50,
  });
  await restored.restore();
  await waitForTrainingState(restored, 'error');

  assert.equal(restored.snapshot.sessionId, 789);
  assert.equal(restored.snapshot.result, null);
  assert.match(restored.snapshot.error ?? '', /unable to reconnect|recovery failed/i);
});
