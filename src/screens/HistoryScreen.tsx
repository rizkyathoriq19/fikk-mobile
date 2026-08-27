import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Screen';

export function HistoryScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        History
      </Text>
      <Text style={styles.helper}>Saved training sessions will appear here.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  helper: { marginTop: 18, color: '#64748b' },
});
