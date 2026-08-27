import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { createFikkNativeBleTransport } from '../../ble/create-native-transport';
import { FIKK_BLE_PROFILE } from '../../ble/fikk-profile';
import {
  BluetoothConnectionController,
  type ConnectionSnapshot,
} from './connection-controller';
import { nativeBluetoothPermissions } from './native-permissions';
import { nativeDeviceIdentityStore } from './native-device-store';
import type { BleDevice } from '../../ble/transport';

type BluetoothContextValue = {
  snapshot: ConnectionSnapshot;
  scan(): Promise<void>;
  connect(device: BleDevice): Promise<void>;
  disconnect(): Promise<void>;
};

const BluetoothContext = createContext<BluetoothContextValue | null>(null);

export function BluetoothProvider({ children }: PropsWithChildren) {
  const controller = useMemo(
    () =>
      new BluetoothConnectionController({
        transport: createFikkNativeBleTransport(),
        permissions: nativeBluetoothPermissions,
        deviceStore: nativeDeviceIdentityStore,
        profile: FIKK_BLE_PROFILE,
      }),
    [],
  );
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(controller.snapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    void controller.loadLastDevice();
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  const value = useMemo(
    () => ({
      snapshot,
      scan: () => controller.scan(),
      connect: (device: BleDevice) => controller.connect(device),
      disconnect: () => controller.disconnect(),
    }),
    [controller, snapshot],
  );

  return <BluetoothContext.Provider value={value}>{children}</BluetoothContext.Provider>;
}

export function useBluetooth(): BluetoothContextValue {
  const value = useContext(BluetoothContext);
  if (value === null) {
    throw new Error('useBluetooth must be used inside BluetoothProvider');
  }
  return value;
}
