import { API_URL } from "./config";

function getAuthToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

async function request(path, options = {}) {
  try {
    const isBodyPresent = Boolean(options.body);
    const headers = {
      ...(isBodyPresent ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Token missing/expired/invalid -> drop it and bounce to login.
        localStorage.removeItem("token");
        localStorage.removeItem("admin");
        window.dispatchEvent(new Event("admin-auth-changed"));
        const error = new Error(
          data.message || "Session expired. Please sign in again."
        );
        error.status = 401;
        error.data = data;
        throw error;
      }

      if (response.status === 404) {
        // Our controllers return JSON ({ success:false, error/message });
        // Express's own "no such route" 404 has no JSON body -> the backend is
        // running an older build that doesn't have this endpoint yet.
        const knownRoute = Boolean(
          data && (data.success === false || data.error || data.message)
        );
        const error = new Error(
          data.error ||
            data.message ||
            "This action isn't available on the server. Restart or redeploy the backend to load the latest changes."
        );
        error.status = 404;
        error.routeMissing = !knownRoute;
        error.data = data;
        throw error;
      }

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
    // Network / unreachable backend error
    const netError = new Error(
      "Backend server is not running. Please start the backend on port 5000."
    );
    netError.status = 0;
    netError.isNetworkError = true;
    throw netError;
  }
}

// ==========================================
// EVENTS API
// ==========================================

export async function getEvents() {
  const data = await request("/api/events");
  return data.events || [];
}

export async function getEventById(eventId) {
  const data = await request(`/api/events/${eventId}`);
  return data.event || null;
}

export async function createEvent(payload) {
  return request("/api/events", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateEvent(eventId, payload) {
  return request(`/api/events/${eventId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteEvent(eventId) {
  return request(`/api/events/${eventId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ==========================================
// TOURNAMENTS & MATCHES API
// ==========================================

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
      // 404 is a normal state when tournament has not been created yet
      return {
        teams: [],
        matches: [],
        winner1: null,
        winner2: null,
        champion: null,
        notCreatedYet: true,
      };
    }
    throw err;
  }
}

export async function assignTeams(eventId, teams) {
  return request(`/api/tournaments/${eventId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ teams }),
  });
}

export async function generateFirstRound(eventId, teams) {
  return request(`/api/tournaments/${eventId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      teams,
      generateRound1: true,
    }),
  });
}

export async function createMatch(eventId, match) {
  return request(`/api/tournaments/${eventId}/match`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(match),
  });
}

export async function getAdminLiveMatches() {
  return request("/api/live-matches/admin", {
    headers: authHeaders(),
  });
}

export async function createLiveMatch(match) {
  return request("/api/live-matches", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(match),
  });
}

// --- Live scoring console -------------------------------------------------
export async function getLiveMatchDetails(matchId) {
  return request(`/api/live-matches/admin/${matchId}`, {
    headers: authHeaders(),
  });
}

