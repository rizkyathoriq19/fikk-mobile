import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { ActionButton, ScreenTitle, colors } from '../components/ui';
import { useTraining } from '../features/training/TrainingProvider';
import type { TrainingSession } from '../features/history/session-repository';
import { formatDuration } from '../features/training/labels';

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
      <ScreenTitle eyebrow="Your progress" title="History" subtitle="Saved sessions, available offline." />

      {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>History could not be loaded. Please try again.</Text>
          <ActionButton title="Try again" onPress={() => setReloadKey((value) => value + 1)} variant="secondary" />
        </View>
      )}
      {!loading && !error && sessions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.helper}>Complete your first training session and it will appear here.</Text>
        </View>
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
          <View style={styles.rowHeader}>
            <Text style={styles.date}>{formatDate(session.completedAt)}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.notes} numberOfLines={2}>{notesPreview(session.notes)}</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>{session.finalCount}/{session.targetCount} balls</Text>
            <Text style={styles.summaryText}>{formatDuration(session.durationMs)}</Text>
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
  loading: { marginTop: 24 },
  emptyState: { gap: 8, borderRadius: 18, padding: 20, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  errorBox: { gap: 14, borderRadius: 18, padding: 18, backgroundColor: colors.dangerSoft },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  row: { gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, backgroundColor: colors.surface },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.text, fontSize: 16, fontWeight: '800' },
  chevron: { color: colors.primary, fontSize: 28, lineHeight: 28 },
  notes: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  summaryText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
