import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText, Card } from './ui';

// Explains a long first load. The free hosting puts the server to sleep when it is unused.
export function ServerWakingCard() {
  return (
    <Card accessibilityLiveRegion="polite" style={styles.card}>
      <ActivityIndicator color={colors.primary} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong">Waking up the server…</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Our server sleeps when it hasn&apos;t been used for a while. The first load can take up to a minute. Thanks
          for waiting!
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.primarySoft },
  texts: { flex: 1, gap: spacing.xs },
});
