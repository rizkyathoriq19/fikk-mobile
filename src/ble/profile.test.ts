import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBleProfile } from './profile';

test('BLE profiles trim and retain all required characteristic UUIDs', () => {
  const profile = createBleProfile({
    serviceUuid: ' service-1 ',
    characteristics: {
      CONTROL: ' control-1 ',
      EVENT: 'event-1',
      STATE: 'state-1',
      DEVICE_INFO: 'info-1',
    },
  });

  assert.deepEqual(profile, {
    serviceUuid: 'service-1',
    characteristics: {
      CONTROL: 'control-1',
      EVENT: 'event-1',
      STATE: 'state-1',
      DEVICE_INFO: 'info-1',
    },
  });
});

test('BLE profiles reject missing UUID values', () => {
  assert.throws(
    () =>
      createBleProfile({
        serviceUuid: ' ',
        characteristics: {
          CONTROL: 'control-1',
          EVENT: 'event-1',
          STATE: 'state-1',
          DEVICE_INFO: 'info-1',
        },
      }),
    /service UUID is required/i,
  );

  assert.throws(
    () =>
      createBleProfile({
        serviceUuid: 'service-1',
        characteristics: {
          CONTROL: 'control-1',
          EVENT: '',
          STATE: 'state-1',
          DEVICE_INFO: 'info-1',
        },
      }),
    /EVENT characteristic UUID is required/i,
  );
});
