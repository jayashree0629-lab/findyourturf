import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

const palette = {
  primary: { bg: colors.primary, text: colors.onPrimary, border: colors.primary },
  success: { bg: colors.success, text: colors.onPrimary, border: colors.success },
  secondary: { bg: colors.surface, text: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', text: colors.primary, border: 'transparent' },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
}: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.small : styles.medium,
        { backgroundColor: p.bg, borderColor: p.border },
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.text} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={p.text} /> : null}
          <AppText variant={size === 'sm' ? 'label' : 'bodyStrong'} color={p.text}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  // 48px is a comfortable minimum touch target on phones.
  medium: { minHeight: 48, paddingHorizontal: spacing.xl },
  small: { minHeight: 40, paddingHorizontal: spacing.lg },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
