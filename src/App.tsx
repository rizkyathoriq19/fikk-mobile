import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Fikk Mobile</Text>
        <Text style={styles.status}>BLE foundation ready</Text>
        <Text style={styles.note}>
          Physical device validation waits for the target firmware profile and hardware.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  status: {
    marginTop: 12,
    fontSize: 18,
  },
  note: {
    maxWidth: 320,
    marginTop: 12,
    textAlign: 'center',
    color: '#5f6368',
  },
});
