import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { formatConnectionStatus } from '../../src/features/bluetooth/labels';
import { useBluetooth } from '../../src/features/bluetooth/BluetoothProvider';

export default function HomeRoute() {
  const { snapshot } = useBluetooth();
  const ready = snapshot.status === 'ready';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Fikk Mobile
        </Text>
        <Text style={styles.sectionTitle}>Home</Text>
        <Text style={styles.label}>Device status</Text>
        <Text style={styles.value}>{formatConnectionStatus(snapshot)}</Text>
        <View style={styles.spacer} />
        <Button title="Start Training" disabled={!ready} onPress={() => undefined} />
        {!ready && <Text style={styles.helper}>Connect a ready device from Settings first.</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  sectionTitle: { marginTop: 28, fontSize: 22, fontWeight: '700', color: '#0f172a' },
  label: { marginTop: 18, fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 6, color: '#0f172a' },
  spacer: { height: 16 },
  helper: { marginTop: 10, color: '#64748b' },
});
