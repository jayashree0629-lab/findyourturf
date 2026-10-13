import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './http';

// Rules for every data request in the app:
// - Data stays "fresh" for 5 minutes, so switching tabs or coming back to a screen does not
//   ask the server again.
// - Many screens asking for the same data at once share ONE request.
// - A failed request is retried once (only for network/server problems), not endlessly.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => failureCount < 1 && error instanceof ApiError && error.retryable,
      retryDelay: 3_000,
    },
  },
});
