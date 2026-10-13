import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from '@/services/queryClient';
import { colors } from '@/theme';

// Root of the app. Every screen sits inside this Stack; the tab bar is the (tabs) group.
// QueryClientProvider gives every screen access to the shared data cache.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </QueryClientProvider>
  );
}
