import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AccessibilityState, GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

export const colors = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceMuted: '#eef3fb',
  border: '#d9e2f0',
  text: '#10213f',
  textMuted: '#60708c',
  primary: '#2457d6',
  primaryPressed: '#1c46b2',
  primarySoft: '#e3ebff',
  success: '#16794c',
  successSoft: '#dcf7e9',
  warning: '#a15c00',
  warningSoft: '#fff1d6',
  danger: '#b42318',
  dangerSoft: '#fee8e6',
} as const;

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

type ActionButtonProps = {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ActionButtonProps) {
  const accessibilityState: AccessibilityState = { busy: loading, disabled: disabled || loading };
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${variant}Button`],
        pressed && !disabled && !loading && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading && <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#ffffff' : colors.primary} />}
      <Text style={[styles.buttonText, styles[`${variant}Text`]]}>{loading ? `${title}…` : title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <View style={[styles.statusPill, styles[`${tone}Pill`]]}>
      <View style={[styles.statusDot, styles[`${tone}Dot`]]} />
      <Text style={[styles.statusText, styles[`${tone}StatusText`]]}>{label}</Text>
    </View>
  );
}

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 6 },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, shadowColor: '#172b4d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  button: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 18 },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { backgroundColor: colors.surfaceMuted },
  outlineButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dangerButton: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { fontSize: 16, fontWeight: '800' },
  primaryText: { color: '#ffffff' },
  secondaryText: { color: colors.primary },
  outlineText: { color: colors.text },
  dangerText: { color: '#ffffff' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  successPill: { backgroundColor: colors.successSoft },
  warningPill: { backgroundColor: colors.warningSoft },
  dangerPill: { backgroundColor: colors.dangerSoft },
  neutralPill: { backgroundColor: colors.surfaceMuted },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  successDot: { backgroundColor: colors.success },
  warningDot: { backgroundColor: colors.warning },
  dangerDot: { backgroundColor: colors.danger },
  neutralDot: { backgroundColor: colors.textMuted },
  statusText: { fontSize: 13, fontWeight: '800' },
  successStatusText: { color: colors.success },
  warningStatusText: { color: colors.warning },
  dangerStatusText: { color: colors.danger },
  neutralStatusText: { color: colors.textMuted },
});
