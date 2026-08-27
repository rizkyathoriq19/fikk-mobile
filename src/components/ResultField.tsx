import { StyleSheet, Text, View } from 'react-native';

type ResultFieldProps = {
  label: string;
  value: string;
};

export function ResultField({ label, value }: ResultFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 4, color: '#0f172a' },
});
