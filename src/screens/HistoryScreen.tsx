import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useTraining } from '../features/training/TrainingProvider';
import type { TrainingSession } from '../features/history/session-repository';

export function HistoryScreen() {
  const router = useRouter();
  const { listSessions } = useTraining();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      setError(null);
      void listSessions()
        .then((nextSessions) => {
          if (mounted) {
            setSessions(nextSessions);
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
    }, [listSessions, reloadKey]),
  );

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        History
      </Text>
      <Text style={styles.subtitle}>Saved sessions available offline.</Text>

      {loading && <ActivityIndicator style={styles.loading} />}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry" onPress={() => setReloadKey((value) => value + 1)} />
        </View>
      )}
      {!loading && !error && sessions.length === 0 && (
        <Text style={styles.helper}>No saved training sessions yet.</Text>
      )}
      {!loading && !error && sessions.map((session) => (
        <Pressable
          key={session.id}
          accessibilityLabel={`Open training session from ${formatDate(session.completedAt)}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: false }}
          onPress={() => router.push(`/history/${session.id}`)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.date}>{formatDate(session.completedAt)}</Text>
          <Text style={styles.notes}>{notesPreview(session.notes)}</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {session.finalCount}/{session.targetCount} balls
            </Text>
            <Text style={styles.summaryText}>{session.durationMs} ms</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function notesPreview(notes: string | null): string {
  if (!notes) {
    return 'No notes';
  }
  const preview = notes.replace(/\s+/g, ' ').trim();
  return preview.length > 72 ? `${preview.slice(0, 72)}…` : preview;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 6, color: '#64748b' },
  loading: { marginTop: 24 },
  helper: { marginTop: 24, color: '#64748b' },
  errorBox: { marginTop: 20, padding: 12, borderRadius: 8, backgroundColor: '#fee2e2' },
  error: { marginBottom: 12, color: '#b91c1c' },
  row: { marginTop: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#ffffff' },
  rowPressed: { backgroundColor: '#eff6ff' },
  date: { fontWeight: '700', color: '#0f172a' },
  notes: { marginTop: 8, color: '#475569' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  summaryText: { fontSize: 13, fontWeight: '600', color: '#1d4ed8' },
});
