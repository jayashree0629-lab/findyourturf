import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { MessageCircle, Send, ArrowLeft, Hash, Users, ChevronRight } from "lucide-react";
import PageShell, { CommunityTabs, SkeletonList } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import {
  getChatRooms,
  getChatMessages,
  sendChatMessage,
  getChatSenderId,
  getPlayerRequests,
} from "../services/api";
import { socket } from "../services/socket";

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function clock(value) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function dayLabel(value) {
  const d = new Date(value);
  const today = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  const y = new Date(today.getTime() - 86400000);
  if (same(d, today)) return "Today";
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function RoomList() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [rooms, setRooms] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getChatRooms()
      .then((r) => active && setRooms(r))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!identity.ready) return undefined;
    let active = true;
    getPlayerRequests({ phone: identity.phone, mine: true })
      .then((list) => active && setGames(list.filter((g) => g.status !== "Closed")))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [identity.ready, identity.phone]);

  return (
    <>
      {games.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 className="fyt-section-title" style={{ marginBottom: 10 }}>Your game chats</h2>
          <div className="fyt-x-rooms">
            {games.map((g) => (
              <button key={g._id} className="fyt-x-card is-clickable fyt-x-row" style={{ textAlign: "left", flexWrap: "nowrap" }} onClick={() => navigate(`/chat/req-${g._id}`)}>
                <span className="fyt-x-room-icon"><Users size={20} /></span>
                <span style={{ flex: 1 }}>
                  <strong className="fyt-x-card-title" style={{ display: "block", fontSize: 15 }}>{g.sport} · {g.isHost ? "your game" : `${g.hostName}'s game`}</strong>
                  <span className="fyt-x-muted">{g.time} · {g.joinedCount}/{g.playersNeeded} players</span>
                </span>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className="fyt-section-title" style={{ marginBottom: 10 }}>Community rooms</h2>
      {error && <div className="fyt-x-inline-msg error">{error}</div>}
      {loading ? (
        <SkeletonList count={4} height={90} />
      ) : (
        <div className="fyt-x-rooms">
          {rooms.map((r) => (
            <button key={r.id} className="fyt-x-card is-clickable fyt-x-row" style={{ textAlign: "left", flexWrap: "nowrap" }} onClick={() => navigate(`/chat/${r.id}`)}>
              <span className="fyt-x-room-icon"><Hash size={20} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong className="fyt-x-card-title" style={{ display: "block", fontSize: 15 }}>{r.name}</strong>
                <span className="fyt-x-sub" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.lastMessage ? `${r.lastMessage.senderName}: ${r.lastMessage.text}` : r.description}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                {r.recentCount > 0 && <span className="fyt-x-badge info">{r.recentCount} today</span>}
                {r.lastMessage && <span className="fyt-x-muted" style={{ display: "block", marginTop: 4 }}>{timeAgo(r.lastMessage.createdAt)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ChatRoom({ room }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState(null);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const isGameRoom = room.startsWith("req-");
  const phone = identity.ready ? identity.phone : "";

  const roomName = useMemo(() => {
    if (title) return title;
    const pretty = room.charAt(0).toUpperCase() + room.slice(1);
    return room === "general" ? "General Lounge" : pretty;
  }, [room, title]);

  useEffect(() => {
    if (!phone) {
      setMyId(null);
      return;
    }
    getChatSenderId(phone).then(setMyId).catch(() => {});
  }, [phone]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getChatMessages(room, { phone })
      .then((d) => {
        if (!active) return;
        setMessages(d.messages || []);
        setTitle(d.title || null);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [room, phone]);

  // Live updates.
  useEffect(() => {
    const join = () => socket.emit("chat:join", room);
    join();
    socket.on("connect", join);

    const onMessage = (m) => {
      if (m.room !== room) return;
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
    };
    const onDeleted = ({ _id }) => setMessages((prev) => prev.filter((x) => x._id !== _id));
    socket.on("chat:message", onMessage);
    socket.on("chat:deleted", onDeleted);
    return () => {
      socket.emit("chat:leave", room);
      socket.off("connect", join);
      socket.off("chat:message", onMessage);
      socket.off("chat:deleted", onDeleted);
    };
  }, [room]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    const id = identity.ready ? identity : await requireIdentity("Add your details to join the chat.");
    if (!id || !id.ready) return;

    setSending(true);
    try {
      const msg = await sendChatMessage(room, { name: id.name, phone: id.phone, text: body });
      stickToBottom.current = true;
      setMessages((prev) => (prev.some((x) => x._id === msg._id) ? prev : [...prev, msg]));
      setText("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const withDays = useMemo(() => {
    const out = [];
    let last = "";
    messages.forEach((m) => {
      const label = dayLabel(m.createdAt);
      if (label !== last) {
        out.push({ divider: label, key: `d-${label}-${m._id}` });
        last = label;
      }
      out.push(m);
    });
    return out;
  }, [messages]);

  if (error && isGameRoom) {
    return (
      <EmptyState
        type="error"
        title="This chat is for players in the game"
        message={error}
        actionLabel="Find games"
        onAction={() => navigate("/players")}
      />
    );
  }

  return (
    <div className="fyt-x-chat">
      <div className="fyt-x-chat-head">
        <button className="fyt-x-modal-close" onClick={() => navigate("/chat")} aria-label="All rooms">
          <ArrowLeft size={18} />
        </button>
        <span className="fyt-x-room-icon" style={{ width: 38, height: 38 }}>{isGameRoom ? <Users size={18} /> : <Hash size={18} />}</span>
        <div>
          <strong style={{ display: "block" }}>{roomName}</strong>
          <span className="fyt-x-muted">{isGameRoom ? "Private to the host and joined players" : "Be kind — this is a shared space"}</span>
        </div>
      </div>

      <div className="fyt-x-chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
        {loading ? (
          <p className="fyt-x-sub" style={{ textAlign: "center" }}>Loading messages…</p>
        ) : messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center" }}>
            <MessageCircle size={32} color="var(--text-muted)" />
            <p className="fyt-x-sub" style={{ marginTop: 8 }}>No messages yet. Say hello!</p>
          </div>
        ) : (
          withDays.map((m) =>
            m.divider ? (
              <div key={m.key} className="fyt-x-day">{m.divider}</div>
            ) : (
              <div key={m._id} className={`fyt-x-msg ${m.senderId === myId ? "mine" : ""}`}>
                {m.senderId !== myId && <div className="fyt-x-msg-name">{m.senderName}</div>}
                <div className="fyt-x-bubble">{m.text}</div>
                <div className="fyt-x-msg-time">{clock(m.createdAt)}</div>
              </div>
            )
          )
        )}
      </div>

      <form className="fyt-x-chat-form" onSubmit={send}>
        <input
          className="fyt-x-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={identity.ready ? "Type a message…" : "Tap to add your details and chat"}
          maxLength={500}
          aria-label="Message"
          onFocus={() => {
            if (!identity.ready) requireIdentity("Add your details to join the chat.");
          }}
        />
        <button className="fyt-x-send" type="submit" disabled={!text.trim() || sending} aria-label="Send message">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

export default function TeamChat() {
  const { room } = useParams();

  if (room) {
    return (
      <PageShell bare maxWidth={900}>
        <ChatRoom key={room} room={room} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Team Chat"
      subtitle="Talk to players across Coimbatore — plan games, find partners, share results."
      maxWidth={900}
    >
      <CommunityTabs />
      <RoomList />
      <p className="fyt-x-muted" style={{ marginTop: 18 }}>
        Looking for players instead? <Link to="/players" style={{ color: "var(--primary)", fontWeight: 700 }}>Browse open games →</Link>
      </p>
    </PageShell>
  );
}
