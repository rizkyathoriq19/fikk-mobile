import { PermissionsAndroid, Platform } from 'react-native';
import type { BluetoothPermissionGateway } from './connection-controller';

export const nativeBluetoothPermissions: BluetoothPermissionGateway = {
  async request(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    const permissions =
      Number(Platform.Version) >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const granted = await PermissionsAndroid.requestMultiple(permissions);
    if (Object.values(granted).some((status) => status !== PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Bluetooth permission denied');
    }
  },
};
