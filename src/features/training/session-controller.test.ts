import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEVICE_STATES,
  MESSAGE_TYPES,
  type ProtocolMessage,
  encodeMessage,
} from '../../protocol/codec';
import { ACK_STATUS, COMPLETION_REASONS } from '../../protocol/constants';
import { FIKK_BLE_PROFILE } from '../../ble/fikk-profile';
import type { BleAdapterState, BleDevice } from '../../ble/transport';
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
  snapshot = {
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
  private readonly listeners = new Set<(message: ProtocolMessage) => void>();
  private stateBytes = encodeMessage({
    version: 1,
    messageType: MESSAGE_TYPES.STATE,
    sessionId: 0,
    sequence: 1,
    payload: { state: DEVICE_STATES.READY, count: 0, elapsedMs: 0 },
  });
  onWrite: ((value: Uint8Array) => void) | null = null;

  async writeControl(value: Uint8Array): Promise<void> {
    this.writes.push(new Uint8Array(value));
    this.onWrite?.(value);
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
