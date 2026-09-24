import { API_URL } from "./config";

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || data.error || `Request failed (${response.status})`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    const netError = new Error(
      "Unable to reach server. Please ensure backend is running."
    );
    netError.status = 0;
    netError.isNetworkError = true;
    throw netError;
  }
}

export async function getEvents() {
  const data = await request("/api/events");
  return data.events || [];
}

export async function getEvent(eventId) {
  const data = await request(`/api/events/${eventId}`);
  return data.event;
}

export async function getTournament(eventId) {
  try {
    const data = await request(`/api/tournaments/${eventId}`);
    return (
      data.tournament || {
        teams: [],
        matches: [],
        winner1: null,
        winner2: null,
        champion: null,
      }
    );
  } catch (err) {
    if (err.status === 404) {
      return {
        teams: [],
        matches: [],
        winner1: null,
        winner2: null,
        champion: null,
      };
    }
    throw err;
  }
}

export async function getTurfs() {
  const data = await request("/api/turfs");
  return data;
}

export async function getTurf(turfId) {
  const data = await request(`/api/turfs/${turfId}`);
  return data;
}

export async function checkAvailability(turfId, date, startTime, endTime) {
  const data = await request(`/api/bookings/availability?turf=${turfId}&bookingDate=${date}&startTime=${startTime}&endTime=${endTime}`);
  return data;
}

export async function getBookedSlots(turfId, date) {
  try {
    const data = await request(
      `/api/bookings/booked-slots?turf=${turfId}&date=${date}`
    );
    return data.bookedSlots || [];
  } catch {
    return [];
  }
}

export async function getTurfWeather(turfId, date) {
  try {
    const data = await request(
      `/api/turfs/${turfId}/weather${date ? `?date=${date}` : ""}`
    );
    return data;
  } catch {
    return { available: false };
  }
}

// Authoritative price + split breakdown from the server (add-ons included).
export async function getBookingQuote({ turf, players, useFloodlight, equipment, addons, date, startTime }) {
  return request("/api/bookings/quote", {
    method: "POST",
    body: JSON.stringify({ turf, players, useFloodlight, equipment, addons, date, startTime }),
  });
}

// --- Add-ons ---
export async function getAddons({ type, sport, turfSports } = {}) {
  const p = new URLSearchParams();
  if (type) p.set("type", type);
  if (sport) p.set("sport", sport);
  if (turfSports && turfSports.length) p.set("turfSports", turfSports.join(","));
  try {
    const data = await request(`/api/addons${p.toString() ? `?${p}` : ""}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function checkAddonAvailability({ serviceId, date, startTime, quantity = 1 }) {
  try {
    const p = new URLSearchParams({ serviceId, date, startTime, quantity: String(quantity) });
    return await request(`/api/addons/availability?${p}`);
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

export async function getAddonAvailabilityBatch({ date, startTime }) {
  try {
    const p = new URLSearchParams({ date, startTime });
    return await request(`/api/addons/availability-batch?${p}`);
  } catch {
    return {};
  }
}

export async function getMyBookings({ email, phone } = {}) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (phone) params.set("phone", phone);
  if (![...params].length) return [];
  try {
    const data = await request(`/api/bookings/mine?${params.toString()}`);
    return data.bookings || [];
  } catch {
    return [];
  }
}

export async function createBooking(bookingData) {
  const data = await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify(bookingData)
  });
  return data;
}

export async function markSplitPayment(bookingId, phone) {
  return request(`/api/bookings/${bookingId}/split-payments`, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

// --- Live matches ---
export async function getLiveMatches() {
  const data = await request("/api/live-matches/live");
  return data.matches || [];
}

export async function getUpcomingMatches() {
  const data = await request("/api/live-matches/upcoming");
  return data.matches || [];
}

export async function getMatchResults() {
  const data = await request("/api/live-matches/results");
  return data.matches || [];
}

export async function getMatchScorecard(matchId) {
  const data = await request(`/api/live-matches/${matchId}`);
  // `type` is "LIVE" or "COMPLETED"; ballEvents is present for live matches.
  return {
    type: data.type || (data.match ? "LIVE" : null),
    match: data.match || null,
    ballEvents: data.ballEvents || [],
  };
}

// --- Quick visitor registration ---
export async function registerVisitor({ name, phone }) {
  const data = await request("/api/visitors/register", {
    method: "POST",
    body: JSON.stringify({ name, phone }),
  });
  return data.visitor;
}
