import BleManager from 'react-native-ble-manager';
import { ReactNativeBleManagerTransport } from './react-native-ble-manager.js';
import type { BleProfile } from './profile.js';

export function createNativeBleTransport(profile: BleProfile): ReactNativeBleManagerTransport {
  return new ReactNativeBleManagerTransport(BleManager, profile);
}
