import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ResultField } from '../components/ResultField';
import { Screen } from '../components/Screen';
import { ActionButton, Card, ScreenTitle, colors } from '../components/ui';
import { useTraining } from '../features/training/TrainingProvider';
import { formatDuration } from '../features/training/labels';
import type { TrainingSession } from '../features/history/session-repository';

export function HistoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { getSession } = useTraining();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('A session ID is required.');
      return undefined;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    void getSession(id)
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [getSession, id]);

  return (
    <Screen>
      <ScreenTitle eyebrow="Saved result" title="Session detail" subtitle={session ? formatDate(session.completedAt) : 'Review a saved training session.'} />
      {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
      {error && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          This session could not be loaded. Please return to History and try again.
        </Text>
      )}
      {!loading && !error && session === null && (
        <Card style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Session unavailable</Text>
          <Text style={styles.helper}>This saved session is no longer available on this device.</Text>
        </Card>
      )}
      {!loading && !error && session !== null && (
        <Card style={styles.detailsCard}>
          <ResultField label="Final count" value={`${session.finalCount}/${session.targetCount}`} />
          <ResultField label="Duration" value={formatDuration(session.durationMs)} />
          <ResultField label="Started" value={formatDate(session.startedAt)} />
          <ResultField label="Completed" value={formatDate(session.completedAt)} />
          <ResultField label="Notes" value={session.notes || 'No notes'} />
          <ResultField label="Device" value={session.deviceName ?? 'Unknown device'} />
          <ResultField label="Status" value={formatSessionStatus(session.status)} />
        </Card>
      )}
      <ActionButton title="Back to History" onPress={() => router.replace('/history')} />
    </Screen>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatSessionStatus(status: TrainingSession['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'recovered':
      return 'Recovered';
    case 'cancelled':
      return 'Cancelled';
  }
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  emptyState: { gap: 8, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  error: { borderRadius: 14, padding: 16, color: colors.danger, backgroundColor: colors.dangerSoft, lineHeight: 22 },
  detailsCard: { paddingVertical: 4 },
});
