import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import EmptyState from "../components/common/EmptyState";
import { SkeletonCard, SkeletonTable } from "../components/common/Skeleton";
import Modal from "../components/common/Modal";
import LiveMatches from "./LiveMatches";
import TurfManagement from "./TurfManagement";
import AddonsManagement from "./AddonsManagement";
import VisitorsManagement from "./VisitorsManagement";
import BookingsManagement from "./BookingsManagement";
import CouponsManagement from "./CouponsManagement";
import EnquiriesManagement from "./EnquiriesManagement";
import CommunityManagement from "./CommunityManagement";
import BusinessInsights from "../components/common/BusinessInsights";
import {
  IconCalendar,
  IconTrophy,
  IconUsers,
  IconMatch,
  IconLive,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconMapPin,
  IconClock,
  IconCricket,
  IconFootball,
  IconSparkles,
  IconMedal,
  IconCrown,
  IconRefresh,
  IconArrowLeft,
  IconEye,
  IconShield,
} from "../components/common/Icons";
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getTournament,
  assignTeams,
  generateFirstRound,
  editTeam,
  deleteTeam,
  createMatch,
  updateMatch,
  deleteMatch,
  updateLiveScore,
  setMatchWinner,
  getDashboardStats,
  getBookings,
  cancelBooking,
  getUsers,
  getInsights,
} from "../services/api";
import { socket } from "../services/socket";
import { getAdmin } from "../services/auth";

const ROUNDS = ["Round 1", "Round 2", "Semi Final", "Final"];

