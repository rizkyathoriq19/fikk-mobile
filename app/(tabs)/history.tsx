import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HistoryRoute() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          History
        </Text>
        <Text style={styles.helper}>Saved training sessions will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  helper: { marginTop: 18, color: '#64748b' },
});
