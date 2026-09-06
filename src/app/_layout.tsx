import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BluetoothProvider } from '../features/bluetooth/BluetoothProvider';
import { TrainingProvider } from '../features/training/TrainingProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BluetoothProvider>
        <TrainingProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </TrainingProvider>
      </BluetoothProvider>
    </SafeAreaProvider>
  );
}
