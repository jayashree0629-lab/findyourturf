import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Trophy, Copy, Ticket, Sparkles, CalendarCheck, Wallet } from "lucide-react";
import PageShell, { SkeletonList } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import { getRewardsSummary, redeemReward, getMyCoupons } from "../services/api";

const TIER_STYLE = { Bronze: "🥉", Silver: "🥈", Gold: "🥇", Platinum: "💎" };

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function Rewards() {
  const navigate = useNavigate();
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();
  const [summary, setSummary] = useState(null);
  const [wallet, setWallet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState(null);

  const load = useCallback(async () => {
    if (!identity.ready) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const [s, c] = await Promise.all([getRewardsSummary(identity.phone), getMyCoupons(identity.phone)]);
      setSummary(s);
      setWallet(c);
    } catch (err) {
      setError(err.message || "Couldn't load your rewards.");
    } finally {
      setLoading(false);
    }
  }, [identity.ready, identity.phone]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copied — paste it at checkout.`);
    } catch {
      toast.error("Couldn't copy the code.");
    }
  };

  const redeem = async (item) => {
    if (!window.confirm(`Redeem ${item.points} points for ${item.label}?`)) return;
    setRedeeming(item.id);
    try {
      const res = await redeemReward({ phone: identity.phone, rewardId: item.id });
      toast.success(`Coupon ${res.coupon.code} added to your wallet.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRedeeming(null);
    }
  };

  const tier = summary?.tier;
  const progress = tier?.next
    ? Math.min(100, Math.round(((summary.lifetimePoints - tier.floor) / (tier.next.at - tier.floor)) * 100))
    : 100;

  return (
    <PageShell
      title="Rewards"
      subtitle={`Earn 1 point for every ₹${summary?.pointValueRupees || 10} you spend on games you've played. Swap points for money off your next booking.`}
      maxWidth={900}
    >
      {!identity.ready ? (
        <EmptyState
          type="bookings"
          icon={<Gift size={36} />}
          title="See your rewards"
          message="Enter the mobile number you book with and we'll show your points and coupons."
          actionLabel="Add my number"
          onAction={async () => {
            if (await requireIdentity("Enter the mobile number you use when booking.")) load();
          }}
        />
      ) : loading ? (
        <SkeletonList count={2} height={180} />
      ) : error ? (
        <div className="fyt-x-inline-msg error">{error} <button className="fyt-x-btn-ghost" onClick={load}>Retry</button></div>
      ) : (
        summary && (
          <div className="fyt-x-stack" style={{ gap: 22 }}>
            <section className="fyt-x-points-hero">
              <div className="fyt-x-row between" style={{ position: "relative", zIndex: 1 }}>
                <div>
                  <div className="fyt-x-points-label">Your points</div>
                  <div className="fyt-x-points-num">{summary.points}</div>
                </div>
                <span className="fyt-x-tier-pill">{TIER_STYLE[tier.name]} {tier.name}</span>
              </div>
              <div className="fyt-x-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
              <div className="fyt-x-points-label" style={{ marginTop: 8, position: "relative", zIndex: 1 }}>
                {tier.next
                  ? `${tier.next.pointsNeeded} more lifetime points to reach ${tier.next.name}`
                  : "You've reached the top tier — thank you for playing!"}
              </div>
              <div className="fyt-x-stat-row" style={{ position: "relative", zIndex: 1 }}>
                <div className="fyt-x-stat"><strong>{summary.completedBookings}</strong><span>Games played</span></div>
                <div className="fyt-x-stat"><strong>₹{summary.totalSpent}</strong><span>Total spent</span></div>
                <div className="fyt-x-stat"><strong>{summary.pendingPoints}</strong><span>Points coming after your upcoming games</span></div>
              </div>
            </section>

            {wallet.length > 0 && (
              <section>
                <h2 className="fyt-section-title" style={{ marginBottom: 10 }}><Wallet size={18} style={{ verticalAlign: "-3px" }} /> Your coupon wallet</h2>
                <div className="fyt-x-stack" style={{ gap: 8 }}>
                  {wallet.map((c) => (
                    <div key={c.code} className="fyt-x-coupon">
                      <div>
                        <code>{c.code}</code>
                        <div className="fyt-x-sub">
                          {c.label || (c.type === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`)}
                          {c.minOrder > 0 && ` · min ₹${c.minOrder}`}
                          {c.expiresAt && ` · expires ${fmtDate(c.expiresAt)}`}
                        </div>
                      </div>
                      <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => copyCode(c.code)}><Copy size={13} /> Copy</button>
                    </div>
                  ))}
                </div>
                <button className="fyt-btn-primary" style={{ marginTop: 12 }} onClick={() => navigate("/turfs")}>Use it on a booking</button>
              </section>
            )}

            <section>
              <h2 className="fyt-section-title" style={{ marginBottom: 10 }}><Gift size={18} style={{ verticalAlign: "-3px" }} /> Redeem points</h2>
              <div className="fyt-x-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {summary.catalog.map((item) => {
                  const enough = summary.points >= item.points;
                  return (
                    <div key={item.id} className="fyt-x-card fyt-x-stack" style={{ gap: 10 }}>
                      <div className="fyt-x-row between">
                        <strong className="fyt-x-card-title">{item.label}</strong>
                        <span className="fyt-x-badge info"><Sparkles size={11} /> {item.points} pts</span>
                      </div>
                      <p className="fyt-x-sub">{item.description}. Valid for 90 days.</p>
                      <button
                        className={enough ? "fyt-btn-primary" : "fyt-btn-secondary"}
                        disabled={!enough || redeeming === item.id}
                        onClick={() => redeem(item)}
                      >
                        {redeeming === item.id ? "Redeeming…" : enough ? "Redeem" : `Need ${item.points - summary.points} more`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="fyt-section-title" style={{ marginBottom: 10 }}><Trophy size={18} style={{ verticalAlign: "-3px" }} /> Tiers</h2>
              <div className="fyt-x-row" style={{ alignItems: "stretch" }}>
                {summary.tiers.map((t) => (
                  <div key={t.name} className="fyt-x-card" style={{ flex: "1 1 130px", textAlign: "center", padding: 14, borderColor: t.name === tier.name ? "var(--primary)" : undefined }}>
                    <div style={{ fontSize: 24 }}>{TIER_STYLE[t.name]}</div>
                    <strong>{t.name}</strong>
                    <div className="fyt-x-muted">{t.min}+ pts</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="fyt-x-card fyt-x-stack" style={{ gap: 8 }}>
              <h3 className="fyt-x-card-title"><CalendarCheck size={16} style={{ verticalAlign: "-3px" }} /> How points work</h3>
              <p className="fyt-x-sub" style={{ lineHeight: 1.6 }}>
                Points are added once your slot has been played — cancelled bookings don't earn points. Points are calculated from what you actually paid, after any coupon.
              </p>
              <button className="fyt-btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/bookings")}>
                <Ticket size={15} /> View my bookings
              </button>
            </section>
          </div>
        )
      )}
    </PageShell>
  );
}
