import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchTurf, summaryToDetail } from '@/services/turfs';
import type { Turf } from '@/types/turf';

// Loads one turf's full details.
// - If the turf is already in the cached list, its basic info is shown immediately
//   (turf.isComplete is false) while the full record loads.
// - If loading the full record fails, we keep showing that basic info instead of an empty error.
export function useTurf(id: string | undefined) {
  const queryClient = useQueryClient();
  const fromList = () => queryClient.getQueryData<Turf[]>(['turfs'])?.find((t) => t.id === id);

  const query = useQuery({
    queryKey: ['turf', id],
    queryFn: () => fetchTurf(id as string),
    enabled: Boolean(id),
    placeholderData: () => {
      const listed = fromList();
      return listed ? summaryToDetail(listed) : undefined;
    },
  });

  const listed = fromList();
  const turf = query.data ?? (query.isError && listed ? summaryToDetail(listed) : undefined);

  return {
    turf,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