export async function updateLiveMatchState(matchId, payload) {
  return request(`/api/live-matches/${matchId}/state`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function scoreLiveBall(matchId, payload) {
  return request(`/api/live-matches/${matchId}/score`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function undoLiveBall(matchId) {
  return request(`/api/live-matches/${matchId}/undo`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function completeLiveMatch(matchId) {
  return request(`/api/live-matches/${matchId}/complete`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function updateLiveMatch(matchId, payload) {
  return request(`/api/live-matches/${matchId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLiveMatch(matchId) {
  return request(`/api/live-matches/${matchId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function updateMatch(eventId, matchId, match) {
  return request(`/api/tournaments/${eventId}/match/${matchId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(match),
  });
}

export async function deleteMatch(eventId, matchId) {
  return request(`/api/tournaments/${eventId}/match/${matchId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function editTeam(eventId, oldName, newName) {
  return request(`/api/tournaments/${eventId}/team`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      oldName,
      newName,
    }),
  });
}

export async function deleteTeam(eventId, teamName) {
  return request(
    `/api/tournaments/${eventId}/team/${encodeURIComponent(teamName)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
}

export async function updateLiveScore(eventId, matchId, score) {
  return request(`/api/tournaments/${eventId}/match/${matchId}/score`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(score),
  });
}

export async function setMatchWinner(eventId, matchId, winner) {
  return request(`/api/tournaments/${eventId}/match/${matchId}/winner`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ winner }),
  });
}

// ==========================================
// DASHBOARD STATS API
// ==========================================

export async function getDashboardStats() {
  const data = await request("/api/dashboard/stats", {
    headers: authHeaders(),
  });
  return data.stats || null;
}

// ==========================================
// BOOKINGS API
// ==========================================

export async function getBookings() {
  const data = await request("/api/bookings", {
    headers: authHeaders(),
  });
  return Array.isArray(data) ? data : [];
}

export async function cancelBooking(bookingId) {
  return request(`/api/bookings/${bookingId}/cancel`, {
    method: "PUT",
    headers: authHeaders(),
  });
}

// ==========================================
// USERS API
// ==========================================

export async function getUsers() {
  const data = await request("/api/users");
  return Array.isArray(data) ? data : [];
}

// ==========================================
// TURFS API
// ==========================================

export async function getTurfs() {
  const data = await request("/api/turfs");
  return Array.isArray(data) ? data : [];
}

export async function createTurf(payload) {
  return request("/api/turfs", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTurf(turfId, payload) {
  return request(`/api/turfs/${turfId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteTurf(turfId, { force = false } = {}) {
  return request(`/api/turfs/${turfId}${force ? "?force=1" : ""}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ==========================================
// ADD-ONS API
// ==========================================

export async function getAddons() {
  const data = await request("/api/addons/all", { headers: authHeaders() });
  return Array.isArray(data) ? data : [];
}

export async function getAddonBookings() {
  const data = await request("/api/addons/bookings", { headers: authHeaders() });
  return Array.isArray(data) ? data : [];
}

export async function createAddon(payload) {
  return request("/api/addons", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAddon(id, payload) {
  return request(`/api/addons/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAddon(id, { force = false } = {}) {
  return request(`/api/addons/${id}${force ? "?force=1" : ""}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ==========================================
// VISITORS API (quick registration)
// ==========================================

export async function getVisitors({ page = 1, limit = 200 } = {}) {
  const data = await request(`/api/visitors?page=${page}&limit=${limit}`, {
    headers: authHeaders(),
  });
  return {
    visitors: Array.isArray(data.visitors) ? data.visitors : [],
    total: data.total || 0,
    page: data.page || page,
    limit: data.limit || limit,
  };
}

// ==========================================
// BUSINESS INSIGHTS / BOOKINGS (extra)
// ==========================================
export async function getInsights() {
  return request("/api/insights/summary", { headers: authHeaders() });
}

export async function confirmBooking(bookingId) {
  return request(`/api/bookings/${bookingId}/confirm`, {
    method: "PUT",
    headers: authHeaders(),
  });
}

// ==========================================
// COUPONS
// ==========================================
export async function getCoupons() {
  const data = await request("/api/coupons", { headers: authHeaders() });
  return data.coupons || [];
}

export async function createCoupon(payload) {
  const data = await request("/api/coupons", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return data.coupon;
}

export async function setCouponActive(id, active) {
  return request(`/api/coupons/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ active }),
  });
}

export async function deleteCoupon(id) {
  return request(`/api/coupons/${id}`, { method: "DELETE", headers: authHeaders() });
}

// ==========================================
// STUDENT / CORPORATE ZONE ENQUIRIES
// ==========================================
export async function getZoneEnquiries() {
  const data = await request("/api/zones/enquiries", { headers: authHeaders() });
  return data.enquiries || [];
}

export async function updateZoneEnquiry(id, payload) {
  const data = await request(`/api/zones/enquiries/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return data.enquiry;
}

export async function approveZoneEnquiry(id, payload) {
  const data = await request(`/api/zones/enquiries/${id}/approve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return data.enquiry;
}

export async function deleteZoneEnquiry(id) {
  return request(`/api/zones/enquiries/${id}`, { method: "DELETE", headers: authHeaders() });
}

// ==========================================
// COMMUNITY MODERATION
// ==========================================
export async function getAdminPosts() {
  const data = await request("/api/community/admin-posts", { headers: authHeaders() });
  return data.posts || [];
}

export async function createAnnouncement({ text, sport, pinned }) {
  return request("/api/community/admin-posts", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text, sport, pinned }),
  });
}

export async function updateAdminPost(id, payload) {
  return request(`/api/community/admin-posts/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminPost(id) {
  return request(`/api/community/admin-posts/${id}`, { method: "DELETE", headers: authHeaders() });
}

export async function getAdminPlayerRequests() {
  const data = await request("/api/players/admin/all", { headers: authHeaders() });
  return data.requests || [];
}

export async function setPlayerRequestStatus(id, status) {
  return request(`/api/players/admin/${id}/status`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function getAdminChatMessages(room) {
  const q = room ? `?room=${encodeURIComponent(room)}` : "";
  const data = await request(`/api/chat/admin-messages${q}`, { headers: authHeaders() });
  return data.messages || [];
}

export async function deleteChatMessage(id) {
  return request(`/api/chat/admin-messages/${id}`, { method: "DELETE", headers: authHeaders() });
}
