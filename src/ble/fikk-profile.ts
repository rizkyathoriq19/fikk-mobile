import { createBleProfile } from './profile';

export const FIKK_BLE_UUIDS = {
  service: 'c8c5aefd-0e30-525e-9bf9-5243913c8127',
  control: 'c42f890d-088a-5b19-bcd4-5029fceb2bcc',
  event: '57a6c81b-268e-5eed-995b-2149521b911f',
  state: '8271b32c-fa20-5adc-a4d0-141bf24baa71',
  deviceInfo: '98ef338e-f5f8-5ea4-b89f-116d303090a3',
} as const;

export const FIKK_BLE_PROFILE = createBleProfile({
  serviceUuid: FIKK_BLE_UUIDS.service,
  characteristics: {
    CONTROL: FIKK_BLE_UUIDS.control,
    EVENT: FIKK_BLE_UUIDS.event,
    STATE: FIKK_BLE_UUIDS.state,
    DEVICE_INFO: FIKK_BLE_UUIDS.deviceInfo,
  },
});
