import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, Card, ScreenTitle, StatusPill, colors } from '../components/ui';
import { Screen } from '../components/Screen';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus } from '../features/bluetooth/labels';
import { useTraining } from '../features/training/TrainingProvider';
import { formatDuration, formatTrainingError } from '../features/training/labels';

export function ActiveTrainingScreen() {
  const router = useRouter();
  const { snapshot: bluetooth, reconnectLastDevice } = useBluetooth();
  const { snapshot: training } = useTraining();
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (training.state === 'completed') {
      router.replace('/result');
    }
  }, [router, training.state]);

  const handleReconnect = () => {
    setReconnecting(true);
    void reconnectLastDevice().finally(() => setReconnecting(false));
  };

  if (training.state !== 'active' && training.state !== 'recovering') {
    return (
      <Screen>
        <ScreenTitle eyebrow="Training" title="No active session" subtitle="Start a new session from Home when your device is ready." />
        {training.error && <Text accessibilityRole="alert" style={styles.error}>{formatTrainingError(training.error)}</Text>}
        <ActionButton title="Back to Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const recovering = training.state === 'recovering';
  return (
    <Screen>
      <ScreenTitle
        eyebrow="Training session"
        title={recovering ? 'Recovering session' : 'Stay focused'}
        subtitle={recovering ? 'Your device may still be training. We are synchronizing its state.' : 'Progress comes from your Fikk device.'}
      />

      <Card style={styles.progressCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Device status</Text>
          <StatusPill label={recovering ? 'Recovery' : 'Active'} tone={recovering ? 'warning' : 'success'} />
        </View>
        <Text style={styles.status}>{formatConnectionStatus(bluetooth)}</Text>
        <Text style={styles.count}>
          {training.count} <Text style={styles.countTarget}>/ {training.targetCount}</Text>
        </Text>
        <Text style={styles.countLabel}>balls completed</Text>
        <View accessibilityLabel={`${training.count} of ${training.targetCount} balls completed`} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, (training.count / training.targetCount) * 100)}%` }]} />
        </View>
        <View style={styles.metrics}>
          <View>
            <Text style={styles.metricLabel}>Elapsed</Text>
            <Text style={styles.metricValue}>{formatDuration(training.elapsedMs)}</Text>
          </View>
          <View>
            <Text style={styles.metricLabel}>Target</Text>
            <Text style={styles.metricValue}>{training.targetCount} balls</Text>
          </View>
        </View>
      </Card>

      {recovering && (
        <Card style={styles.recoveryCard}>
          <Text style={styles.recoveryTitle}>Connection interrupted</Text>
          <Text style={styles.recoveryText}>Device disconnected — session may still be active on the device.</Text>
          <ActionButton title="Reconnect device" onPress={handleReconnect} loading={reconnecting} variant="secondary" />
        </Card>
      )}
      {training.error && !recovering && <Text accessibilityRole="alert" style={styles.error}>{formatTrainingError(training.error)}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: { gap: 14, padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  status: { color: colors.textMuted, fontSize: 15 },
  count: { color: colors.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, lineHeight: 72 },
  countTarget: { color: colors.textMuted, fontSize: 30, fontWeight: '700', letterSpacing: 0 },
  countLabel: { color: colors.textMuted, fontSize: 15, marginTop: -10 },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  recoveryCard: { gap: 12, borderColor: '#f1d9a6', backgroundColor: colors.warningSoft },
  recoveryTitle: { color: colors.warning, fontSize: 17, fontWeight: '800' },
  recoveryText: { color: '#704000', fontSize: 15, lineHeight: 22 },
  error: { borderRadius: 14, padding: 16, color: colors.danger, backgroundColor: colors.dangerSoft, lineHeight: 22 },
});
