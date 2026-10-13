import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type Props = {
  photos: string[];
  width: number;
  // Shown as a small label when the photo is a stock picture, not this turf's own.
  illustrative?: boolean;
};

// Full-width photo area at the top of the details screen. Swipe sideways when there are
// several photos. A photo that fails to load shows a neutral placeholder instead.
export function PhotoGallery({ photos, width, illustrative = false }: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const height = Math.round(width * 0.78);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ width, height, backgroundColor: colors.primarySoft }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEnabled={photos.length > 1}
        accessibilityLabel={`Turf photos, ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
      >
        {photos.map((uri, i) => (
          <View key={`${uri}-${i}`} style={{ width, height }}>
            {failed[i] ? (
              <View style={styles.fallback}>
                <Ionicons name="image-outline" size={44} color={colors.placeholder} />
              </View>
            ) : (
              <Image
                source={{ uri }}
                style={styles.photo}
                contentFit="cover"
                transition={250}
                onError={() => setFailed((prev) => ({ ...prev, [i]: true }))}
                accessibilityIgnoresInvertColors
              />
            )}
          </View>
        ))}
      </ScrollView>

      {illustrative ? (
        <View style={styles.illustrative} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText variant="label" color={colors.onPrimary}>
            Illustrative photo
          </AppText>
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {photos.map((uri, i) => (
            <View key={`${uri}-dot-${i}`} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Sits above the rounded content sheet that overlaps the bottom of the photo.
  illustrative: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.xxxl + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11, 16, 32, 0.6)',
  },
  dots: {
    position: 'absolute',
    bottom: spacing.xxxl + spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  dotActive: { width: 20, backgroundColor: colors.onPrimary },
});
