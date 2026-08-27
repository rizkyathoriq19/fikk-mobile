import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useBluetooth } from '../features/bluetooth/BluetoothProvider';
import { formatConnectionStatus } from '../features/bluetooth/labels';
import { useTraining } from '../features/training/TrainingProvider';

export function HomeScreen() {
  const router = useRouter();
  const { snapshot: bluetooth } = useBluetooth();
  const { snapshot: training, start } = useTraining();
  const [notes, setNotes] = useState('');
  const ready = bluetooth.status === 'ready' && bluetooth.deviceState?.state === 0;
  const busy = training.state === 'starting' || training.state === 'active';

  const handleStart = () => {
    if (!ready) {
      router.push('/settings');
      return;
    }
    void start(notes).catch(() => undefined);
  };

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Fikk Mobile
      </Text>
      <Text style={styles.sectionTitle}>Home</Text>
      <Text style={styles.label}>Device status</Text>
      <Text style={styles.value}>{formatConnectionStatus(bluetooth)}</Text>

      <Text style={styles.label}>Training notes</Text>
      <TextInput
        accessibilityLabel="Training notes"
        multiline
        maxLength={500}
        onChangeText={setNotes}
        placeholder="Optional notes"
        style={styles.notes}
        textAlignVertical="top"
        value={notes}
      />
      <Text style={styles.counter}>{notes.length}/500</Text>

      <View style={styles.spacer} />
      <Button
        disabled={busy}
        title={ready ? (busy ? 'Starting…' : 'Start Training') : 'Connect device first'}
        onPress={handleStart}
      />
      {!ready && <Text style={styles.helper}>Connect a ready device from Settings first.</Text>}
      {training.error && <Text style={styles.error}>{training.error}</Text>}
      {training.state === 'starting' && <Text style={styles.helper}>Waiting for device acknowledgement…</Text>}
      {training.state === 'active' && (
        <Text style={styles.progress}>
          Training active: {training.count}/{training.targetCount} · {training.elapsedMs} ms
        </Text>
      )}
      {training.state === 'completed' && <Text style={styles.progress}>Training complete.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  sectionTitle: { marginTop: 28, fontSize: 22, fontWeight: '700', color: '#0f172a' },
  label: { marginTop: 18, fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 6, color: '#0f172a' },
  notes: { minHeight: 96, marginTop: 6, padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#ffffff', color: '#0f172a' },
  counter: { marginTop: 4, textAlign: 'right', fontSize: 12, color: '#64748b' },
  spacer: { height: 16 },
  helper: { marginTop: 10, color: '#64748b' },
  error: { marginTop: 12, padding: 12, color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 8 },
  progress: { marginTop: 16, fontWeight: '600', color: '#0f172a' },
});
