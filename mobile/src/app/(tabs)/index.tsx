import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ServerWakingCard } from '@/components/ServerWakingCard';
import { TurfCard } from '@/components/TurfCard';
import { TurfCardSkeleton } from '@/components/TurfCardSkeleton';
import { AppText, Button, Card, Chip, EmptyState, Screen, SearchBar, SectionHeader } from '@/components/ui';
import { useSlowLoading } from '@/hooks/useSlowLoading';
import { useTurfs } from '@/hooks/useTurfs';
import { colors, radius, spacing } from '@/theme';
import type { Turf } from '@/types/turf';
import { describeError } from '@/utils/describeError';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('All');

  // Real turfs from the backend. isPending = first load, still waiting for the first answer.
  const { data, isPending, isError, error, refetch, isRefetching } = useTurfs();
  const waking = useSlowLoading(isPending);

  // The sport chips come from the data itself, so a new sport in the database shows up here.
  const sportOptions = useMemo(
    () => [...new Set((data ?? []).flatMap((t) => t.sports))].sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const activeSport = sport === 'All' || sportOptions.includes(sport) ? sport : 'All';

  // Filter by the chip and the search text; turfs that can be booked online come first.
  const turfs = useMemo<Turf[]>(() => {
    const text = query.trim().toLowerCase();
    return (data ?? [])
      .filter((t) => {
        const sportOk = activeSport === 'All' || t.sports.includes(activeSport);
        const textOk =
          text === '' ||
          t.name.toLowerCase().includes(text) ||
          t.area.toLowerCase().includes(text) ||
          t.sports.some((s) => s.toLowerCase().includes(text));
        return sportOk && textOk;
      })
      .sort((a, b) => Number(b.pricePerHour !== null) - Number(a.pricePerHour !== null));
  }, [data, query, activeSport]);

  function clearFilters() {
    setQuery('');
    setSport('All');
  }

  // Opens the Turf Details screen for the tapped turf (only its id travels in the link).
  function onTurfPress(turf: Turf) {
    router.push({ pathname: '/turf/[id]', params: { id: turf.id } });
  }

  const failure = isError ? describeError(error) : null;

  function renderList() {
    if (isPending) {
      return (
        <View style={styles.list}>
          {waking ? <ServerWakingCard /> : null}
          <TurfCardSkeleton />
          <TurfCardSkeleton />
          <TurfCardSkeleton />
        </View>
      );
    }

    if (failure && !data) {
      return (
        <Card>
          <EmptyState
            icon={failure.icon}
            title={failure.title}
            message={failure.message}
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </Card>
      );
    }

    if (data && data.length === 0) {
      return (
        <Card>
          <EmptyState icon="football-outline" title="No turfs yet" message="Turfs will appear here once they are added." />
        </Card>
      );
    }

    if (turfs.length === 0) {
      return (
        <Card>
          <EmptyState
            icon="search-outline"
            title="No turfs found"
            message="Try a different name, area or sport."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        </Card>
      );
    }

    return (
      <View style={styles.list}>
        {failure ? (
          <Card style={styles.staleBanner}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={styles.flex}>
              Couldn&apos;t refresh. Showing the last loaded turfs.
            </AppText>
            <Button title="Retry" size="sm" variant="ghost" onPress={() => void refetch()} />
          </Card>
        ) : null}
        {turfs.map((turf) => (
          <TurfCard key={turf.id} turf={turf} onPress={() => onTurfPress(turf)} />
        ))}
      </View>
    );
  }

  let subtitle = 'Loading turfs…';
  if (data) subtitle = `${turfs.length} ${turfs.length === 1 ? 'turf' : 'turfs'} found`;
  else if (failure) subtitle = 'Could not load turfs';

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      {/* Welcome header */}
      <View style={styles.header}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.onPrimary} />
        </LinearGradient>
        <View style={styles.headerText}>
          <AppText variant="caption" color={colors.textMuted}>
            {greeting()} 👋
          </AppText>
          <AppText variant="title" numberOfLines={1}>
            Ready to play?
          </AppText>
          <View style={styles.location}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <AppText variant="caption" color={colors.textSecondary}>
              Coimbatore
            </AppText>
          </View>
        </View>
        <Pressable
          onPress={() => Alert.alert('Notifications', 'Notifications are added in a later step.')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Search */}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search turf, area or sport" />

      {/* Sport filters (scroll sideways) */}
      {sportOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
          <Chip label="All" selected={activeSport === 'All'} onPress={() => setSport('All')} />
          {sportOptions.map((s) => (
            <Chip key={s} label={s} selected={activeSport === s} onPress={() => setSport(s)} />
          ))}
        </ScrollView>
      ) : null}

      {/* Turf list */}
      <View style={styles.listHeader}>
        <SectionHeader title="Turfs in Coimbatore" subtitle={subtitle} />
      </View>

      {renderList()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bell: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Let the chips row run edge to edge while the rest of the page keeps its side padding.
  chipsScroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  listHeader: { marginTop: spacing.xs },
  list: { gap: spacing.lg },
  flex: { flex: 1 },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.warningSoft,
  },
});
