import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

// Pulsing grey placeholder. `withHeader` also draws the title lines (used when we know nothing
// about the turf yet); without it, only the lower sections are drawn (used while the full
// record loads and we already show the basic info).
export function TurfDetailSkeleton({ withHeader }: { withHeader: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    // Hidden from screen readers; a loading message is announced elsewhere.
    <Animated.View
      style={[styles.wrap, { opacity: pulse }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {withHeader ? (
        <View style={styles.block}>
          <View style={[styles.line, { width: '35%', height: 24, borderRadius: radius.pill }]} />
          <View style={[styles.line, { width: '80%', height: 26 }]} />
          <View style={[styles.line, { width: '55%' }]} />
        </View>
      ) : null}
      <Card style={styles.block}>
        <View style={[styles.line, { width: '30%' }]} />
        <View style={[styles.line, { width: '45%', height: 28 }]} />
      </Card>
      <View style={styles.tiles}>
        <View style={styles.tile} />
        <View style={styles.tile} />
      </View>
      <View style={styles.block}>
        <View style={[styles.line, { width: '40%', height: 18 }]} />
        <View style={styles.line} />
        <View style={[styles.line, { width: '85%' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  block: { gap: spacing.md },
  line: { height: 14, borderRadius: radius.sm, backgroundColor: colors.border },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, height: 60, borderRadius: radius.lg, backgroundColor: colors.border },
});
