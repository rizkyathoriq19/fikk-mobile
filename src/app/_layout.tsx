import { Stack } from 'expo-router';
import { BluetoothProvider } from '../features/bluetooth/BluetoothProvider';
import { TrainingProvider } from '../features/training/TrainingProvider';

export default function RootLayout() {
  return (
    <BluetoothProvider>
      <TrainingProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </TrainingProvider>
    </BluetoothProvider>
  );
}
