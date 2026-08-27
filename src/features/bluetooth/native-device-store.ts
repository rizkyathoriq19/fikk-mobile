import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeviceIdentityStore } from './connection-controller';

const LAST_DEVICE_ID_KEY = '@fikk-mobile/last-device-id';

export const nativeDeviceIdentityStore: DeviceIdentityStore = {
  load: () => AsyncStorage.getItem(LAST_DEVICE_ID_KEY),
  save: (deviceId) => AsyncStorage.setItem(LAST_DEVICE_ID_KEY, deviceId),
};
