import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeviceIdentityStore } from './connection-controller';
import type { BleDevice } from '../../ble/transport';

const LAST_DEVICE_ID_KEY = '@fikk-mobile/last-device-id';
const LAST_DEVICE_KEY = '@fikk-mobile/last-device';

export const nativeDeviceIdentityStore: DeviceIdentityStore = {
  load: () => AsyncStorage.getItem(LAST_DEVICE_ID_KEY),
  save: (deviceId) => AsyncStorage.setItem(LAST_DEVICE_ID_KEY, deviceId),
  loadDevice: async () => {
    const value = await AsyncStorage.getItem(LAST_DEVICE_KEY);
    if (value === null) {
      return null;
    }
    try {
      const device = JSON.parse(value) as Partial<BleDevice>;
      if (
        typeof device.id !== 'string' ||
        (device.name !== null && typeof device.name !== 'string') ||
        (device.rssi !== null && typeof device.rssi !== 'number') ||
        !Array.isArray(device.serviceUuids) ||
        device.serviceUuids.some((uuid) => typeof uuid !== 'string')
      ) {
        return null;
      }
      return {
        id: device.id,
        name: device.name ?? null,
        rssi: device.rssi ?? null,
        serviceUuids: device.serviceUuids,
      };
    } catch {
      return null;
    }
  },
  saveDevice: (device) => AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(device)),
};
