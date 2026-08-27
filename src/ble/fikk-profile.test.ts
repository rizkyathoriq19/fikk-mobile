import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIKK_BLE_PROFILE, FIKK_BLE_UUIDS } from './fikk-profile';

test('Fikk BLE profile exposes stable shared UUIDs', () => {
  assert.deepEqual(FIKK_BLE_PROFILE, {
    serviceUuid: 'c8c5aefd-0e30-525e-9bf9-5243913c8127',
    characteristics: {
      CONTROL: 'c42f890d-088a-5b19-bcd4-5029fceb2bcc',
      EVENT: '57a6c81b-268e-5eed-995b-2149521b911f',
      STATE: '8271b32c-fa20-5adc-a4d0-141bf24baa71',
      DEVICE_INFO: '98ef338e-f5f8-5ea4-b89f-116d303090a3',
    },
  });
  assert.equal(FIKK_BLE_UUIDS.service, FIKK_BLE_PROFILE.serviceUuid);
});