const emptyEventForm = {
  eventName: "",
  sport: "Cricket",
  eventDate: "",
  teamSize: "",
  location: "",
  registrationDeadline: "",
  firstPrize: "",
  secondPrize: "",
  thirdPrize: "",
  entryFee: "",
  maxTeams: "",
  description: "",
  rules: "",
  keyHighlights: "",
  venueName: "",
  contactPhone: "",
  eventImage: "",
  registrationLink: "",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const admin = getAdmin();

  // Active Tab navigation
  const [activeTab, setActiveTab] = useState("overview");

  // Global search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Data states
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState("");
  const [users, setUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);

  // Selected tournament state
  const [selectedEventId, setSelectedEventId] = useState("");
  const [tournament, setTournament] = useState({ teams: [], matches: [] });
  const [activeRoundTab, setActiveRoundTab] = useState("Round 1");

  // Tournament forms
  const [newTeamName, setNewTeamName] = useState("");
  const [newMatchRound, setNewMatchRound] = useState("Round 1");
  const [newMatchTeam1, setNewMatchTeam1] = useState("");
  const [newMatchTeam2, setNewMatchTeam2] = useState("");

  // Modals & form state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState({ old: "", new: "" });

  // Loading & feedback states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [generatingRound, setGeneratingRound] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load Initial Data
  useEffect(() => {
    loadAllData();

    const handleNewEvent = (newEvent) => {
      setEvents((prev) => [newEvent, ...prev]);
    };

    const handleEventUpdated = (updatedEvent) => {
      setEvents((prev) =>
        prev.map((e) => (e._id === updatedEvent._id ? updatedEvent : e))
      );
    };

    const handleEventDeleted = ({ id }) => {
      setEvents((prev) => prev.filter((e) => e._id !== id));
    };

    const handleTournamentUpdated = (updatedTourney) => {
      if (
        updatedTourney &&
        (updatedTourney.event === selectedEventId ||
          updatedTourney.event?._id === selectedEventId)
      ) {
        setTournament(updatedTourney);
      }
    };

    socket.on("new-event", handleNewEvent);
    socket.on("event-updated", handleEventUpdated);
    socket.on("event-deleted", handleEventDeleted);
    socket.on("tournament-updated", handleTournamentUpdated);

    return () => {
      socket.off("new-event", handleNewEvent);
      socket.off("event-updated", handleEventUpdated);
      socket.off("event-deleted", handleEventDeleted);
      socket.off("tournament-updated", handleTournamentUpdated);
    };
  }, [selectedEventId]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError("");

      const [eventsData, statsData, bookingsData, usersData, insightsData] =
        await Promise.allSettled([
          getEvents(),
          getDashboardStats(),
          getBookings(),
          getUsers(),
          getInsights(),
        ]);

      if (insightsData.status === "fulfilled") {
        setInsights(insightsData.value);
        setInsightsError("");
      } else {
        setInsightsError(insightsData.reason?.message || "Could not load.");
      }

      if (eventsData.status === "fulfilled") {
        const evs = Array.isArray(eventsData.value) ? eventsData.value : [];
        setEvents(evs);
        if (evs.length > 0 && !selectedEventId) {
          setSelectedEventId(evs[0]._id);
          loadTournamentData(evs[0]._id);
        }
      }

      if (statsData.status === "fulfilled") {
        setDashboardStats(statsData.value);
      }

      if (bookingsData.status === "fulfilled") {
        setBookings(Array.isArray(bookingsData.value) ? bookingsData.value : []);
      }

      if (usersData.status === "fulfilled") {
        setUsers(Array.isArray(usersData.value) ? usersData.value : []);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  async function loadTournamentData(eventId) {
    if (!eventId) return;
    try {
      const data = await getTournament(eventId);
      setTournament(data || { teams: [], matches: [] });
    } catch (err) {
      console.error("Failed to load tournament:", err);
    }
  }

  function handleEventSelect(eventId) {
    setSelectedEventId(eventId);
    loadTournamentData(eventId);
  }

  function notifySuccess(msg) {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 5000);
  }

  function notifyError(err) {
    setError(err);
    setMessage("");
    setTimeout(() => setError(""), 6000);
  }

  // -------------------------------------------------------------------------
  // EVENT CRUD HANDLERS
  // -------------------------------------------------------------------------

  function openCreateEventModal() {
    setEditingEventId(null);
    setEventForm(emptyEventForm);
    setEventModalOpen(true);
  }

  function openEditEventModal(event) {
    setEditingEventId(event._id);
    setEventForm({
      eventName: event.eventName || "",
      sport: event.sport || "Cricket",
      eventDate: formatInputDate(event.eventDate),
      teamSize: event.teamSize || "",
      location: event.location || "",
      registrationDeadline: formatInputDate(event.registrationDeadline),
      firstPrize: event.firstPrize || "",
      secondPrize: event.secondPrize || "",
      thirdPrize: event.thirdPrize || "",
      entryFee: event.entryFee || "",
      maxTeams: event.maxTeams || "",
      description: event.description || "",
      rules: event.rules || "",
      keyHighlights: event.keyHighlights || "",
      venueName: event.venueName || "",
      contactPhone: event.contactPhone || "",
      eventImage: event.eventImage || "",
      registrationLink: event.registrationLink || "",
    });
    setEventModalOpen(true);
  }

  async function handleEventFormSubmit(e) {
    e.preventDefault();

    if (
      !eventForm.eventName ||
      !eventForm.eventDate ||
      !eventForm.teamSize ||
      !eventForm.location ||
      !eventForm.registrationDeadline
    ) {
      notifyError("Please fill all required event fields.");
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        ...eventForm,
        firstPrize: Number(eventForm.firstPrize || 0),
        secondPrize: Number(eventForm.secondPrize || 0),
        thirdPrize: Number(eventForm.thirdPrize || 0),
        entryFee: Number(eventForm.entryFee || 0),
        maxTeams: Number(eventForm.maxTeams || 16),
      };

      if (editingEventId) {
        await updateEvent(editingEventId, payload);
        notifySuccess("Event updated successfully!");
      } else {
        await createEvent(payload);
        notifySuccess("New event published successfully!");
      }

      setEventModalOpen(false);
      setEventForm(emptyEventForm);
      setEditingEventId(null);
      await loadAllData();
    } catch (err) {
      notifyError(err.message || "Failed to save event.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteEvent(event) {
    if (!window.confirm(`Are you sure you want to delete "${event.eventName}"?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await deleteEvent(event._id);
      notifySuccess(`Event "${event.eventName}" deleted.`);
      if (selectedEventId === event._id) {
        setSelectedEventId("");
        setTournament({ teams: [], matches: [] });
      }
      await loadAllData();
    } catch (err) {
      notifyError(err.message || "Failed to delete event.");
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // TOURNAMENT & TEAM HANDLERS
  // -------------------------------------------------------------------------

  async function handleAddTeam() {
    const trimmed = newTeamName.trim();
    if (!trimmed) {
      notifyError("Please enter a valid team name.");
      return;
    }

    const currentTeams = tournament.teams || [];
    if (
      currentTeams.some((t) => t.toLowerCase() === trimmed.toLowerCase())
    ) {
      notifyError("A team with this name already exists in this tournament.");
      return;
    }

    const updatedTeams = [...currentTeams, trimmed];
    setTournament((prev) => ({ ...prev, teams: updatedTeams }));
    setNewTeamName("");

    if (tournament._id && selectedEventId) {
      try {
        const res = await assignTeams(selectedEventId, updatedTeams);
        setTournament(res.tournament || res);
        notifySuccess(`Team "${trimmed}" added and saved.`);
      } catch (err) {
        notifyError(err.message || "Failed to save team.");
      }
    }
  }

  async function handleSaveTeams() {
    if (!selectedEventId || savingTeams) return;
    const currentTeams = tournament.teams || [];
    if (currentTeams.length === 0) {
      notifyError("Please add at least one team.");
      return;
    }

    try {
      setSavingTeams(true);
      const data = await assignTeams(selectedEventId, currentTeams);
      setTournament(data.tournament || data);
      notifySuccess("Team roster saved successfully!");
    } catch (err) {
      notifyError(err.message || "Failed to save teams.");
    } finally {
      setSavingTeams(false);
    }
  }

  async function handleGenerateFirstRound() {
    if (!selectedEventId || generatingRound) return;
    const currentTeams = tournament.teams || [];
    if (currentTeams.length < 2) {
      notifyError("Please add at least 2 teams to generate First Round matches.");
      return;
    }

    try {
      setGeneratingRound(true);
      const data = await generateFirstRound(selectedEventId, currentTeams);
      setTournament(data.tournament || data);
      setActiveRoundTab("Round 1");
      notifySuccess("First round matches generated successfully!");
    } catch (err) {
      notifyError(err.message || "Failed to generate first round matches.");
    } finally {
      setGeneratingRound(false);
    }
  }

  function openEditTeam(team) {
    setEditingTeamName({ old: team, new: team });
    setEditTeamModalOpen(true);
  }

  async function handleSaveEditedTeam() {
    const { old: oldName, new: newName } = editingTeamName;
    const trimmed = newName.trim();
    if (!trimmed) {
      notifyError("Team name cannot be empty.");
      return;
    }
    if (trimmed === oldName) {
      setEditTeamModalOpen(false);
      return;
    }

    try {
      if (tournament._id && selectedEventId) {
        const data = await editTeam(selectedEventId, oldName, trimmed);
        setTournament(data.tournament || data);
      } else {
        setTournament((prev) => ({
          ...prev,
          teams: (prev.teams || []).map((t) => (t === oldName ? trimmed : t)),
        }));
      }
      notifySuccess(`Team renamed to "${trimmed}".`);
      setEditTeamModalOpen(false);
    } catch (err) {
      notifyError(err.message || "Failed to rename team.");
    }
  }

  async function handleDeleteTeam(team) {
    if (!window.confirm(`Remove "${team}" from tournament?`)) return;

    try {
      if (tournament._id && selectedEventId) {
        const data = await deleteTeam(selectedEventId, team);
        setTournament(data.tournament || data);
      } else {
        setTournament((prev) => ({
          ...prev,
          teams: (prev.teams || []).filter((t) => t !== team),
        }));
      }
      notifySuccess(`Team "${team}" removed.`);
    } catch (err) {
      notifyError(err.message || "Failed to remove team.");
    }
  }

  // -------------------------------------------------------------------------
  // MATCH CREATION & LIVE SCORING HANDLERS
  // -------------------------------------------------------------------------

  async function handleCreateMatch() {
    if (!selectedEventId) {
      notifyError("Please select an event first.");
      return;
    }

    if (
      newMatchTeam1 &&
      newMatchTeam2 &&
      newMatchTeam1.toLowerCase() === newMatchTeam2.toLowerCase()
    ) {
      notifyError("Team A and Team B cannot be the same team.");
      return;
    }

    try {
      setActionLoading(true);

      if (!tournament._id) {
        if ((tournament.teams || []).length < 1) {
          notifyError("Add teams before creating matches.");
          return;
        }
        await assignTeams(selectedEventId, tournament.teams);
      }

      const data = await createMatch(selectedEventId, {
        round: newMatchRound,
        team1: newMatchTeam1,
        team2: newMatchTeam2,
      });

      setTournament(data.tournament || data);
      setNewMatchTeam1("");
      setNewMatchTeam2("");
      notifySuccess(`Match created for ${newMatchRound}!`);
    } catch (err) {
      notifyError(err.message || "Failed to create match.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleScoreUpdate(matchId, payload) {
    try {
      const data = await updateLiveScore(selectedEventId, matchId, payload);
      setTournament(data.tournament || data);
      notifySuccess("Live score updated!");
    } catch (err) {
      notifyError(err.message || "Failed to update score.");
    }
  }

  async function handleWinnerUpdate(matchId, winner) {
    try {
      const data = await setMatchWinner(selectedEventId, matchId, winner);
      setTournament(data.tournament || data);
      notifySuccess(winner ? `Winner set: ${winner}` : "Winner cleared.");
    } catch (err) {
      notifyError(err.message || "Failed to update winner.");
    }
  }

  async function handleMatchSave(matchId, payload) {
    try {
      const data = await updateMatch(selectedEventId, matchId, payload);
      setTournament(data.tournament || data);
      notifySuccess("Match details updated.");
    } catch (err) {
      notifyError(err.message || "Failed to update match.");
    }
  }

  async function handleDeleteMatch(matchId) {
    if (!window.confirm("Delete this match?")) return;

    try {
      const data = await deleteMatch(selectedEventId, matchId);
      setTournament(data.tournament || data);
      notifySuccess("Match deleted.");
    } catch (err) {
      notifyError(err.message || "Failed to delete match.");
    }
  }

  // -------------------------------------------------------------------------
  // COMPUTED METRICS & FILTERED LISTS
  // -------------------------------------------------------------------------

  const totalEventsCount = events.length;
  const activeEventsCount = events.filter(
    (e) => (e.status || "Upcoming") === "Active" || (e.status || "Upcoming") === "Upcoming"
  ).length;
  const totalMatchesCount = (tournament.matches || []).length;
  const liveMatches = (tournament.matches || []).filter(
    (m) => m.status === "Live"
  );
  const totalTeamsCount = (tournament.teams || []).length;
  const totalBookingsCount = bookings.length;

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchSearch =
        !searchQuery ||
        ev.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSport =
        sportFilter === "ALL" ||
        (ev.sport || "Cricket").toUpperCase() === sportFilter.toUpperCase();

      const matchStatus =
        statusFilter === "ALL" ||
        (ev.status || "Upcoming").toUpperCase() === statusFilter.toUpperCase();

      return matchSearch && matchSport && matchStatus;
    });
  }, [events, searchQuery, sportFilter, statusFilter]);

  const selectedEvent = events.find((e) => e._id === selectedEventId) || events[0];

  const sidebarCounts = {
    events: totalEventsCount,
    tournaments: events.length,
    teams: totalTeamsCount,
    matches: totalMatchesCount,
    liveMatches: liveMatches.length,
    bookings: bookings.filter((b) => b.status === "Pending").length,
    enquiries: insights?.community?.openEnquiries || 0,
    users: users.length,
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      title={
        activeTab === "overview"
          ? "Dashboard Overview"
          : activeTab === "events"
          ? "Events Management"
          : activeTab === "live-matches"
          ? "Live Matches Console"
          : activeTab === "turfs"
          ? "Turf Management"
          : activeTab === "addons"
          ? "Add-ons Management"
          : activeTab === "visitors"
          ? "Visitors"
          : activeTab === "bookings"
          ? "Bookings"
          : activeTab === "coupons"
          ? "Coupons"
          : activeTab === "enquiries"
          ? "Zone Requests"
          : activeTab === "community"
          ? "Community"
          : "System Settings"
      }
      breadcrumb={`Overview / ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
      searchQuery={activeTab === "events" ? searchQuery : ""}
      setSearchQuery={activeTab === "events" ? setSearchQuery : null}
      onRefresh={loadAllData}
      counts={sidebarCounts}
    >
      {/* Feedback Banners */}
      {message && (
        <div className="alert-banner success">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconCheck size={18} />
            <strong>{message}</strong>
          </div>
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="alert-banner error">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconAlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------
          TAB 1: DASHBOARD OVERVIEW (4 Stat Cards)
          ------------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <>
          <BusinessInsights data={insights} error={insightsError} onNavigate={setActiveTab} />

          {/* 4 Stat Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <StatCard
              label="Total Events"
              value={dashboardStats?.totalEvents ?? totalEventsCount}
              icon={IconCalendar}
              color="blue"
              trend="All registered tournaments"
              trendType="positive"
            />
            <StatCard
              label="Active Tournaments"
              value={dashboardStats?.activeEvents ?? events.length}
              icon={IconTrophy}
              color="violet"
              trend="In execution phase"
              trendType="neutral"
            />
            <StatCard
              label="Total Teams"
              value={totalTeamsCount}
              icon={IconUsers}
              color="indigo"
              trend="Assigned across rosters"
              trendType="positive"
            />
            <StatCard
              label="Live Matches"
              value={liveMatches.length}
              icon={IconLive}
              color="coral"
              trend={liveMatches.length > 0 ? "Currently in progress" : "No live matches right now"}
              trendType={liveMatches.length > 0 ? "live" : "neutral"}
            />
          </div>

          {/* Active Live Action Banner */}
          {liveMatches.length > 0 && (
            <div className="card" style={{ borderColor: "#f43f5e" }}>
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-badge-label" style={{ color: "#f43f5e", display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconLive size={14} />
                    <span>Real-Time Action</span>
                  </span>
                  <h2 className="card-title">Live Match Broadcasts ({liveMatches.length})</h2>
                </div>
                <button
                  className="btn btn-coral btn-sm"
                  onClick={() => setActiveTab("livescore")}
                >
                  <span>Open Live Scoring</span>
                </button>
              </div>

              <div className="matches-grid">
                {liveMatches.map((match) => (
                  <MatchCardComponent
                    key={match._id}
                    match={match}
                    teams={tournament.teams || []}
                    onScoreUpdate={handleScoreUpdate}
                    onWinnerUpdate={handleWinnerUpdate}
                    onSave={handleMatchSave}
                    onDelete={handleDeleteMatch}
                  />
                ))}
              </div>
            </div>
          )}

        </>
      )}

      {/* -------------------------------------------------------------------
          TAB 2: LIVE MATCHES CONSOLE
          ------------------------------------------------------------------- */}
      {activeTab === "live-matches" && (
        <LiveMatches />
      )}

      {/* -------------------------------------------------------------------
          TAB: TURF MANAGEMENT
          ------------------------------------------------------------------- */}
      {activeTab === "turfs" && (
        <TurfManagement />
      )}

      {activeTab === "addons" && (
        <AddonsManagement />
      )}

      {activeTab === "visitors" && (
        <VisitorsManagement />
      )}

      {activeTab === "bookings" && <BookingsManagement />}
      {activeTab === "coupons" && <CouponsManagement />}
      {activeTab === "enquiries" && <EnquiriesManagement />}
      {activeTab === "community" && <CommunityManagement />}

      {/* -------------------------------------------------------------------
          TAB 3: EVENTS MANAGEMENT
          ------------------------------------------------------------------- */}
      {activeTab === "events" && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Events</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                Manage all your upcoming tournaments and sports events
              </p>
            </div>
            <button className="btn btn-primary" onClick={openCreateEventModal}>
              <IconPlus size={16} />
              <span>+ Create Event</span>
            </button>
          </div>

          {/* Filter Pills Bar */}
          <div className="events-filter-bar">
            <div className="filter-pills-group">
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginRight: "4px" }}>
                Filter Sport:
              </span>
              {["ALL", "Cricket", "Football"].map((sport) => (
                <button
                  key={sport}
                  className={`filter-pill ${sportFilter === sport ? "active" : ""}`}
                  onClick={() => setSportFilter(sport)}
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid */}
          {loading ? (
            <div className="events-grid">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={IconCalendar}
              title="No events found"
              description="Click '+ Create Event' to publish a tournament."
              actionLabel="+ Create Event"
              onAction={openCreateEventModal}
            />
          ) : (
            <div className="events-grid">
              {filteredEvents.map((ev) => (
                <div className="event-card" key={ev._id}>
                  <div className="event-banner">
                    {ev.eventImage ? (
                      <img src={ev.eventImage} alt={ev.eventName} />
                    ) : (
                      <div className="event-banner-placeholder" />
                    )}
                    <div className="event-badge-overlay">
                      <Badge sport={ev.sport} />
                      <Badge status={ev.status || "Upcoming"} />
                    </div>
                  </div>

                  <div className="event-card-body">
                    <h3 className="event-card-title">{ev.eventName}</h3>

                    <div className="event-meta-list">
                      <div className="event-meta-row">
                        <IconClock size={15} style={{ color: "var(--text-muted)" }} />
                        <span>Date: <strong>{formatDate(ev.eventDate)}</strong></span>
                      </div>
                      <div className="event-meta-row">
                        <IconMapPin size={15} style={{ color: "var(--text-muted)" }} />
                        <span>Venue: <strong>{ev.location}</strong></span>
                      </div>
                      <div className="event-meta-row">
                        <IconUsers size={15} style={{ color: "var(--text-muted)" }} />
                        <span>Team Size: <strong>{ev.teamSize}</strong></span>
                      </div>
                      <div className="event-meta-row">
                        <IconClock size={15} style={{ color: "var(--text-muted)" }} />
                        <span>Deadline: <strong>{formatDate(ev.registrationDeadline)}</strong></span>
                      </div>
                    </div>

                    <div className="event-prizes-pill">
                      <div className="prize-rank">
                        <span>1st Prize</span>
                        <span>₹{Number(ev.firstPrize || 0).toLocaleString()}</span>
                      </div>
                      <div className="prize-rank">
                        <span>2nd Prize</span>
                        <span>₹{Number(ev.secondPrize || 0).toLocaleString()}</span>
                      </div>
                      <div className="prize-rank">
                        <span>3rd Prize</span>
                        <span>₹{Number(ev.thirdPrize || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="event-card-actions">
                      <button
                        className="btn btn-primary btn-manage"
                        onClick={() => {
                          handleEventSelect(ev._id);
                          setActiveTab("tournaments");
                        }}
                      >
                        <IconTrophy size={16} />
                        <span>Manage Tournament</span>
                      </button>

                      <div className="event-card-actions-subrow">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditEventModal(ev)}
                        >
                          <IconEdit size={14} />
                          <span>Edit</span>
                        </button>

                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteEvent(ev)}
                        >
                          <IconTrash size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------
          TAB 3: TOURNAMENT MANAGEMENT & BRACKET
          ------------------------------------------------------------------- */}
      {(activeTab === "tournaments" || activeTab === "teams" || activeTab === "matches" || activeTab === "livescore") && (
        <div>
          {/* Event Selector Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                Selected Event:
              </label>
              <select
                className="form-control"
                style={{ width: "auto", minWidth: "240px", fontWeight: 700 }}
                value={selectedEventId}
                onChange={(e) => handleEventSelect(e.target.value)}
              >
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.eventName} ({ev.sport} - {ev.location})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEvent ? (
            <>
              {/* Tournament Visual Header */}
              <div className="tournament-hero-card">
                <div className="hero-top-bar">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Badge sport={selectedEvent.sport} />
                    <Badge status={selectedEvent.status || "Upcoming"} />
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    ID: {selectedEvent._id.slice(-6)}
                  </span>
                </div>

                <h1 className="hero-event-title">{selectedEvent.eventName}</h1>

                <div className="hero-stats-row">
                  <div className="hero-stat-pill">
                    <span>Venue</span>
                    <span>{selectedEvent.location}</span>
                  </div>
                  <div className="hero-stat-pill">
                    <span>Event Date</span>
                    <span>{formatDate(selectedEvent.eventDate)}</span>
                  </div>
                  <div className="hero-stat-pill">
                    <span>Team Size</span>
                    <span>{selectedEvent.teamSize}</span>
                  </div>
                  <div className="hero-stat-pill">
                    <span>1st Prize Pool</span>
                    <span style={{ color: "#fbbf24" }}>
                      ₹{Number(selectedEvent.firstPrize || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}>
                    <span>Tournament Progress</span>
                    <span>
                      {(tournament.matches || []).filter((m) => m.status === "Completed").length} / {(tournament.matches || []).length} Matches Completed
                    </span>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${
                          (tournament.matches || []).length > 0
                            ? ((tournament.matches || []).filter((m) => m.status === "Completed").length / (tournament.matches || []).length) * 100
                            : 0
                        }%`,
                        background: "linear-gradient(90deg, #3b82f6, #10b981)",
                        borderRadius: "999px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Winners Podium Section */}
              <div className="winners-podium-grid">
                <div className="winner-card">
                  <div className="winner-trophy-icon">
                    <IconTrophy size={20} />
                  </div>
                  <div className="winner-details">
                    <span className="winner-stage-label">Round 1 - Winner 1</span>
                    <strong className="winner-team-name">
                      {tournament?.winner1 || "Pending match..."}
                    </strong>
                  </div>
                </div>

                <div className="winner-card">
                  <div className="winner-trophy-icon">
                    <IconTrophy size={20} />
                  </div>
                  <div className="winner-details">
                    <span className="winner-stage-label">Round 1 - Winner 2</span>
                    <strong className="winner-team-name">
                      {tournament?.winner2 || "Pending match..."}
                    </strong>
                  </div>
                </div>

                <div className="winner-card champion">
                  <div className="winner-trophy-icon">
                    <IconCrown size={22} />
                  </div>
                  <div className="winner-details">
                    <span className="winner-stage-label" style={{ color: "#d97706" }}>
                      Tournament Champion
                    </span>
                    <strong className="winner-team-name" style={{ color: "#b45309" }}>
                      {tournament?.champion || "Pending finals..."}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Registered Teams Manager */}
              {(activeTab === "tournaments" || activeTab === "teams") && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-header-left">
                      <span className="card-badge-label">REGISTERED TEAMS</span>
                      <h2 className="card-title">
                        Roster ({ (tournament.teams || []).length })
                      </h2>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleSaveTeams}
                        disabled={savingTeams || (tournament.teams || []).length === 0}
                      >
                        <IconCheck size={16} />
                        <span>{savingTeams ? "Saving..." : "Save Roster"}</span>
                      </button>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleGenerateFirstRound}
                          disabled={generatingRound || (tournament.teams || []).length < 2}
                        >
                          <IconSparkles size={16} />
                          <span>Generate First Round →</span>
                        </button>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Create matches automatically from the registered teams.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Add Team Control */}
                  <div style={{ display: "flex", gap: "10px", maxWidth: "520px", marginBottom: "16px" }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTeam();
                      }}
                    />
                    <button className="btn btn-secondary" onClick={handleAddTeam}>
                      <IconPlus size={16} />
                      <span>Add Team</span>
                    </button>
                  </div>

                  {/* Team Cards Grid */}
                  {(tournament.teams || []).length === 0 ? (
                    <EmptyState
                      icon={IconUsers}
                      title="No teams registered yet"
                      description="Add team names using the input above, then click 'Generate First Round →'."
                    />
                  ) : (
                    <div className="team-chips-grid">
                      {tournament.teams.map((team, idx) => (
                        <div className="team-chip" key={`${team}-${idx}`}>
                          <div className="team-chip-info">
                            <span className="team-chip-number">{idx + 1}</span>
                            <span className="team-chip-name">{team}</span>
                          </div>
                          <div className="team-chip-actions">
                            <button
                              className="team-chip-btn"
                              onClick={() => openEditTeam(team)}
                              title="Edit team name"
                              aria-label="Edit team name"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              className="team-chip-btn delete"
                              onClick={() => handleDeleteTeam(team)}
                              title="Delete team"
                              aria-label="Delete team"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Match Builder */}
              {(activeTab === "tournaments" || activeTab === "matches") && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-header-left">
                      <span className="card-badge-label">MATCH BUILDER</span>
                      <h2 className="card-title">Schedule Custom Match</h2>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group col-4">
                      <label className="form-label">Round *</label>
                      <select
                        className="form-control"
                        value={newMatchRound}
                        onChange={(e) => setNewMatchRound(e.target.value)}
                      >
                        {ROUNDS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group col-4">
                      <label className="form-label">Team A *</label>
                      <select
                        className="form-control"
                        value={newMatchTeam1}
                        onChange={(e) => setNewMatchTeam1(e.target.value)}
                      >
                        <option value="">Select Team A (or TBD)</option>
                        {(tournament.teams || []).map((t) => (
                          <option key={`a-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group col-4">
                      <label className="form-label">Team B *</label>
                      <select
                        className="form-control"
                        value={newMatchTeam2}
                        onChange={(e) => setNewMatchTeam2(e.target.value)}
                      >
                        <option value="">Select Team B (or TBD)</option>
                        {(tournament.teams || []).map((t) => (
                          <option key={`b-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12" style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateMatch}
                        disabled={actionLoading}
                      >
                        <IconPlus size={16} />
                        <span>Add Match</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bracket Matches Section */}
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <span className="card-badge-label">BRACKET MATCHES</span>
                    <h2 className="card-title">
                      Tournament Fixtures ({ (tournament.matches || []).length })
                    </h2>
                  </div>
                </div>

                <div className="rounds-nav-tabs">
                  {ROUNDS.map((r) => {
                    const count = (tournament.matches || []).filter(
                      (m) => m.round === r
                    ).length;
                    return (
                      <button
                        key={r}
                        className={`round-tab-btn ${activeRoundTab === r ? "active" : ""}`}
                        onClick={() => setActiveRoundTab(r)}
                      >
                        {r} {count > 0 && `(${count})`}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const roundMatches = (tournament.matches || [])
                    .filter((m) => m.round === activeRoundTab)
                    .sort((a, b) => a.matchNumber - b.matchNumber);

                  if (roundMatches.length === 0) {
                    return (
                      <EmptyState
                        icon={IconMatch}
                        title={`No matches scheduled in ${activeRoundTab}`}
                        description="Click 'Generate First Round →' or use the Match Builder above."
                      />
                    );
                  }

                  return (
                    <div className="matches-grid">
                      {roundMatches.map((match) => (
                        <MatchCardComponent
                          key={match._id}
                          match={match}
                          teams={tournament.teams || []}
                          onScoreUpdate={handleScoreUpdate}
                          onWinnerUpdate={handleWinnerUpdate}
                          onSave={handleMatchSave}
                          onDelete={handleDeleteMatch}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <EmptyState
              icon={IconCalendar}
              title="No events available"
              description="Create an event first to manage tournaments."
              actionLabel="+ Create Event"
              onAction={openCreateEventModal}
            />
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------
          TAB 4: SYSTEM SETTINGS
          ------------------------------------------------------------------- */}
      {activeTab === "settings" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          <div className="card">
            <div className="card-header">
              <div className="card-header-left">
                <span className="card-badge-label">Admin Identity</span>
                <h2 className="card-title">Administrator Profile</h2>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="user-avatar-circle" style={{ width: "56px", height: "56px", fontSize: "1.4rem" }}>
                {(admin?.name || "A").charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{admin?.name || "Admin"}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{admin?.email}</p>
                <span className="badge badge-completed" style={{ marginTop: "6px" }}>
                  Super Administrator
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-header-left">
                <span className="card-badge-label">System Gateway</span>
                <h2 className="card-title">Live Connection</h2>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.88rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>Socket.IO Service:</span>
                <span className="badge badge-live">Active & Connected</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Platform Version:</span>
                <strong>v2.4 SaaS Production</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          MULTI-SECTION EVENT MODAL
          ------------------------------------------------------------------- */}
      <Modal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        title={editingEventId ? "Update Tournament Event" : "+ Create Event"}
        maxWidth="720px"
      >
        <form onSubmit={handleEventFormSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Section 1: Event Information */}
            <div style={{ backgroundColor: "var(--bg-subtle)", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-primary)", marginBottom: "12px" }}>
                1. Event Information
              </h3>
              <div className="form-grid">
                <div className="form-group col-12">
                  <label className="form-label">Event Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Example: Night Premier League 2026"
                    value={eventForm.eventName}
                    onChange={(e) => setEventForm({ ...eventForm, eventName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group col-6">
                  <label className="form-label">Sport Category *</label>
                  <select
                    className="form-control"
                    value={eventForm.sport}
                    onChange={(e) => setEventForm({ ...eventForm, sport: e.target.value })}
                  >
                    <option value="Cricket">Cricket</option>
                    <option value="Football">Football</option>
                  </select>
                </div>

                <div className="form-group col-6">
                  <label className="form-label">Team Size *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Example: 8 players per team"
                    value={eventForm.teamSize}
                    onChange={(e) => setEventForm({ ...eventForm, teamSize: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Schedule & Location */}
            <div style={{ backgroundColor: "var(--bg-subtle)", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-primary)", marginBottom: "12px" }}>
                2. Schedule & Location
              </h3>
              <div className="form-grid">
                <div className="form-group col-6">
                  <label className="form-label">Event Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={eventForm.eventDate}
                    onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group col-6">
                  <label className="form-label">Registration Deadline *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={eventForm.registrationDeadline}
                    onChange={(e) => setEventForm({ ...eventForm, registrationDeadline: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group col-12">
                  <label className="form-label">Location / Venue *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Example: Elite Turf Arena, City Center"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Prize Details Cards */}
            <div style={{ backgroundColor: "var(--bg-subtle)", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "#d97706", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconMedal size={16} />
                <span>3. Prize Details</span>
              </h3>
              <div className="form-grid">
                <div className="form-group col-4">
                  <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", padding: "10px", borderRadius: "8px" }}>
                    <label className="form-label" style={{ color: "#b45309", fontWeight: 800, fontSize: "0.75rem" }}>
                      1ST PRIZE (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="10000"
                      value={eventForm.firstPrize}
                      onChange={(e) => setEventForm({ ...eventForm, firstPrize: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group col-4">
                  <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "8px" }}>
                    <label className="form-label" style={{ color: "#475569", fontWeight: 800, fontSize: "0.75rem" }}>
                      2ND PRIZE (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="5000"
                      value={eventForm.secondPrize}
                      onChange={(e) => setEventForm({ ...eventForm, secondPrize: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group col-4">
                  <div style={{ backgroundColor: "#fff7ed", border: "1px solid #ffedd5", padding: "10px", borderRadius: "8px" }}>
                    <label className="form-label" style={{ color: "#c2410c", fontWeight: 800, fontSize: "0.75rem" }}>
                      3RD PRIZE (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="2500"
                      value={eventForm.thirdPrize}
                      onChange={(e) => setEventForm({ ...eventForm, thirdPrize: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Registration */}
            <div style={{ backgroundColor: "var(--bg-subtle)", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-primary)", marginBottom: "12px" }}>
                4. Registration Link
              </h3>
              <div className="form-group">
                <label className="form-label">Google Form / Registration URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  value={eventForm.registrationLink}
                  onChange={(e) => setEventForm({ ...eventForm, registrationLink: e.target.value })}
                />
              </div>
            </div>

            {/* Section 5: Event Image */}
            <div style={{ backgroundColor: "var(--bg-subtle)", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-primary)", marginBottom: "12px" }}>
                5. Event Cover Image
              </h3>
              <div className="form-group">
                <label className="form-label">Banner Image URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://images.unsplash.com/..."
                  value={eventForm.eventImage}
                  onChange={(e) => setEventForm({ ...eventForm, eventImage: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: "24px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEventModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
            >
              {actionLoading
                ? "Publishing..."
                : editingEventId
                ? "Update Event"
                : "Publish Event"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Team Modal */}
      <Modal
        isOpen={editTeamModalOpen}
        onClose={() => setEditTeamModalOpen(false)}
        title="Edit Team Name"
        maxWidth="440px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label">Team Name</label>
            <input
              type="text"
              className="form-control"
              value={editingTeamName.new}
              onChange={(e) =>
                setEditingTeamName({ ...editingTeamName, new: e.target.value })
              }
              autoFocus
            />
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={() => setEditTeamModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveEditedTeam}
            >
              Save Team Name
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: MATCH CARD WITH SEPARATE TEAM A & B SECTIONS
// ---------------------------------------------------------------------------
function MatchCardComponent({
  match,
  teams,
  onScoreUpdate,
  onWinnerUpdate,
  onSave,
  onDelete,
}) {
  const [team1, setTeam1] = useState(match.team1 || "");
  const [team2, setTeam2] = useState(match.team2 || "");
  const [round, setRound] = useState(match.round || "Round 1");
  const [team1Score, setTeam1Score] = useState(match.team1Score || 0);
  const [team1Wickets, setTeam1Wickets] = useState(match.team1Wickets || 0);
  const [team2Score, setTeam2Score] = useState(match.team2Score || 0);
  const [team2Wickets, setTeam2Wickets] = useState(match.team2Wickets || 0);
  const [status, setStatus] = useState(match.status || "Upcoming");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTeam1(match.team1 || "");
    setTeam2(match.team2 || "");
    setRound(match.round || "Round 1");
    setTeam1Score(match.team1Score || 0);
    setTeam1Wickets(match.team1Wickets || 0);
    setTeam2Score(match.team2Score || 0);
    setTeam2Wickets(match.team2Wickets || 0);
    setStatus(match.status || "Upcoming");
  }, [
    match.team1,
    match.team2,
    match.round,
    match.team1Score,
    match.team1Wickets,
    match.team2Score,
    match.team2Wickets,
    match.status,
  ]);

  async function handleLiveScoreSubmit() {
    try {
      setSaving(true);
      await onScoreUpdate(match._id, {
        team1Score: Number(team1Score) || 0,
        team1Wickets: Number(team1Wickets) || 0,
        team2Score: Number(team2Score) || 0,
        team2Wickets: Number(team2Wickets) || 0,
        status,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails() {
    try {
      setSaving(true);
      await onSave(match._id, { team1, team2, round });
    } finally {
      setSaving(false);
    }
  }

  function addRunsTeam1(runs) {
    setTeam1Score((prev) => Number(prev || 0) + runs);
  }
  function addWicketTeam1() {
    setTeam1Wickets((prev) => Math.min(10, Number(prev || 0) + 1));
  }
  function addRunsTeam2(runs) {
    setTeam2Score((prev) => Number(prev || 0) + runs);
  }
  function addWicketTeam2() {
    setTeam2Wickets((prev) => Math.min(10, Number(prev || 0) + 1));
  }

  const isLive = status === "Live";

  return (
    <div className={`match-card ${isLive ? "is-live" : ""}`}>
      <div className="match-card-top">
        <span className="match-number-tag">
          {match.round} • Match #{match.matchNumber}
        </span>
        <Badge status={status} />
      </div>

      {/* Team Details & Scores */}
      <div className="match-teams-box">
        {/* Team 1 Section */}
        <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div className="match-team-row">
            <span className={`match-team-name ${match.winner === team1 ? "is-winner" : ""}`}>
              {match.winner === team1 && <IconTrophy size={14} style={{ color: "#15803d" }} />}
              <span>{team1 || "Team A (TBD)"}</span>
            </span>

            <div className="match-score-inputs">
              <div style={{ textAlign: "center" }}>
                <input
                  type="number"
                  min="0"
                  className="score-num-field"
                  value={team1Score}
                  onChange={(e) => setTeam1Score(e.target.value)}
                  placeholder="0"
                />
                <div className="score-sublabel">Runs</div>
              </div>
              <span style={{ fontWeight: 800 }}>/</span>
              <div style={{ textAlign: "center" }}>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="score-num-field"
                  value={team1Wickets}
                  onChange={(e) => setTeam1Wickets(e.target.value)}
                  placeholder="0"
                />
                <div className="score-sublabel">Wkts</div>
              </div>
            </div>
          </div>

          <div className="score-quick-buttons">
            <button className="score-inc-btn" onClick={() => addRunsTeam1(1)}>+1</button>
            <button className="score-inc-btn" onClick={() => addRunsTeam1(4)}>+4</button>
            <button className="score-inc-btn" onClick={() => addRunsTeam1(6)}>+6</button>
            <button className="score-inc-btn wicket" onClick={addWicketTeam1}>+W</button>
          </div>
        </div>

        <div className="match-vs-divider">VS</div>

        {/* Team 2 Section */}
        <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div className="match-team-row">
            <span className={`match-team-name ${match.winner === team2 ? "is-winner" : ""}`}>
              {match.winner === team2 && <IconTrophy size={14} style={{ color: "#15803d" }} />}
              <span>{team2 || "Team B (TBD)"}</span>
            </span>

            <div className="match-score-inputs">
              <div style={{ textAlign: "center" }}>
                <input
                  type="number"
                  min="0"
                  className="score-num-field"
                  value={team2Score}
                  onChange={(e) => setTeam2Score(e.target.value)}
                  placeholder="0"
                />
                <div className="score-sublabel">Runs</div>
              </div>
              <span style={{ fontWeight: 800 }}>/</span>
              <div style={{ textAlign: "center" }}>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="score-num-field"
                  value={team2Wickets}
                  onChange={(e) => setTeam2Wickets(e.target.value)}
                  placeholder="0"
                />
                <div className="score-sublabel">Wkts</div>
              </div>
            </div>
          </div>

          <div className="score-quick-buttons">
            <button className="score-inc-btn" onClick={() => addRunsTeam2(1)}>+1</button>
            <button className="score-inc-btn" onClick={() => addRunsTeam2(4)}>+4</button>
            <button className="score-inc-btn" onClick={() => addRunsTeam2(6)}>+6</button>
            <button className="score-inc-btn wicket" onClick={addWicketTeam2}>+W</button>
          </div>
        </div>
      </div>

      {match.winner && (
        <div className="winner-banner-badge">
          <IconTrophy size={14} />
          <span>Winner: <strong>{match.winner}</strong></span>
        </div>
      )}

      {/* Match Controls */}
      <div className="match-card-controls">
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.72rem" }}>Status</label>
          <select
            className="form-control"
            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Upcoming">Upcoming</option>
            <option value="Live">Live</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.72rem" }}>Set Winner</label>
          <select
            className="form-control"
            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
            value={match.winner || ""}
            onChange={(e) => onWinnerUpdate(match._id, e.target.value)}
          >
            <option value="">Select Winner</option>
            {team1 && <option value={team1}>{team1}</option>}
            {team2 && <option value={team2}>{team2}</option>}
          </select>
        </div>

        <button
          className="btn btn-coral btn-full btn-sm"
          onClick={handleLiveScoreSubmit}
          disabled={saving}
        >
          <IconLive size={14} />
          <span>{saving ? "Pushing..." : "Update Live Score"}</span>
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSaveDetails}
          disabled={saving}
        >
          Save Details
        </button>

        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => onDelete(match._id)}
          style={{ backgroundColor: "rgba(225, 29, 72, 0.08)" }}
        >
          <IconTrash size={14} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

function formatInputDate(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().split("T")[0];
}

function formatDate(date) {
  if (!date) return "-";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "-";
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
