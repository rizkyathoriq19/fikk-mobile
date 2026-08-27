import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { ResultField } from '../components/ResultField';
import { Screen } from '../components/Screen';
import { useTraining } from '../features/training/TrainingProvider';
import { formatCompletionReason } from '../features/training/labels';

export function ResultScreen() {
  const router = useRouter();
  const { snapshot, saveResult, discardResult } = useTraining();
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<'save' | 'discard' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const result = snapshot.result;

  const handleSave = () => {
    setBusy(true);
    setAction('save');
    setActionError(null);
    void saveResult()
      .then(() => router.replace('/history'))
      .catch((error: unknown) => {
        setActionError(toError(error).message);
        setBusy(false);
        setAction(null);
      });
  };

  const handleDiscard = () => {
    setBusy(true);
    setAction('discard');
    setActionError(null);
    void discardResult()
      .then(() => router.replace('/'))
      .catch((error: unknown) => {
        setActionError(toError(error).message);
        setBusy(false);
        setAction(null);
      });
  };

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

      {actionError && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          {actionError}
        </Text>
      )}
      <View style={styles.button}>
        <Button
          accessibilityLabel="Save training result"
          accessibilityState={{ busy: action === 'save', disabled: busy }}
          disabled={busy}
          title={action === 'save' ? 'Saving…' : 'Save Result'}
          onPress={handleSave}
        />
      </View>
      <View style={styles.secondaryButton}>
        <Button
          accessibilityLabel="Discard training result"
          accessibilityState={{ busy: action === 'discard', disabled: busy }}
          disabled={busy}
          title={action === 'discard' ? 'Discarding…' : 'Discard'}
          onPress={handleDiscard}
        />
      </View>
    </Screen>
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 6, color: '#64748b' },
  hero: { marginTop: 24, padding: 20, borderRadius: 12, backgroundColor: '#eff6ff' },
  heroValue: { fontSize: 40, fontWeight: '800', color: '#1d4ed8' },
  heroLabel: { marginTop: 4, color: '#1e3a8a' },
  helper: { marginTop: 18, color: '#64748b' },
  error: { marginTop: 18, padding: 12, color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 8 },
  button: { marginTop: 28 },
  secondaryButton: { marginTop: 12 },
});
