import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Pin, BadgeCheck, Trash2, Send, Newspaper } from "lucide-react";
import PageShell, { CommunityTabs, SkeletonList } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import {
  getCommunityPosts,
  createCommunityPost,
  toggleLikePost,
  commentOnPost,
  deleteMyPost,
} from "../services/api";
import { socket } from "../services/socket";

const SPORTS = ["General", "Cricket", "Football", "Badminton", "Tennis", "Basketball", "Other"];

function timeAgo(value) {
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Composer({ onPosted }) {
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();
  const [text, setText] = useState("");
  const [sport, setSport] = useState("General");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 3) return;
    const id = identity.ready ? identity : await requireIdentity("Add your details to post in the community.");
    if (!id || !id.ready) return;
    setBusy(true);
    try {
      await createCommunityPost({ name: id.name, phone: id.phone, text: text.trim(), sport });
      setText("");
      toast.success("Posted!");
      onPosted();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="fyt-x-card fyt-x-composer" onSubmit={submit} style={{ marginBottom: 18 }}>
      <textarea
        className="fyt-x-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share a match result, ask for tips, or say what you're playing this weekend…"
        maxLength={600}
        aria-label="Write a post"
      />
      <div className="fyt-x-row between">
        <select className="fyt-x-select" style={{ width: "auto", minHeight: 40, padding: "6px 12px", fontSize: 14 }} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport tag">
          {SPORTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="fyt-x-row">
          <span className="fyt-x-muted">{text.length}/600</span>
          <button className="fyt-btn-primary fyt-x-btn-sm" type="submit" disabled={busy || text.trim().length < 3}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PostCard({ post, onChange, onDelete }) {
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const withId = async (reason) => {
    const id = identity.ready ? identity : await requireIdentity(reason);
    return id && id.ready ? id : null;
  };

  const like = async () => {
    const id = await withId("Add your details to like posts.");
    if (!id) return;
    // Optimistic update, corrected by the server response.
    onChange({ ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) });
    try {
      onChange(await toggleLikePost(post._id, id.phone));
    } catch (err) {
      onChange(post);
      toast.error(err.message);
    }
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const id = await withId("Add your details to comment.");
    if (!id) return;
    setBusy(true);
    try {
      onChange(await commentOnPost(post._id, { name: id.name, phone: id.phone, text: comment.trim() }));
      setComment("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deleteMyPost(post._id, identity.phone);
      onDelete(post._id);
      toast.success("Post deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <article className={`fyt-x-card fyt-x-post ${post.pinned ? "pinned" : ""}`}>
      <div className="fyt-x-row between">
        <div className="fyt-x-row" style={{ flexWrap: "nowrap" }}>
          <span className="fyt-x-avatar">{post.isOfficial ? "F" : post.authorName.charAt(0).toUpperCase()}</span>
          <div>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {post.authorName}
              {post.isOfficial && <BadgeCheck size={15} color="var(--primary)" />}
            </strong>
            <div className="fyt-x-muted">{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <div className="fyt-x-row" style={{ gap: 6 }}>
          {post.pinned && <span className="fyt-x-badge info"><Pin size={11} /> Pinned</span>}
          {post.sport !== "General" && <span className="fyt-x-badge">{post.sport}</span>}
          {post.isMine && (
            <button className="fyt-x-modal-close" onClick={remove} aria-label="Delete post"><Trash2 size={15} /></button>
          )}
        </div>
      </div>

      <p className="fyt-x-post-text">{post.text}</p>

      <div className="fyt-x-post-actions">
        <button className={`fyt-x-action ${post.liked ? "on" : ""}`} onClick={like} aria-pressed={post.liked}>
          <Heart size={16} fill={post.liked ? "currentColor" : "none"} /> {post.likeCount || "Like"}
        </button>
        <button className="fyt-x-action" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <MessageCircle size={16} /> {post.commentCount || "Comment"}
        </button>
      </div>

      {open && (
        <div className="fyt-x-stack" style={{ gap: 10 }}>
          {post.comments.map((c) => (
            <div key={c._id} className="fyt-x-comment">
              <span className="fyt-x-avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{c.authorName.charAt(0).toUpperCase()}</span>
              <div className="fyt-x-comment-body"><strong>{c.authorName}</strong>{c.text}</div>
            </div>
          ))}
          <form className="fyt-x-row" style={{ flexWrap: "nowrap" }} onSubmit={sendComment}>
            <input className="fyt-x-input" style={{ minHeight: 40 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" maxLength={300} aria-label="Write a comment" />
            <button className="fyt-x-send" style={{ width: 40, height: 40 }} type="submit" disabled={busy || !comment.trim()} aria-label="Send comment"><Send size={16} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function Community() {
  const { identity } = useIdentity();
  const [sport, setSport] = useState("All");
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const phone = identity.ready ? identity.phone : "";

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await getCommunityPosts({ sport, page: 1, phone });
      setPosts(d.posts);
      setHasMore(d.hasMore);
      setPage(1);
    } catch (err) {
      setError(err.message || "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }, [sport, phone]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    socket.on("community:changed", load);
    return () => socket.off("community:changed", load);
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const d = await getCommunityPosts({ sport, page: page + 1, phone });
      setPosts((prev) => [...prev, ...d.posts.filter((p) => !prev.some((x) => x._id === p._id))]);
      setHasMore(d.hasMore);
      setPage((p) => p + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const replace = (updated) => setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  const remove = (id) => setPosts((prev) => prev.filter((p) => p._id !== id));

  return (
    <PageShell
      title="Community"
      subtitle="Match results, tips and game plans from players across Coimbatore."
      maxWidth={760}
    >
      <CommunityTabs />
      <Composer onPosted={load} />

      <div className="fyt-x-chips" role="group" aria-label="Filter by sport">
        {["All", ...SPORTS.filter((s) => s !== "General")].map((s) => (
          <button key={s} className={`fyt-x-chip ${sport === s ? "active" : ""}`} onClick={() => setSport(s)}>{s}</button>
        ))}
      </div>

      {error && (
        <div className="fyt-x-inline-msg error" style={{ marginBottom: 12 }}>
          {error} <button className="fyt-x-btn-ghost" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={3} height={150} />
      ) : posts.length === 0 ? (
        <EmptyState
          type="search"
          icon={<Newspaper size={36} />}
          title="Nothing here yet"
          message="Be the first to post — share what you're playing this weekend."
        />
      ) : (
        <div className="fyt-x-stack">
          {posts.map((p) => (
            <PostCard key={p._id} post={p} onChange={replace} onDelete={remove} />
          ))}
          {hasMore && (
            <button className="fyt-btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </PageShell>
  );
}
