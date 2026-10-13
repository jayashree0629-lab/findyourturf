import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Card } from './ui';

// A grey, gently pulsing placeholder shaped like a turf card, shown while turfs load.
export function TurfCardSkeleton() {
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
    // Hidden from screen readers: the "loading" message above the list is what gets announced.
    <Card flush importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={{ opacity: pulse }}>
        <View style={styles.photo} />
        <View style={styles.body}>
          <View style={[styles.line, { width: '70%', height: 18 }]} />
          <View style={[styles.line, { width: '40%' }]} />
          <View style={styles.tags}>
            <View style={[styles.line, styles.tag]} />
            <View style={[styles.line, styles.tag]} />
          </View>
          <View style={styles.footer}>
            <View style={[styles.line, { width: 90, height: 28 }]} />
            <View style={[styles.line, { width: 110, height: 40, borderRadius: radius.md }]} />
          </View>
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 16 / 10, backgroundColor: colors.border },
  body: { padding: spacing.lg, gap: spacing.md },
  line: { height: 14, borderRadius: radius.sm, backgroundColor: colors.border },
  tags: { flexDirection: 'row', gap: spacing.sm },
  tag: { width: 80, height: 24, borderRadius: radius.pill },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
});
