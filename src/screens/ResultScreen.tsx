import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { COMPLETION_REASONS } from '../protocol/constants';
import { Screen } from '../components/Screen';
import { useTraining } from '../features/training/TrainingProvider';

export function ResultScreen() {
  const router = useRouter();
  const { snapshot } = useTraining();
  const result = snapshot.result;

  if (snapshot.state !== 'completed' || result === null) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Result
        </Text>
        <Text style={styles.helper}>No completed training session is available.</Text>
        <View style={styles.button}>
          <Button title="Back to Home" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Training Result
      </Text>
      <Text style={styles.subtitle}>Device-authoritative session result</Text>

      <View style={styles.hero}>
        <Text style={styles.heroValue}>
          {result.count}/{snapshot.targetCount}
        </Text>
        <Text style={styles.heroLabel}>balls completed</Text>
      </View>

      <ResultField label="Authoritative duration" value={`${result.durationMs} ms`} />
      <ResultField label="Started" value={snapshot.startedAt ?? '—'} />
      <ResultField label="Completed" value={snapshot.completedAt ?? '—'} />
      <ResultField label="Notes" value={snapshot.notes || 'No notes'} />
      <ResultField label="Device" value={snapshot.deviceName ?? 'Unknown device'} />
      <ResultField label="Completion reason" value={formatCompletionReason(result.reason)} />

      <View style={styles.button}>
        <Button title="Back to Home" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatCompletionReason(reason: number): string {
  switch (reason) {
    case COMPLETION_REASONS.TARGET_REACHED:
      return 'Target reached';
    case COMPLETION_REASONS.STOPPED:
      return 'Stopped';
    case COMPLETION_REASONS.DEVICE_ERROR:
      return 'Device error';
    default:
      return `Unknown (${reason})`;
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 6, color: '#64748b' },
  hero: { marginTop: 24, padding: 20, borderRadius: 12, backgroundColor: '#eff6ff' },
  heroValue: { fontSize: 40, fontWeight: '800', color: '#1d4ed8' },
  heroLabel: { marginTop: 4, color: '#1e3a8a' },
  field: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 4, color: '#0f172a' },
  helper: { marginTop: 18, color: '#64748b' },
  button: { marginTop: 28 },
});
