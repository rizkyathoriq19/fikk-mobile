import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ResultField } from '../components/ResultField';
import { Screen } from '../components/Screen';
import { ActionButton, Card, ScreenTitle, colors } from '../components/ui';
import { useTraining } from '../features/training/TrainingProvider';
import { formatCompletionReason, formatDuration } from '../features/training/labels';

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
      .catch(() => {
        setActionError('Unable to save this result. Please try again.');
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
      .catch(() => {
        setActionError('Unable to discard this result. Please try again.');
        setBusy(false);
        setAction(null);
      });
  };

  if (snapshot.state !== 'completed' || result === null) {
    return (
      <Screen>
        <ScreenTitle eyebrow="Training result" title="No result yet" subtitle="Complete a session to see its device-recorded result here." />
        <ActionButton title="Back to Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle eyebrow="Training result" title="Session complete" subtitle="Your Fikk device recorded this result." />

      <Card style={styles.hero}>
        <Text style={styles.heroValue}>
          {result.count}/{snapshot.targetCount}
        </Text>
        <Text style={styles.heroLabel}>balls completed</Text>
      </Card>

      <Card style={styles.detailsCard}>
        <ResultField label="Duration" value={formatDuration(result.durationMs)} />
        <ResultField label="Started" value={formatDate(snapshot.startedAt)} />
        <ResultField label="Completed" value={formatDate(snapshot.completedAt)} />
        <ResultField label="Notes" value={snapshot.notes || 'No notes'} />
        <ResultField label="Device" value={snapshot.deviceName ?? 'Unknown device'} />
        <ResultField label="Completion" value={formatCompletionReason(result.reason)} />
      </Card>

      {actionError && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          {actionError}
        </Text>
      )}
      <View style={styles.actions}>
        <ActionButton
          accessibilityLabel="Save training result"
          disabled={busy}
          loading={action === 'save'}
          title="Save Result"
          onPress={handleSave}
        />
        <ActionButton
          accessibilityLabel="Discard training result"
          disabled={busy}
          loading={action === 'discard'}
          title="Discard"
          variant="danger"
          onPress={() =>
            Alert.alert('Discard this result?', 'This result will not be saved to History.', [
              { text: 'Keep Result', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: handleDiscard },
            ])
          }
        />
      </View>
    </Screen>
  );
}

function formatDate(value: string | null): string {
  if (value === null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  hero: { gap: 4, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  heroValue: { color: colors.primary, fontSize: 52, fontWeight: '800', letterSpacing: -1 },
  heroLabel: { color: '#18398d', fontSize: 15, fontWeight: '700' },
  detailsCard: { paddingVertical: 4 },
  error: { borderRadius: 14, padding: 16, color: colors.danger, backgroundColor: colors.dangerSoft, lineHeight: 22 },
  actions: { gap: 12 },
});
