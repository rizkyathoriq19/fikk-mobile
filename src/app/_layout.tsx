import { Stack } from 'expo-router';
import { BluetoothProvider } from '../features/bluetooth/BluetoothProvider';

export default function RootLayout() {
  return (
    <BluetoothProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </BluetoothProvider>
  );
}
