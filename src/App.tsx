import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createFikkNativeBleTransport } from './ble/create-native-transport';
import { FIKK_BLE_PROFILE } from './ble/fikk-profile';
import { BluetoothConnectionController, type ConnectionSnapshot } from './features/bluetooth/connection-controller';
import { nativeBluetoothPermissions } from './features/bluetooth/native-permissions';
import { nativeDeviceIdentityStore } from './features/bluetooth/native-device-store';

const tabs = ['Home', 'History', 'Settings'] as const;
type Tab = (typeof tabs)[number];

export default function App() {
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
  const [tab, setTab] = useState<Tab>('Home');
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(controller.snapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    void controller.loadLastDevice();
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Fikk Mobile
        </Text>
        <Text style={styles.statusText}>{formatConnectionStatus(snapshot)}</Text>
      </View>
      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs.map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'Home' && <HomeView snapshot={snapshot} />}
        {tab === 'History' && <HistoryView />}
        {tab === 'Settings' && <SettingsView controller={controller} snapshot={snapshot} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeView({ snapshot }: { snapshot: ConnectionSnapshot }) {
  const ready = snapshot.status === 'ready';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Home</Text>
      <Text style={styles.label}>Device status</Text>
      <Text style={styles.value}>{formatConnectionStatus(snapshot)}</Text>
      <View style={styles.spacer} />
      <Button title="Start Training" disabled={!ready} onPress={() => undefined} />
      {!ready && <Text style={styles.helper}>Connect a ready device from Settings first.</Text>}
    </View>
  );
}

function HistoryView() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>History</Text>
      <Text style={styles.helper}>Saved training sessions will appear here.</Text>
    </View>
  );
}

function SettingsView({
  controller,
  snapshot,
}: {
  controller: BluetoothConnectionController;
  snapshot: ConnectionSnapshot;
}) {
  const busy = ['requesting-permission', 'scanning', 'connecting', 'discovering'].includes(snapshot.status);
  const connected = snapshot.connectedDevice !== null;

  return (
    <View style={styles.section}>
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
        <Button disabled={busy} title={busy ? 'Working…' : 'Scan for devices'} onPress={() => void controller.scan()} />
        {connected && <Button title="Disconnect" onPress={() => void controller.disconnect()} />}
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
            onPress={() => void controller.connect(device)}
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
          <Text style={styles.value}>
            {snapshot.deviceState
              ? `${formatDeviceState(snapshot.deviceState.state)} · ${snapshot.deviceState.count} · ${snapshot.deviceState.elapsedMs} ms`
              : 'No state snapshot'}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatConnectionStatus(snapshot: ConnectionSnapshot): string {
  if (snapshot.status === 'error') {
    return 'Error';
  }
  if (snapshot.status === 'ready') {
    return 'Ready';
  }
  return snapshot.status.replaceAll('-', ' ');
}

function formatDeviceState(state: number): string {
  return ['READY', 'ACTIVE', 'COMPLETED', 'ERROR'][state] ?? 'UNKNOWN';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusText: {
    marginTop: 4,
    color: '#475569',
    textTransform: 'capitalize',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#1d4ed8',
  },
  content: {
    padding: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  label: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  value: {
    color: '#0f172a',
  },
  helper: {
    color: '#64748b',
  },
  error: {
    padding: 12,
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  spacer: {
    height: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 8,
  },
  loader: {
    marginVertical: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  deviceDetails: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontWeight: '600',
    color: '#0f172a',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  diagnostics: {
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cbd5e1',
  },
});
