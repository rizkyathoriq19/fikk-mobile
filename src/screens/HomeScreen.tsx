import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Card, ScreenTitle, StatusPill, colors } from '../components/ui';
import { Screen } from '../components/Screen';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus } from '../features/bluetooth/labels';
import type { TrainingSession } from '../features/history/session-repository';
import { useTraining } from '../features/training/TrainingProvider';
import { formatDuration, formatTrainingError } from '../features/training/labels';

export function HomeScreen() {
  const router = useRouter();
  const { snapshot: bluetooth } = useBluetooth();
  const { snapshot: training, start, listSessions } = useTraining();
  const [notes, setNotes] = useState('');
  const [latestSession, setLatestSession] = useState<TrainingSession | null>(null);
  const [latestSessionError, setLatestSessionError] = useState(false);
  const ready = bluetooth.status === 'ready' && bluetooth.deviceState?.state === 0;
  const recovering = training.state === 'recovering';
  const busy = recovering || training.state === 'starting' || training.state === 'active';

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void listSessions()
        .then((sessions) => {
          if (mounted) {
            setLatestSession(sessions[0] ?? null);
            setLatestSessionError(false);
          }
        })
        .catch(() => {
          if (mounted) {
            setLatestSessionError(true);
          }
        });
      return () => {
        mounted = false;
      };
    }, [listSessions]),
  );

  useEffect(() => {
    if (training.state === 'active' || training.state === 'completed') {
      router.replace(training.state === 'active' ? '/active' : '/result');
    }
  }, [router, training.state]);

  const handleStart = async () => {
    if (!ready) {
      router.push('/settings?returnTo=training');
      return;
    }
    try {
      await start(notes);
      router.push('/active');
    } catch {
      // The training snapshot exposes the user-facing error.
    }
  };

  return (
    <Screen>
      <ScreenTitle eyebrow="Fikk Mobile" title="Train with focus" subtitle="A simple way to start, track, and review your device training." />

      <Card style={styles.statusCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Device status</Text>
          <StatusPill label={ready ? 'Ready' : 'Not ready'} tone={ready ? 'success' : 'warning'} />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.statusValue}>
          {formatConnectionStatus(bluetooth)}
        </Text>
        {!ready && <Text style={styles.helper}>Connect a ready device in Settings before starting.</Text>}
      </Card>

      <Card style={styles.startCard}>
        <Text style={styles.cardLabel}>New session</Text>
        <Text style={styles.sectionTitle}>Ready when you are?</Text>
        <Text style={styles.helper}>Complete 6 balls. Your Fikk device records the official count and duration.</Text>
        <TextInput
          accessibilityLabel="Training notes"
          accessibilityHint="Optional multiline notes for this training session, up to 500 characters"
          multiline
          maxLength={500}
          onChangeText={setNotes}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textMuted}
          style={styles.notes}
          textAlignVertical="top"
          value={notes}
        />
        <Text style={styles.counter}>{notes.length}/500</Text>
        <ActionButton
          accessibilityLabel={ready ? 'Start training' : 'Open Bluetooth setup'}
          disabled={busy}
          loading={training.state === 'starting'}
          title={ready ? 'Start Training' : 'Connect Device'}
          onPress={handleStart}
        />
      </Card>

      {latestSession && (
        <Card style={styles.latestCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Last session</Text>
            <Text style={styles.date}>{formatDate(latestSession.completedAt)}</Text>
          </View>
          <Text style={styles.latestCount}>{latestSession.finalCount}/{latestSession.targetCount}</Text>
          <Text style={styles.helper}>{formatDuration(latestSession.durationMs)} · {latestSession.notes || 'No notes'}</Text>
        </Card>
      )}

      {recovering && (
        <Text accessibilityLiveRegion="polite" style={styles.recovery}>
          Device disconnected — session may still be active on the device. Reconnecting and synchronizing…
        </Text>
      )}
      {latestSessionError && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            The latest session could not be loaded.
          </Text>
          <ActionButton title="Open History" variant="secondary" onPress={() => router.push('/history')} />
        </View>
      )}
      {training.error && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          {formatTrainingError(training.error)}
        </Text>
      )}
      {training.state === 'starting' && <Text style={styles.helper}>Waiting for device acknowledgement…</Text>}
    </Screen>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  statusCard: { gap: 10 },
  startCard: { gap: 12 },
  latestCard: { gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  statusValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  notes: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.background, color: colors.text, padding: 14, fontSize: 16, lineHeight: 22 },
  counter: { color: colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: -6 },
  date: { color: colors.textMuted, fontSize: 13 },
  latestCount: { color: colors.primary, fontSize: 34, fontWeight: '800' },
  recovery: { borderRadius: 14, padding: 16, color: colors.warning, backgroundColor: colors.warningSoft, lineHeight: 22 },
  errorBox: { gap: 12, borderRadius: 14, padding: 16, backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, lineHeight: 22 },
  error: { borderRadius: 14, padding: 16, color: colors.danger, backgroundColor: colors.dangerSoft, lineHeight: 22 },
});
