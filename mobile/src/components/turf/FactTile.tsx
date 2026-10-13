import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
};

// A small "at a glance" box, for example: clock icon, "Opening hours", "6:00 AM – 11:00 PM".
export function FactTile({ icon, label, value }: Props) {
  return (
    <Card style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.texts}>
        <AppText variant="caption" color={colors.textMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Two tiles per row; they grow to share the row evenly.
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
});
