import BleManager from 'react-native-ble-manager';
import { FIKK_BLE_PROFILE } from './fikk-profile';
import { ReactNativeBleManagerTransport } from './react-native-ble-manager';
import type { BleProfile } from './profile';

export function createNativeBleTransport(profile: BleProfile): ReactNativeBleManagerTransport {
  return new ReactNativeBleManagerTransport(BleManager, profile);
}

export function createFikkNativeBleTransport(): ReactNativeBleManagerTransport {
  return createNativeBleTransport(FIKK_BLE_PROFILE);
}
