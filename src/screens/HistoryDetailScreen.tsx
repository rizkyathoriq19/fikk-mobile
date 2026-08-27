import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { ResultField } from '../components/ResultField';
import { Screen } from '../components/Screen';
import { useTraining } from '../features/training/TrainingProvider';
import { formatCompletionReason } from '../features/training/labels';
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
      <Text accessibilityRole="header" style={styles.title}>
        Session Detail
      </Text>
      {loading && <ActivityIndicator style={styles.loading} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && session === null && (
        <Text style={styles.helper}>This session is no longer available.</Text>
      )}
      {!loading && !error && session !== null && (
        <>
          <Text style={styles.subtitle}>{formatDate(session.completedAt)}</Text>
          <ResultField label="Final count" value={`${session.finalCount}/${session.targetCount}`} />
          <ResultField label="Authoritative duration" value={`${session.durationMs} ms`} />
          <ResultField label="Started" value={session.startedAt} />
          <ResultField label="Completed" value={session.completedAt} />
          <ResultField label="Notes" value={session.notes || 'No notes'} />
          <ResultField label="Device" value={session.deviceName ?? 'Unknown device'} />
          <ResultField label="Device ID" value={session.deviceKey} />
          <ResultField label="Status" value={session.status} />
          <ResultField label="Protocol version" value={String(session.protocolVersion)} />
        </>
      )}
      <View style={styles.button}>
        <Button title="Back to History" onPress={() => router.replace('/history')} />
      </View>
    </Screen>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 6, color: '#64748b' },
  loading: { marginTop: 24 },
  helper: { marginTop: 24, color: '#64748b' },
  error: { marginTop: 20, padding: 12, color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 8 },
  button: { marginTop: 28 },
});
