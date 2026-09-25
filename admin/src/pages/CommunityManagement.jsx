import { useState, useEffect, useCallback } from "react";
import { socket } from "../services/socket";
import { IconUsers, IconTrash, IconRefresh } from "../components/common/Icons";
import {
  getAdminPosts,
  createAnnouncement,
  updateAdminPost,
  deleteAdminPost,
  getAdminPlayerRequests,
  setPlayerRequestStatus,
  getAdminChatMessages,
  deleteChatMessage,
} from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
  Pill,
  EmptyBox,
  ConfirmModal,
  formatDate,
} from "../components/common/adminUi";

const TABS = [
  { id: "posts", label: "Feed posts" },
  { id: "games", label: "Player requests" },
  { id: "chat", label: "Chat messages" },
];
const ROOMS = ["", "general", "cricket", "football", "badminton", "tournaments"];
const SPORTS = ["General", "Cricket", "Football", "Badminton", "Tennis", "Basketball", "Other"];

// ---------------------------------------------------------------- Posts ----
function PostsPanel({ setFlash }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sport, setSport] = useState("General");
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setPosts(await getAdminPosts());
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setLoading(false);
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    socket.on("community:changed", load);
    return () => socket.off("community:changed", load);
  }, [load]);

  const announce = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createAnnouncement({ text, sport, pinned });
      setText("");
      setFlash("success", "Announcement published to the community feed.");
      await load();
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (post, payload, message) => {
    try {
      await updateAdminPost(post._id, payload);
      setFlash("success", message);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  const remove = async () => {
    try {
      await deleteAdminPost(toDelete._id);
      setFlash("success", "Post deleted.");
      setToDelete(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  return (
    <>
      <form className="card" style={{ padding: 16, marginBottom: 14 }} onSubmit={announce}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Post an official announcement</div>
        <textarea
          className="form-control"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Weekend league registrations are open! Book early for evening slots."
          maxLength={600}
          required
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <select className="form-control" style={{ width: "auto" }} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport tag">
            {SPORTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to top
          </label>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} type="submit" disabled={busy || text.trim().length < 3}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading posts…</div>
        ) : posts.length === 0 ? (
          <EmptyBox icon={IconUsers} title="No posts yet" text="Player posts and your announcements appear here." />
        ) : (
          posts.map((p) => (
            <div key={p._id} style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", opacity: p.hidden ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{p.authorName}</strong>
                  {p.isOfficial && <Pill tone="blue">Official</Pill>}
                  {p.pinned && <Pill tone="amber">Pinned</Pill>}
                  {p.hidden && <Pill tone="red">Hidden</Pill>}
                  {p.sport !== "General" && <Pill>{p.sport}</Pill>}
                  {p.authorPhone && <span style={{ color: "#64748b", fontSize: 12 }}>{p.authorPhone}</span>}
                </div>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatDate(p.createdAt, { time: true })}</span>
              </div>
              <p style={{ margin: "8px 0", whiteSpace: "pre-wrap", color: "#334155" }}>{p.text}</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>♥ {p.likeCount} · 💬 {p.commentCount}</span>
                <span style={{ flex: 1 }} />
                <button className="btn btn-secondary btn-sm" onClick={() => patch(p, { pinned: !p.pinned }, p.pinned ? "Unpinned." : "Pinned to top.")}>
                  {p.pinned ? "Unpin" : "Pin"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => patch(p, { hidden: !p.hidden }, p.hidden ? "Post is visible again." : "Post hidden from the feed.")}>
                  {p.hidden ? "Unhide" : "Hide"}
                </button>
                <button className="btn btn-outline-danger btn-sm" onClick={() => setToDelete(p)} aria-label="Delete post"><IconTrash size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        danger
        title="Delete this post?"
        message="The post and all its comments will be removed permanently."
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------- Games ----
const STATUS_TONE = { Open: "green", Full: "amber", Closed: "slate", Removed: "red" };

function GamesPanel({ setFlash }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await getAdminPlayerRequests());
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setLoading(false);
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    socket.on("players:changed", load);
    return () => socket.off("players:changed", load);
  }, [load]);

  const setStatus = async (item, status) => {
    try {
      await setPlayerRequestStatus(item._id, status);
      setFlash("success", `Request marked ${status}.`);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading…</div>
      ) : items.length === 0 ? (
        <EmptyBox icon={IconUsers} title="No player requests" text="Games posted through Find Players appear here." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Host</th>
                <th>When</th>
                <th>Players</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.sport}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{[r.turfName, r.area].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td>
                    <div>{r.hostName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{r.hostPhone}</div>
                  </td>
                  <td>
                    <div>{formatDate(r.date, { utc: true })}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{r.time}</div>
                  </td>
                  <td title={r.joiners.map((j) => `${j.name} (${j.phone})`).join("\n")}>
                    {r.joinedCount}/{r.playersNeeded}
                  </td>
                  <td><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.status !== "Closed" && r.status !== "Removed" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, "Closed")}>Close</button>
                    )}{" "}
                    {r.status === "Closed" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, "Open")}>Reopen</button>
                    )}{" "}
                    {r.status !== "Removed" ? (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => setStatus(r, "Removed")}>Remove</button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, "Open")}>Restore</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Chat ----
function ChatPanel({ setFlash }) {
  const [room, setRoom] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setMessages(await getAdminChatMessages(room));
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setLoading(false);
    }
  }, [room, setFlash]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const remove = async () => {
    try {
      await deleteChatMessage(toDelete._id);
      setFlash("success", "Message removed from the chat.");
      setToDelete(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div className="filter-pills-group">
          {ROOMS.map((r) => (
            <button key={r || "all"} className={`filter-pill ${room === r ? "active" : ""}`} onClick={() => setRoom(r)}>
              {r || "All rooms"}
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><IconRefresh size={14} /> Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <EmptyBox icon={IconUsers} title="No messages" text="Chat messages will show up here for moderation." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Sender</th>
                  <th>Message</th>
                  <th>Sent</th>
                  <th style={{ textAlign: "right" }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m._id}>
                    <td><Pill>{m.room.startsWith("req-") ? "game chat" : m.room}</Pill></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.senderName}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{m.senderPhone}</div>
                    </td>
                    <td style={{ maxWidth: 380, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(m.createdAt, { time: true })}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => setToDelete(m)} aria-label="Remove message"><IconTrash size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        danger
        title="Remove this message?"
        message="It disappears from the chat for everyone immediately."
        confirmLabel="Remove"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

export default function CommunityManagement() {
  const [tab, setTab] = useState("posts");
  const [flash, setFlash] = useFlash();

  return (
    <div style={{ padding: 20 }}>
      <PageHeader
        title="Community"
        subtitle="Moderate what players post, the games they organise and the chat rooms. Publish announcements to the public feed."
      />
      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />
      <div className="filter-pills-group" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`filter-pill ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "posts" && <PostsPanel setFlash={setFlash} />}
      {tab === "games" && <GamesPanel setFlash={setFlash} />}
      {tab === "chat" && <ChatPanel setFlash={setFlash} />}
    </div>
  );
}
