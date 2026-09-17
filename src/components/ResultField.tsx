import { StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

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
  field: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 16, lineHeight: 22, marginTop: 4 },
});
