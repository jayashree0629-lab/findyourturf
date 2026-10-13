import { useEffect, useState } from 'react';

import { SLOW_RESPONSE_MS } from '@/config';

// Becomes true when something has been loading for longer than expected.
// Used to say "the server is waking up" instead of leaving a spinner with no explanation.
export function useSlowLoading(loading: boolean, delayMs: number = SLOW_RESPONSE_MS) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [loading, delayMs]);

  return loading && slow;
}
