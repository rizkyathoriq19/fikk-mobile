import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { ActionButton, Card, ScreenTitle, StatusPill, colors } from '../components/ui';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus } from '../features/bluetooth/labels';

export function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { snapshot, scan, connect, reconnectLastDevice, disconnect } = useBluetooth();
  const busy = ['requesting-permission', 'scanning', 'connecting', 'discovering'].includes(snapshot.status);
  const connected = snapshot.connectedDevice !== null;

  useEffect(() => {
    if (params.returnTo === 'training' && snapshot.status === 'ready') {
      router.replace('/');
    }
  }, [params.returnTo, router, snapshot.status]);

  return (
    <Screen>
      <ScreenTitle eyebrow="Device setup" title="Settings" subtitle="Connect your Fikk device before starting a session." />

      <Card style={styles.statusCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Bluetooth</Text>
          <StatusPill label={statusLabel(snapshot)} tone={statusTone(snapshot)} />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.statusValue}>{formatConnectionStatus(snapshot)}</Text>
        <Text style={styles.helper}>{statusDescription(snapshot)}</Text>
      </Card>

      {snapshot.error && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          {friendlyError(snapshot.error)}
        </Text>
      )}
      <View style={styles.actionGroup}>
        <ActionButton
          accessibilityLabel="Scan for compatible devices"
          disabled={busy}
          loading={snapshot.status === 'scanning' || snapshot.status === 'requesting-permission'}
          title="Scan for devices"
          onPress={() => void scan()}
        />
        {snapshot.lastDeviceId && !connected && (
          <ActionButton
            accessibilityLabel="Reconnect last device"
            disabled={busy}
            title="Reconnect last device"
            variant="outline"
            onPress={() => void reconnectLastDevice()}
          />
        )}
        {connected && (
          <ActionButton
            accessibilityLabel="Disconnect current device"
            title="Disconnect"
            variant="outline"
            onPress={() => void disconnect()}
          />
        )}
      </View>
      {busy && <ActivityIndicator accessibilityLabel="Bluetooth operation in progress" color={colors.primary} style={styles.loader} />}

      {snapshot.devices.length > 0 && (
        <View style={styles.deviceList}>
          <Text style={styles.sectionTitle}>Nearby devices</Text>
          {snapshot.devices.map((device) => (
            <Card key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceDetails}>
                <Text style={styles.deviceName}>{device.name ?? 'Unnamed Fikk device'}</Text>
                <Text style={styles.deviceMeta}>Signal strength: {device.rssi ?? 'unknown'}</Text>
              </View>
              <ActionButton
                accessibilityLabel={`${snapshot.connectedDevice?.id === device.id ? 'Connected to' : 'Connect to'} ${device.name ?? 'unnamed device'}`}
                disabled={busy || snapshot.connectedDevice?.id === device.id}
                title={snapshot.connectedDevice?.id === device.id ? 'Connected' : 'Connect'}
                style={styles.deviceButton}
                onPress={() => void connect(device)}
              />
            </Card>
          ))}
        </View>
      )}

      {snapshot.status === 'ready' && (
        <Card style={styles.connectedCard}>
          <Text style={styles.cardLabel}>Ready device</Text>
          <Text style={styles.deviceName}>{snapshot.connectedDevice?.name ?? 'Fikk device'}</Text>
          <Text style={styles.helper}>Ready for a new training session.</Text>
        </Card>
      )}
    </Screen>
  );
}

function statusLabel(snapshot: ReturnType<typeof useBluetooth>['snapshot']): string {
  if (snapshot.status === 'ready') return 'Ready';
  if (snapshot.status === 'scanning') return 'Searching';
  if (snapshot.status === 'connecting' || snapshot.status === 'discovering') return 'Working';
  return 'Needs setup';
}

function statusTone(snapshot: ReturnType<typeof useBluetooth>['snapshot']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (snapshot.status === 'ready') return 'success';
  if (snapshot.status === 'error') return 'danger';
  if (snapshot.status === 'disconnected') return 'warning';
  return 'neutral';
}

function statusDescription(snapshot: ReturnType<typeof useBluetooth>['snapshot']): string {
  if (snapshot.adapterState === 'off') return 'Turn on Bluetooth in Android Settings, then scan again.';
  if (snapshot.adapterState === 'unsupported') return 'This device does not support Bluetooth Low Energy.';
  if (snapshot.adapterState === 'unauthorized') return 'Allow Bluetooth access to find your Fikk device.';
  if (snapshot.status === 'error' && snapshot.error?.includes('No compatible')) return 'No compatible device was found. Move closer and scan again.';
  if (snapshot.status === 'ready') return 'Your device is ready and synchronized.';
  if (snapshot.status === 'scanning') return 'Searching for nearby Fikk devices for a few seconds.';
  return 'Scan for a nearby device or reconnect the last one used.';
}

function friendlyError(error: string): string {
  if (error.includes('permission')) return 'Bluetooth access is required. Allow it and try again.';
  if (error.includes('adapter is off')) return 'Bluetooth is off. Turn it on and try again.';
  if (error.includes('No compatible')) return 'No compatible device was found. Try scanning again.';
  return 'The device is not ready. Try again or choose another device.';
}

const styles = StyleSheet.create({
  statusCard: { gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  statusValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  error: { borderRadius: 14, padding: 16, color: colors.danger, backgroundColor: colors.dangerSoft, lineHeight: 22 },
  actionGroup: { gap: 12 },
  loader: { alignSelf: 'flex-start' },
  deviceList: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  deviceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  deviceDetails: { flex: 1, gap: 4 },
  deviceName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  deviceMeta: { color: colors.textMuted, fontSize: 13 },
  deviceButton: { minWidth: 96, minHeight: 44, paddingHorizontal: 12 },
  connectedCard: { gap: 8, borderColor: colors.success, backgroundColor: colors.successSoft },
});
