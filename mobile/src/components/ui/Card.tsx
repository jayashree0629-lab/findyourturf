import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

type Props = ViewProps & {
  // Remove the inner padding (used by cards that start with a full-width photo).
  flush?: boolean;
};

// White rounded card with a soft shadow.
export function Card({ flush = false, style, ...rest }: Props) {
  return <View style={[styles.card, !flush && styles.padded, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  padded: { padding: spacing.lg },
});
