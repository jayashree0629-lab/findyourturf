// The ONE place that knows where the backend lives and how long we wait for it.
//
// To point the app at a different backend (for example a separate test backend), create
// mobile/.env.local containing:   EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
// No code change is needed. Never put secrets in EXPO_PUBLIC_ variables: the app is public.

const DEFAULT_API_URL = 'https://findyourturf-307m.onrender.com';

// Must be written as process.env.EXPO_PUBLIC_API_URL (dot notation) so Expo can inline it.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

// Give up on a request after this long (the free Render server can take ~45s to wake up).
export const REQUEST_TIMEOUT_MS = 60_000;

// If the first load is still waiting after this long, show the "server is waking up" message.
export const SLOW_RESPONSE_MS = 5_000;
