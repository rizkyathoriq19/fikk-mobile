import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeMessage, encodeMessage, MESSAGE_TYPES } from '../../protocol/codec';
import { FIKK_BLE_PROFILE } from '../../ble/fikk-profile';
import { FakeBleTransport, type BleDevice } from '../../ble/transport';
import {
  BluetoothConnectionController,
  type BluetoothPermissionGateway,
  type DeviceIdentityStore,
} from './connection-controller';

test('BLE permission is lazy and Ready follows scan, discovery, subscriptions, and sync', async () => {
  const device: BleDevice = {
    id: 'device-1',
    name: 'Fikk-ESP32',
    rssi: -44,
    serviceUuids: [FIKK_BLE_PROFILE.serviceUuid],
  };
  const state = encodeMessage({
    version: 1,
    messageType: MESSAGE_TYPES.STATE,
    sessionId: 0,
    sequence: 1,
    payload: { state: 0, count: 0, elapsedMs: 0 },
  });
  const transport = new FakeBleTransport({
    devices: [device],
    readValues: {
      STATE: state,
      DEVICE_INFO: Uint8Array.from(new TextEncoder().encode('firmware=0.1.0;protocol=1')),
    },
  });
  let permissionRequests = 0;
  const permissions: BluetoothPermissionGateway = {
    request: async () => {
      permissionRequests += 1;
    },
  };
  let savedDeviceId: string | null = null;
  const deviceStore: DeviceIdentityStore = {
    load: async () => savedDeviceId,
    save: async (id) => {
      savedDeviceId = id;
    },
  };
  const controller = new BluetoothConnectionController({
    transport,
    permissions,
    deviceStore,
    profile: FIKK_BLE_PROFILE,
  });

  await controller.loadLastDevice();
  assert.equal(permissionRequests, 0);
  assert.equal(controller.snapshot.lastDeviceId, null);

  await controller.scan();
  assert.equal(permissionRequests, 1);
  assert.equal(controller.snapshot.status, 'disconnected');
  assert.deepEqual(controller.snapshot.devices, [device]);

  await controller.connect(device);
  assert.equal(controller.snapshot.status, 'ready');
  assert.equal(controller.snapshot.connectedDevice?.id, 'device-1');
  assert.equal(controller.snapshot.deviceInfo, 'firmware=0.1.0;protocol=1');
  assert.deepEqual(controller.snapshot.deviceState, { state: 0, count: 0, elapsedMs: 0 });
  assert.equal(savedDeviceId, 'device-1');

  transport.emit(
    'STATE',
    encodeMessage({
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId: 7,
      sequence: 2,
      payload: { state: 1, count: 2, elapsedMs: 900 },
    }),
  );
  assert.deepEqual(controller.snapshot.deviceState, { state: 1, count: 2, elapsedMs: 900 });
});

test('permission failure is exposed as recoverable connection state', async () => {
  const controller = new BluetoothConnectionController({
    transport: new FakeBleTransport(),
    permissions: {
      request: async () => {
        throw new Error('Bluetooth permission denied');
      },
    },
    deviceStore: {
      load: async () => null,
      save: async () => undefined,
    },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.scan();

  assert.equal(controller.snapshot.status, 'error');
  assert.equal(controller.snapshot.error, 'Bluetooth permission denied');
});

test('Bluetooth adapter off is exposed without entering scan state', async () => {
  const controller = new BluetoothConnectionController({
    transport: new FakeBleTransport({ adapterState: 'off' }),
    permissions: { request: async () => undefined },
    deviceStore: { load: async () => null, save: async () => undefined },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.scan();

  assert.equal(controller.snapshot.adapterState, 'off');
  assert.equal(controller.snapshot.status, 'error');
  assert.equal(controller.snapshot.error, 'Bluetooth adapter is off');
});

test('invalid initial state does not leave a phantom connected device', async () => {
  const device: BleDevice = {
    id: 'device-1',
    name: 'Fikk-ESP32',
    rssi: -44,
    serviceUuids: [FIKK_BLE_PROFILE.serviceUuid],
  };
  const nonStateMessage = encodeMessage({
    version: 1,
    messageType: MESSAGE_TYPES.START,
    sessionId: 1,
    sequence: 1,
    payload: { targetCount: 6 },
  });
  const controller = new BluetoothConnectionController({
    transport: new FakeBleTransport({ readValues: { STATE: nonStateMessage } }),
    permissions: { request: async () => undefined },
    deviceStore: { load: async () => null, save: async () => undefined },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.connect(device);

  assert.equal(controller.snapshot.status, 'error');
  assert.equal(controller.snapshot.error, 'STATE characteristic returned a non-STATE message');
  assert.equal(controller.snapshot.connectedDevice, null);
});

test('scan with no compatible devices reports a recoverable no-device state', async () => {
  const controller = new BluetoothConnectionController({
    transport: new FakeBleTransport({ devices: [] }),
    permissions: { request: async () => undefined },
    deviceStore: { load: async () => null, save: async () => undefined },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.scan();

  assert.equal(controller.snapshot.status, 'error');
  assert.equal(controller.snapshot.error, 'No compatible BLE device found after the scan');
});

test('connection timeout becomes a recoverable error', async () => {
  const transport = new (class extends FakeBleTransport {
    async connect(): Promise<void> {
      await new Promise<void>(() => undefined);
    }
  })();
  const controller = new BluetoothConnectionController({
    transport,
    operationTimeoutMs: 5,
    permissions: { request: async () => undefined },
    deviceStore: { load: async () => null, save: async () => undefined },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.connect({
    id: 'device-1',
    name: 'Fikk-ESP32',
    rssi: -42,
    serviceUuids: [FIKK_BLE_PROFILE.serviceUuid],
  });

  assert.equal(controller.snapshot.status, 'error');
  assert.equal(controller.snapshot.error, 'BLE connection timed out');
});

test('unexpected disconnect preserves identity, reconnects, and syncs the same session', async () => {
  const device: BleDevice = {
    id: 'device-1',
    name: 'Fikk-ESP32',
    rssi: -44,
    serviceUuids: [FIKK_BLE_PROFILE.serviceUuid],
  };
  const state = encodeMessage({
    version: 1,
    messageType: MESSAGE_TYPES.STATE,
    sessionId: 7,
    sequence: 2,
    payload: { state: 1, count: 2, elapsedMs: 900 },
  });
  const transport = new FakeBleTransport({
    readValues: {
      STATE: state,
      DEVICE_INFO: Uint8Array.from(new TextEncoder().encode('firmware=0.1.0')),
    },
  });
  const controller = new BluetoothConnectionController({
    transport,
    permissions: { request: async () => undefined },
    deviceStore: { load: async () => null, save: async () => undefined },
    profile: FIKK_BLE_PROFILE,
  });

  await controller.connect(device);
  transport.emitDisconnect();

  assert.equal(controller.snapshot.status, 'disconnected');
  assert.equal(controller.snapshot.connectedDevice, null);
  assert.equal(controller.snapshot.lastDeviceId, device.id);
  assert.equal(controller.snapshot.error, 'Device disconnected');

  await controller.reconnectLastDevice();
  assert.equal(controller.snapshot.status, 'ready');
  await controller.sync(7);

  assert.deepEqual(decodeMessage(transport.controlWrites[0]), {
    version: 1,
    messageType: MESSAGE_TYPES.SYNC,
    sessionId: 7,
    sequence: 0,
    payload: {},
  });
});
