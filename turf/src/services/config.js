function getBackendBaseUrl() {
  // Explicit override always wins (Vercel sets this in production).
  if (import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Local `npm run dev` with no env file -> talk to the local backend.
  if (import.meta.env && import.meta.env.DEV) {
    return "http://localhost:5000";
  }

  // Production fallback if VITE_API_URL was not set at build time.
  return "https://findyourturf-307m.onrender.com";
}

export const API_URL = getBackendBaseUrl();
export const SOCKET_URL = getBackendBaseUrl();
