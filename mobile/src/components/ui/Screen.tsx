import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type Props = {
  children: ReactNode;
  // Turn off scrolling for screens that manage their own list.
  scroll?: boolean;
  // Optional pull-down-to-refresh (give both to turn it on).
  refreshing?: boolean;
  onRefresh?: () => void;
};

// Wraps every screen: light background, keeps content below the phone's status bar,
// scrolls, and stays tidy on tablets by limiting the content width.
export function Screen({ children, scroll = true, refreshing = false, onRefresh }: Props) {
  const insets = useSafeAreaInsets();
  const content = <View style={styles.inner}>{children}</View>;

  if (!scroll) {
    return <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>{content}</View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        ) : undefined
      }
    >
      {content}
    </ScrollView>
  );
}

type HeaderProps = { title: string; subtitle?: string };

// Big title shown at the top of tab screens other than Home.
export function ScreenHeader({ title, subtitle }: HeaderProps) {
  return (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color={colors.textMuted}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  header: { gap: spacing.xs },
});
