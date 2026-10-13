import { useQuery } from '@tanstack/react-query';

import { fetchTurfs } from '@/services/turfs';

// Loads the turf list. Screens get: data, isPending (first load), isError, error, refetch.
export function useTurfs() {
  return useQuery({ queryKey: ['turfs'], queryFn: fetchTurfs });
}
