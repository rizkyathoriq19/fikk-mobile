import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus, formatDeviceState } from '../features/bluetooth/labels';

export function SettingsScreen() {
  const { snapshot, scan, connect, disconnect } = useBluetooth();
  const busy = ['requesting-permission', 'scanning', 'connecting', 'discovering'].includes(snapshot.status);
  const connected = snapshot.connectedDevice !== null;

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>
      <Text style={styles.sectionTitle}>Bluetooth</Text>
      <Text style={styles.label}>Adapter</Text>
      <Text style={styles.value}>{snapshot.adapterState}</Text>
      <Text style={styles.label}>Connection</Text>
      <Text style={styles.value}>{formatConnectionStatus(snapshot)}</Text>
      {snapshot.lastDeviceId && (
        <>
          <Text style={styles.label}>Last device</Text>
          <Text selectable style={styles.value}>
            {snapshot.lastDeviceId}
          </Text>
        </>
      )}
      {snapshot.error && <Text style={styles.error}>{snapshot.error}</Text>}
      <View style={styles.buttonRow}>
        <Button disabled={busy} title={busy ? 'Working…' : 'Scan for devices'} onPress={() => void scan()} />
        {connected && <Button title="Disconnect" onPress={() => void disconnect()} />}
      </View>
      {busy && <ActivityIndicator accessibilityLabel="Bluetooth operation in progress" style={styles.loader} />}

      {snapshot.devices.map((device) => (
        <View key={device.id} style={styles.deviceCard}>
          <View style={styles.deviceDetails}>
            <Text style={styles.deviceName}>{device.name ?? 'Unnamed device'}</Text>
            <Text selectable style={styles.deviceMeta}>
              {device.id}
            </Text>
            <Text style={styles.deviceMeta}>RSSI: {device.rssi ?? 'unknown'}</Text>
          </View>
          <Button
            disabled={busy || snapshot.connectedDevice?.id === device.id}
            title={snapshot.connectedDevice?.id === device.id ? 'Connected' : 'Connect'}
            onPress={() => void connect(device)}
          />
        </View>
      ))}

      {snapshot.status === 'ready' && (
        <View style={styles.diagnostics}>
          <Text style={styles.label}>DEVICE_INFO</Text>
          <Text selectable style={styles.value}>
            {snapshot.deviceInfo ?? 'No device information'}
          </Text>
          <Text style={styles.label}>STATE</Text>
          <Text style={styles.value}>{formatDeviceState(snapshot.deviceState)}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  sectionTitle: { marginTop: 28, marginBottom: 8, fontSize: 22, fontWeight: '700', color: '#0f172a' },
  label: { marginTop: 14, fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 4, color: '#0f172a' },
  error: { marginTop: 14, padding: 12, color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 8 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 16 },
  loader: { marginBottom: 14 },
  deviceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#ffffff' },
  deviceDetails: { flex: 1, gap: 2 },
  deviceName: { fontWeight: '600', color: '#0f172a' },
  deviceMeta: { fontSize: 12, color: '#64748b' },
  diagnostics: { gap: 4, marginTop: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cbd5e1' },
});
