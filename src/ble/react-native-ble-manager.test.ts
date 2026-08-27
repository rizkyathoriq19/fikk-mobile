import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  Peripheral,
  PeripheralInfo,
} from 'react-native-ble-manager';
import type { BleManagerClient } from './react-native-ble-manager.js';
import { ReactNativeBleManagerTransport } from './react-native-ble-manager.js';
import { createBleProfile } from './profile.js';

const discoveredInfo: PeripheralInfo = {
  id: 'device-1',
  name: 'Fikk Trainer',
  rssi: -42,
  advertising: { serviceUUIDs: ['service-1'] },
  serviceUUIDs: ['service-1'],
  characteristics: [
    { service: 'service-1', characteristic: 'control-1', properties: {} },
    { service: 'service-1', characteristic: 'event-1', properties: {} },
    { service: 'service-1', characteristic: 'state-1', properties: {} },
    { service: 'service-1', characteristic: 'info-1', properties: {} },
  ],
};

test('native adapter maps the BLE manager lifecycle behind the transport seam', async () => {
  let discoverPeripheral: ((peripheral: Peripheral) => void) | undefined;
  let valueListener: ((event: BleManagerDidUpdateValueForCharacteristicEvent) => void) | undefined;
  const calls: string[] = [];
  const client: BleManagerClient = {
    start: async () => {
      calls.push('start');
    },
    checkState: async () => 'on',
    scan: async () => {
      discoverPeripheral?.({
        id: 'device-1',
        name: 'Fikk Trainer',
        rssi: -42,
        advertising: { serviceUUIDs: ['service-1'] },
      });
      discoverPeripheral?.({
        id: 'other-device',
        name: 'Other',
        rssi: -70,
        advertising: { serviceUUIDs: ['other-service'] },
      });
    },
    stopScan: async () => {
      calls.push('stopScan');
    },
    connect: async (id) => {
      calls.push(`connect:${id}`);
    },
    disconnect: async (id) => {
      calls.push(`disconnect:${id}`);
    },
    retrieveServices: async (id, services) => {
      calls.push(`discover:${id}:${services?.[0]}`);
      return discoveredInfo;
    },
    startNotification: async (id, service, characteristic) => {
      calls.push(`notify:${id}:${service}:${characteristic}`);
    },
    stopNotification: async (id, service, characteristic) => {
      calls.push(`stopNotify:${id}:${service}:${characteristic}`);
    },
    read: async (id, service, characteristic) => {
      calls.push(`read:${id}:${service}:${characteristic}`);
      return [4, 5];
    },
    write: async (id, service, characteristic, value) => {
      calls.push(`write:${id}:${service}:${characteristic}:${value.join(',')}`);
    },
    onDiscoverPeripheral: (callback) => {
      discoverPeripheral = callback;
      return { remove: () => calls.push('removeDiscoverListener') };
    },
    onDidUpdateValueForCharacteristic: (callback) => {
      valueListener = callback;
      return { remove: () => calls.push('removeValueListener') };
    },
  };
  const profile = createBleProfile({
    serviceUuid: 'service-1',
    characteristics: {
      CONTROL: 'control-1',
      EVENT: 'event-1',
      STATE: 'state-1',
      DEVICE_INFO: 'info-1',
    },
  });
  const transport = new ReactNativeBleManagerTransport(client, profile);
  const devices: string[] = [];
  const events: number[][] = [];

  await transport.initialize();
  await transport.scan({ serviceUuid: 'service-1', seconds: 5, onDevice: (device) => devices.push(device.id) });
  assert.deepEqual(devices, ['device-1']);

  await transport.connect({
    id: 'device-1',
    name: 'Fikk Trainer',
    rssi: -42,
    serviceUuids: ['service-1'],
  });
  await transport.discover();
  const unsubscribe = await transport.subscribe('EVENT', (value) => events.push([...value]));
  await transport.writeControl(Uint8Array.of(1, 2));
  valueListener?.({
    peripheral: 'device-1',
    service: 'service-1',
    characteristic: 'event-1',
    value: [9, 8],
  });
  assert.deepEqual(events, [[9, 8]]);
  assert.deepEqual(await transport.read('STATE'), Uint8Array.of(4, 5));
  unsubscribe();
  await transport.disconnect();

  assert.deepEqual(calls, [
    'start',
    'removeDiscoverListener',
    'connect:device-1',
    'discover:device-1:service-1',
    'notify:device-1:service-1:event-1',
    'write:device-1:service-1:control-1:1,2',
    'read:device-1:service-1:state-1',
    'removeValueListener',
    'stopNotify:device-1:service-1:event-1',
    'disconnect:device-1',
  ]);
});

test('native adapter requires discovery before protocol operations', async () => {
  const client: BleManagerClient = {
    start: async () => undefined,
    checkState: async () => 'on',
    scan: async () => undefined,
    stopScan: async () => undefined,
    connect: async () => undefined,
    disconnect: async () => undefined,
    retrieveServices: async () => discoveredInfo,
    startNotification: async () => undefined,
    stopNotification: async () => undefined,
    read: async () => [],
    write: async () => undefined,
    onDiscoverPeripheral: () => ({ remove: () => undefined }),
    onDidUpdateValueForCharacteristic: () => ({ remove: () => undefined }),
  };
  const profile = createBleProfile({
    serviceUuid: 'service-1',
    characteristics: {
      CONTROL: 'control-1',
      EVENT: 'event-1',
      STATE: 'state-1',
      DEVICE_INFO: 'info-1',
    },
  });
  const transport = new ReactNativeBleManagerTransport(client, profile);

  await assert.rejects(() => transport.writeControl(Uint8Array.of(1)), /discovered connection/i);
});

test('native adapter rejects a connection missing required GATT characteristics', async () => {
  const client: BleManagerClient = {
    start: async () => undefined,
    checkState: async () => 'on',
    scan: async () => undefined,
    stopScan: async () => undefined,
    connect: async () => undefined,
    disconnect: async () => undefined,
    retrieveServices: async () => ({
      id: 'device-1',
      rssi: -42,
      advertising: { serviceUUIDs: ['service-1'] },
      serviceUUIDs: ['service-1'],
      characteristics: [
        { service: 'service-1', characteristic: 'control-1', properties: {} },
        { service: 'service-1', characteristic: 'state-1', properties: {} },
        { service: 'service-1', characteristic: 'info-1', properties: {} },
      ],
    }),
    startNotification: async () => undefined,
    stopNotification: async () => undefined,
    read: async () => [],
    write: async () => undefined,
    onDiscoverPeripheral: () => ({ remove: () => undefined }),
    onDidUpdateValueForCharacteristic: () => ({ remove: () => undefined }),
  };
  const profile = createBleProfile({
    serviceUuid: 'service-1',
    characteristics: {
      CONTROL: 'control-1',
      EVENT: 'event-1',
      STATE: 'state-1',
      DEVICE_INFO: 'info-1',
    },
  });
  const transport = new ReactNativeBleManagerTransport(client, profile);

  await transport.connect({
    id: 'device-1',
    name: 'Fikk Trainer',
    rssi: -42,
    serviceUuids: ['service-1'],
  });

  await assert.rejects(() => transport.discover(), /required GATT characteristics missing.*EVENT/i);
  await assert.rejects(() => transport.writeControl(Uint8Array.of(1)), /discovered connection/i);
});
