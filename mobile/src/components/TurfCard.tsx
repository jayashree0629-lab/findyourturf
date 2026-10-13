import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Turf } from '@/types/turf';
import { colors, radius, spacing } from '@/theme';
import { AppText, Badge, Button, Card } from './ui';

type Props = {
  turf: Turf;
  onPress?: () => void;
};

// One turf in the list: photo, name, area, tags, price and a Book button.
// Turfs without a price show "Price on request" and a "View details" button instead.
export function TurfCard({ turf, onPress }: Props) {
  // If a photo cannot load (bad network), show a neutral placeholder instead of a blank box.
  const [imageFailed, setImageFailed] = useState(false);
  const hasPrice = turf.pricePerHour !== null;
  const area = turf.area || 'Location not listed';

  return (
    <Card flush>
      {/* Tapping the photo or details opens the turf. The button below is separate,
          because a button must not sit inside another button. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${turf.name}, ${area}, ${hasPrice ? `${turf.pricePerHour} rupees per hour` : 'price on request'}`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.photoBox}>
          {imageFailed ? (
            <View style={styles.photoFallback}>
              <Ionicons name="image-outline" size={34} color={colors.placeholder} />
            </View>
          ) : (
            <Image
              source={{ uri: turf.image }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
              accessibilityIgnoresInvertColors
            />
          )}

          <View style={styles.sportPill}>
            <AppText variant="label" color={colors.primaryDark}>
              {turf.primarySport}
            </AppText>
          </View>

          {turf.rating !== null ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={12} color="#FBBF24" />
              <AppText variant="label" color={colors.onPrimary}>
                {turf.rating.toFixed(1)}
                {turf.reviewsCount > 0 ? ` (${turf.reviewsCount})` : ''}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <AppText variant="subheading" numberOfLines={1}>
            {turf.name}
          </AppText>

          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              {area}
            </AppText>
          </View>

          {turf.tags.length > 0 ? (
            <View style={styles.tags}>
              {turf.tags.map((tag) => (
                <Badge key={tag} label={tag} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View>
          <AppText variant="label" color={colors.textMuted}>
            {hasPrice ? 'STARTING FROM' : 'PRICE'}
          </AppText>
          {hasPrice ? (
            <View style={styles.price}>
              <AppText variant="title">₹{turf.pricePerHour}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {' '}
                / hour
              </AppText>
            </View>
          ) : (
            <AppText variant="subheading" style={styles.onRequest}>
              On request
            </AppText>
          )}
        </View>
        {hasPrice ? (
          <Button title="Book now" size="sm" icon="calendar-outline" onPress={onPress} />
        ) : (
          <Button title="View details" size="sm" variant="secondary" icon="information-circle-outline" onPress={onPress} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92 },
  flex: { flex: 1 },
  photoBox: { aspectRatio: 16 / 10, backgroundColor: colors.primarySoft },
  photo: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sportPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  ratingPill: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11, 16, 32, 0.72)',
  },
  body: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  price: { flexDirection: 'row', alignItems: 'baseline' },
  onRequest: { marginTop: 2 },
});
