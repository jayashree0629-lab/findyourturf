import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServerWakingCard } from '@/components/ServerWakingCard';
import { FactTile } from '@/components/turf/FactTile';
import { PhotoGallery } from '@/components/turf/PhotoGallery';
import { TurfDetailSkeleton } from '@/components/turf/TurfDetailSkeleton';
import { AppText, Badge, Button, Card, EmptyState } from '@/components/ui';
import { useSlowLoading } from '@/hooks/useSlowLoading';
import { useTurf } from '@/hooks/useTurf';
import { ApiError } from '@/services/http';
import { colors, radius, shadows, spacing } from '@/theme';
import { describeError } from '@/utils/describeError';
import { hoursLabel, mapsLink, phoneLink } from '@/utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

const MAX_WIDTH = 720; // keeps the page tidy on tablets

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open that", 'No app on this phone can open it.');
  }
}

export default function TurfDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { turf, isPending, isError, error, refetch } = useTurf(id);
  const waking = useSlowLoading(isPending && !turf);
  const [barHeight, setBarHeight] = useState(96);

  const width = Math.min(windowWidth, MAX_WIDTH);

  // Back one screen; if this page was opened directly (nothing to go back to), go Home.
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const backButton = (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      style={[styles.backButton, { top: insets.top + spacing.sm }]}
    >
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </Pressable>
  );

  // ---- Nothing to show yet: still loading, or failed with no basic info to fall back on ----
  if (!turf) {
    const notFound = !id || (error instanceof ApiError && error.status === 404);
    const failure = notFound ? describeError(new ApiError('client', 'Not found', 404)) : isError ? describeError(error) : null;

    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + spacing.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.column, { width }]}>
            {failure ? (
              <Card>
                <EmptyState
                  icon={failure.icon}
                  title={failure.title}
                  message={failure.message}
                  actionLabel={notFound ? 'Go back' : 'Try again'}
                  onAction={notFound ? goBack : () => void refetch()}
                />
              </Card>
            ) : (
              <>
                {waking ? <ServerWakingCard /> : null}
                <TurfDetailSkeleton withHeader />
              </>
            )}
          </View>
        </ScrollView>
        {backButton}
      </View>
    );
  }

  // ---- We have a turf: work out what to show (only what the data actually contains) ----
  const hasPrice = turf.pricePerHour !== null;
  const hours = hoursLabel(turf.openingTime, turf.closingTime);
  const locationLine = turf.area || turf.address || 'Location not listed';
  const hasCoords = turf.latitude !== null && turf.longitude !== null;
  const showAddress = turf.address !== '' && turf.address !== locationLine;

  const facts: { icon: IconName; label: string; value: string }[] = [];
  if (hours) facts.push({ icon: 'time-outline', label: 'Opening hours', value: hours });
  if (turf.slotMinutes) facts.push({ icon: 'hourglass-outline', label: 'Slot length', value: `${turf.slotMinutes} min` });
  if (turf.roof) facts.push({ icon: 'umbrella-outline', label: 'Roof', value: turf.roof });
  if (turf.floodlightCharge) {
    facts.push({ icon: 'bulb-outline', label: 'Floodlights', value: `+₹${turf.floodlightCharge} / hour` });
  }

  const hasContact = showAddress || turf.contactNumber !== '' || hasCoords;
  const hasMoreInfo =
    facts.length > 0 ||
    turf.description !== '' ||
    turf.facilities.length > 0 ||
    turf.equipment.length > 0 ||
    hasContact;
  const loadingMore = !turf.isComplete && !isError;
  const couldNotLoadMore = !turf.isComplete && isError;

  function onBook() {
    Alert.alert('Coming soon', 'Online booking is added in a later step.');
  }

  // ---- The button on the bottom bar ----
  let action: ReactNode;
  if (!turf.bookable) {
    action = <Button title="Not available" variant="secondary" disabled />;
  } else if (hasPrice) {
    action = <Button title="Book now" icon="calendar-outline" onPress={onBook} />;
  } else if (turf.contactNumber) {
    action = (
      <Button title="Call venue" icon="call-outline" onPress={() => void openLink(phoneLink(turf.contactNumber))} />
    );
  } else {
    action = <Button title="Not bookable online" variant="secondary" disabled />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: barHeight + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.column, { width }]}>
          <PhotoGallery photos={turf.gallery} width={width} illustrative={!turf.hasOwnPhoto} />
          {/* Darkens the top of the photo so the status bar and back button stay readable. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
            style={[styles.topShade, { height: insets.top + 90 }]}
            pointerEvents="none"
          />

          <View style={styles.sheet}>
            {/* Title */}
            <View style={styles.titleBlock}>
              <View style={styles.badges}>
                {(turf.sports.length > 0 ? turf.sports : ['Turf']).map((sport) => (
                  <Badge key={sport} label={sport} tone="primary" />
                ))}
              </View>
              <AppText variant="title" accessibilityRole="header">
                {turf.name}
              </AppText>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                <AppText variant="body" color={colors.textMuted} style={styles.flex}>
                  {locationLine}
                </AppText>
              </View>
              {turf.rating !== null ? (
                <View style={styles.row}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <AppText variant="bodyStrong">{turf.rating.toFixed(1)}</AppText>
                  {turf.reviewsCount > 0 ? (
                    <AppText variant="body" color={colors.textMuted}>
                      ({turf.reviewsCount} {turf.reviewsCount === 1 ? 'review' : 'reviews'})
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </View>

            {!turf.bookable ? (
              <Card style={styles.notice}>
                <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
                <AppText variant="caption" color={colors.warning} style={styles.flex}>
                  This turf isn&apos;t available for booking right now.
                </AppText>
              </Card>
            ) : null}

            {/* Price */}
            <Card style={styles.priceCard}>
              <View>
                <AppText variant="label" color={colors.textMuted}>
                  {hasPrice ? 'STARTING FROM' : 'PRICE'}
                </AppText>
                {hasPrice ? (
                  <View style={styles.priceRow}>
                    <AppText variant="display">₹{turf.pricePerHour}</AppText>
                    <AppText variant="body" color={colors.textMuted}>
                      {' '}
                      / hour
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="title">Price on request</AppText>
                )}
              </View>
              {!hasPrice ? (
                <AppText variant="caption" color={colors.textMuted}>
                  Contact the venue for pricing and booking.
                </AppText>
              ) : null}
            </Card>

            {/* More details: skeleton while loading, a note if loading failed, else the real data */}
            {loadingMore ? <TurfDetailSkeleton withHeader={false} /> : null}

            {couldNotLoadMore ? (
              <Card style={styles.notice}>
                <Ionicons name="warning-outline" size={22} color={colors.warning} />
                <AppText variant="caption" color={colors.warning} style={styles.flex}>
                  Couldn&apos;t load all the details. Showing basic info.
                </AppText>
                <Button title="Retry" size="sm" variant="ghost" onPress={() => void refetch()} />
              </Card>
            ) : null}

            {turf.isComplete && facts.length > 0 ? (
              <View style={styles.tiles}>
                {facts.map((fact) => (
                  <FactTile key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} />
                ))}
              </View>
            ) : null}

            {turf.description !== '' ? (
              <View style={styles.section}>
                <AppText variant="heading" accessibilityRole="header">
                  About
                </AppText>
                <AppText variant="body" color={colors.textSecondary}>
                  {turf.description}
                </AppText>
              </View>
            ) : null}

            {turf.facilities.length > 0 ? (
              <View style={styles.section}>
                <AppText variant="heading" accessibilityRole="header">
                  Facilities
                </AppText>
                <View style={styles.badges}>
                  {turf.facilities.map((facility) => (
                    <Badge key={facility} label={facility} tone="success" icon="checkmark" />
                  ))}
                </View>
              </View>
            ) : null}

            {turf.equipment.length > 0 ? (
              <View style={styles.section}>
                <AppText variant="heading" accessibilityRole="header">
                  Equipment on rent
                </AppText>
                <Card style={styles.list}>
                  {turf.equipment.map((item, i) => (
                    <View key={`${item.name}-${i}`} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                      <AppText variant="body" style={styles.flex}>
                        {item.name}
                      </AppText>
                      <AppText variant="bodyStrong" color={item.rentalCharge > 0 ? colors.text : colors.success}>
                        {item.rentalCharge > 0 ? `₹${item.rentalCharge}` : 'Free'}
                      </AppText>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {hasContact ? (
              <View style={styles.section}>
                <AppText variant="heading" accessibilityRole="header">
                  Contact &amp; location
                </AppText>
                <Card style={styles.contactCard}>
                  {showAddress ? (
                    <View style={styles.row}>
                      <Ionicons name="location-outline" size={18} color={colors.primary} />
                      <AppText variant="body" style={styles.flex}>
                        {turf.address}
                      </AppText>
                    </View>
                  ) : null}
                  {turf.contactNumber ? (
                    <View style={styles.row}>
                      <Ionicons name="call-outline" size={18} color={colors.primary} />
                      <AppText variant="body" style={styles.flex}>
                        {turf.contactNumber}
                      </AppText>
                    </View>
                  ) : null}
                  {turf.contactNumber || hasCoords ? (
                    <View style={styles.contactActions}>
                      {turf.contactNumber ? (
                        <Button
                          title="Call"
                          size="sm"
                          variant="secondary"
                          icon="call-outline"
                          onPress={() => void openLink(phoneLink(turf.contactNumber))}
                        />
                      ) : null}
                      {hasCoords ? (
                        <Button
                          title="Directions"
                          size="sm"
                          variant="secondary"
                          icon="navigate-outline"
                          onPress={() => void openLink(mapsLink(turf.latitude as number, turf.longitude as number))}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              </View>
            ) : null}

            {turf.isComplete && !hasMoreInfo ? (
              <Card style={styles.notice}>
                <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
                <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
                  No extra details have been added for this turf yet.
                </AppText>
              </Card>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {backButton}

      {/* Bottom bar: price on the left, main action on the right */}
      <View
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.barInner}>
          <View style={styles.flex}>
            <AppText variant="caption" color={colors.textMuted}>
              {hasPrice ? 'From' : 'Price'}
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {hasPrice ? `₹${turf.pricePerHour} / hour` : 'On request'}
            </AppText>
          </View>
          {action}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  column: { alignSelf: 'center' },
  flex: { flex: 1 },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  // The white-ish sheet that overlaps the bottom of the photo with rounded corners.
  sheet: {
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  titleBlock: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priceCard: { gap: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { gap: spacing.md },
  list: { padding: 0 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  listRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  contactCard: { gap: spacing.md },
  contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, width: '100%', maxWidth: MAX_WIDTH },
});
