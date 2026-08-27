import { Button, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus } from '../features/bluetooth/labels';

export function HomeScreen() {
  const { snapshot } = useBluetooth();
  const ready = snapshot.status === 'ready';

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Fikk Mobile
      </Text>
      <Text style={styles.sectionTitle}>Home</Text>
      <Text style={styles.label}>Device status</Text>
      <Text style={styles.value}>{formatConnectionStatus(snapshot)}</Text>
      <View style={styles.spacer} />
      <Button title="Start Training" disabled={!ready} onPress={() => undefined} />
      {!ready && <Text style={styles.helper}>Connect a ready device from Settings first.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  sectionTitle: { marginTop: 28, fontSize: 22, fontWeight: '700', color: '#0f172a' },
  label: { marginTop: 18, fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 6, color: '#0f172a' },
  spacer: { height: 16 },
  helper: { marginTop: 10, color: '#64748b' },
});
