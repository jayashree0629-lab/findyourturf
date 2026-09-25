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

// --- My bookings (player self-service) ---
export async function getMyBookingsDetailed({ phone, email } = {}) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (phone) params.set("phone", phone);
  if (![...params].length) return { bookings: [], cancelWindowHours: 2 };
  const data = await request(`/api/bookings/mine?${params.toString()}`);
  return { bookings: data.bookings || [], cancelWindowHours: data.cancelWindowHours || 2 };
}

export async function cancelMyBooking(bookingId, phone) {
  return request(`/api/bookings/${bookingId}/cancel-mine`, {
    method: "PUT",
    body: JSON.stringify({ phone }),
  });
}

// --- Coupons & rewards ---
export async function validateCoupon({ code, phone, subtotal }) {
  return request("/api/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, phone, subtotal }),
  });
}

export async function getMyCoupons(phone) {
  const data = await request(`/api/coupons/mine?phone=${encodeURIComponent(phone)}`);
  return data.coupons || [];
}

export async function getRewardsSummary(phone) {
  return request(`/api/rewards/summary?phone=${encodeURIComponent(phone)}`);
}

export async function redeemReward({ phone, rewardId }) {
  return request("/api/rewards/redeem", {
    method: "POST",
    body: JSON.stringify({ phone, rewardId }),
  });
}

// --- Find players ---
export async function getPlayerRequests({ sport, area, phone, mine } = {}) {
  const p = new URLSearchParams();
  if (sport && sport !== "All") p.set("sport", sport);
  if (area) p.set("area", area);
  if (phone) p.set("phone", phone);
  if (mine) p.set("mine", "1");
  const data = await request(`/api/players${p.toString() ? `?${p}` : ""}`);
  return data.requests || [];
}

export async function createPlayerRequest(payload) {
  const data = await request("/api/players", { method: "POST", body: JSON.stringify(payload) });
  return data.request;
}

export async function joinPlayerRequest(id, { name, phone }) {
  return request(`/api/players/${id}/join`, { method: "POST", body: JSON.stringify({ name, phone }) });
}

export async function leavePlayerRequest(id, phone) {
  return request(`/api/players/${id}/leave`, { method: "POST", body: JSON.stringify({ phone }) });
}

export async function closePlayerRequest(id, phone) {
  return request(`/api/players/${id}/close`, { method: "POST", body: JSON.stringify({ phone }) });
}

export async function getPlayerContacts(id, phone) {
  return request(`/api/players/${id}/contacts?phone=${encodeURIComponent(phone)}`);
}

// --- Chat ---
export async function getChatRooms() {
  const data = await request("/api/chat/rooms");
  return data.rooms || [];
}

export async function getChatSenderId(phone) {
  const data = await request(`/api/chat/me?phone=${encodeURIComponent(phone)}`);
  return data.senderId;
}

export async function getChatMessages(room, { phone, before } = {}) {
  const p = new URLSearchParams();
  if (phone) p.set("phone", phone);
  if (before) p.set("before", before);
  return request(`/api/chat/${encodeURIComponent(room)}/messages${p.toString() ? `?${p}` : ""}`);
}

export async function sendChatMessage(room, { name, phone, text }) {
  const data = await request(`/api/chat/${encodeURIComponent(room)}/messages`, {
    method: "POST",
    body: JSON.stringify({ name, phone, text }),
  });
  return data.message;
}

// --- Community feed ---
export async function getCommunityPosts({ sport, page = 1, phone } = {}) {
  const p = new URLSearchParams({ page: String(page) });
  if (sport && sport !== "All") p.set("sport", sport);
  if (phone) p.set("phone", phone);
  return request(`/api/community/posts?${p}`);
}

export async function createCommunityPost(payload) {
  const data = await request("/api/community/posts", { method: "POST", body: JSON.stringify(payload) });
  return data.post;
}

export async function toggleLikePost(id, phone) {
  const data = await request(`/api/community/posts/${id}/like`, { method: "POST", body: JSON.stringify({ phone }) });
  return data.post;
}

export async function commentOnPost(id, { name, phone, text }) {
  const data = await request(`/api/community/posts/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ name, phone, text }),
  });
  return data.post;
}

export async function deleteMyPost(id, phone) {
  return request(`/api/community/posts/${id}/delete`, { method: "POST", body: JSON.stringify({ phone }) });
}

// --- Student / Corporate zones ---
export async function submitZoneEnquiry(payload) {
  const data = await request("/api/zones/enquiries", { method: "POST", body: JSON.stringify(payload) });
  return data.enquiry;
}

export async function getMyZoneEnquiries(phone) {
  const data = await request(`/api/zones/enquiries/mine?phone=${encodeURIComponent(phone)}`);
  return data.enquiries || [];
}
