// Lightweight, device-local user profile. No account / login yet — the
// profile (name, phone, email) lives in localStorage and is used to
// pre-fill and label bookings. Booking history made from this device is
// also cached here so the Profile screen can show "My Bookings".

const PROFILE_KEY = "fyt_profile";
const BOOKINGS_KEY = "fyt_bookings";
const NOTIF_SEEN_KEY = "fyt_notifications_seen_at";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function getProfile() {
  try {
    return safeParse(localStorage.getItem(PROFILE_KEY), null);
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — ignore */
  }
  return profile;
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export function getLocalBookings() {
  try {
    return safeParse(localStorage.getItem(BOOKINGS_KEY), []);
  } catch {
    return [];
  }
}

export function addLocalBooking(booking) {
  try {
    const all = getLocalBookings();
    all.unshift({ ...booking, savedAt: new Date().toISOString() });
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

// --- Quick visitor registration (first-open gate) ---------------------
// Separate from the checkout "profile" above: this only remembers whether
// this browser has completed the one-time Quick Registration screen.
const VISITOR_KEY = "fyt_visitor";

export function getVisitor() {
  try {
    return safeParse(localStorage.getItem(VISITOR_KEY), null);
  } catch {
    return null;
  }
}

export function isVisitorRegistered() {
  const v = getVisitor();
  return Boolean(v && v.visitorRegistered && v.visitorId);
}

// Who is using this device, for community features (chat, players, rewards…).
// Prefers the checkout profile, falls back to the quick-registration record.
// `phone` is empty for visitors registered before the phone was remembered.
export function getIdentity() {
  const profile = getProfile();
  const visitor = getVisitor();
  const name = (profile?.name || visitor?.name || "").trim();
  const phone = String(profile?.phone || visitor?.phone || "").replace(/\D/g, "").slice(-10);
  return { name, phone, ready: Boolean(name && /^[6-9]\d{9}$/.test(phone)) };
}

export function saveVisitor({ visitorId, name, phone }) {
  const record = { visitorRegistered: true, visitorId, name, phone };
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — ignore, the gate will just show again next time */
  }
  // Best-effort: also seed the checkout contact profile so a returning
  // visitor doesn't have to retype their details at booking time. Only if
  // nothing is saved there yet — never overwrite an existing profile.
  try {
    if (!getProfile()) {
      saveProfile({ name, phone, email: "" });
    }
  } catch {
    /* ignore */
  }
  return record;
}

// --- Notification "unread" tracking ---
export function getNotificationsSeenAt() {
  try {
    return localStorage.getItem(NOTIF_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markNotificationsSeen() {
  try {
    localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}
