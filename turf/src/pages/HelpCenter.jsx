import { useMemo, useState } from "react";
import {
  Search,
  CalendarCheck,
  Wallet,
  Users,
  Gift,
  UserRound,
  Phone,
  Mail,
  MessageCircle,
  SearchX,
} from "lucide-react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import Footer from "../components/Footer";
import { SUPPORT } from "../utils/support";

const TOPICS = [
  { id: "booking", label: "Booking a turf", desc: "Slots, add-ons, changes", Icon: CalendarCheck },
  { id: "payment", label: "Payments & split", desc: "Pay, split, coupons", Icon: Wallet },
  { id: "community", label: "Players & chat", desc: "Find players, team chat", Icon: Users },
  { id: "rewards", label: "Rewards & offers", desc: "Points, student & corporate", Icon: Gift },
  { id: "account", label: "Your account", desc: "Sign in, log out", Icon: UserRound },
];

const FAQS = [
  {
    topic: "booking",
    q: "How do I book a turf?",
    a: (
      <ol>
        <li>Open <b>Book Turf</b> and search by turf name, area or sport.</li>
        <li>Tap a turf, choose a date, then tap an open time slot.</li>
        <li>Choose your group size and any add-ons, then continue to payment.</li>
        <li>You'll see a confirmation with your booking reference. The turf owner is told about your booking straight away.</li>
      </ol>
    ),
  },
  {
    topic: "booking",
    q: "Why can't I book some turfs online?",
    a: "A few turfs haven't shared their prices yet, so they show \"On request\". Open the turf and use the phone number shown to call the venue directly.",
  },
  {
    topic: "booking",
    q: "Where can I see my bookings?",
    a: "Go to Account → My bookings (or tap your name at the top of the page). You'll find upcoming, past and cancelled bookings there, with directions, an add-to-calendar option and an invite link for friends.",
  },
  {
    topic: "booking",
    q: "How do I cancel a booking?",
    a: "Open My bookings and tap Cancel on the booking. You can cancel online up to 2 hours before the slot starts. After that, please call the turf. Cancelling frees the slot straight away and gives back any coupon you used. Refunds, if any, are handled by the turf.",
  },
  {
    topic: "payment",
    q: "How does split payment work?",
    a: (
      <ol>
        <li>At payment, choose <b>Split with friends</b> and add each teammate's mobile number.</li>
        <li>You pay your share now. Everyone else gets asked for theirs.</li>
        <li>Your booking stays <b>Pending</b> until every teammate has paid, then it turns <b>Confirmed</b>.</li>
        <li>You can see who has paid and how much is still pending under My bookings. The turf owner sees the same.</li>
      </ol>
    ),
  },
  {
    topic: "payment",
    q: "What does \"Pending\" mean on my booking?",
    a: "Pending means some money is still to be collected — for example a teammate hasn't paid their share yet, or you chose to pay at the venue. The booking shows exactly how much has been paid and how much is left.",
  },
  {
    topic: "payment",
    q: "How do I use a coupon?",
    a: "On the payment page, type your coupon code in the coupon box and tap Apply, or pick one from your coupon wallet. The discount shows straight away in the price breakdown. Each coupon can be used once per mobile number.",
  },
  {
    topic: "community",
    q: "How do I find players for my game?",
    a: "Open Community → Find Players and tap Post a game. Choose the sport, date, time and how many players you need. Others can join in one tap, and a private group chat opens for everyone in the game.",
  },
  {
    topic: "community",
    q: "Who can see my phone number?",
    a: "Nobody in public. Your number is only shared with the host or players of a game you join, and with the turf owner when you book. Chat and the community feed show your name only.",
  },
  {
    topic: "rewards",
    q: "How do reward points work?",
    a: "You earn 1 point for every ₹10 you pay, credited after your game has been played. Cancelled bookings don't earn points. Swap points for money-off coupons on the Rewards page.",
  },
  {
    topic: "rewards",
    q: "How do I get the student discount?",
    a: "Open Student Zone, fill in your college details and upload a clear photo of your college ID card. Our team checks it, usually within one working day. Once approved, your personal discount code appears on the same page.",
  },
  {
    topic: "rewards",
    q: "What is the Corporate zone?",
    a: "It's for companies planning team outings, office leagues or tournaments. Tell us your group size and dates and our team will call you with a plan and pricing.",
  },
  {
    topic: "account",
    q: "Do I need a password?",
    a: "No. You sign up with your name and mobile number (or with Google). Your mobile number links your bookings, points and coupons, so signing in again on any device brings them back.",
  },
  {
    topic: "account",
    q: "How do I log out?",
    a: "Tap your name at the top of the page (or the Account tab on your phone) and choose Log out. Your bookings and points stay safe and come back when you sign in again.",
  },
];

export default function HelpCenter() {
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (topic !== "all" && f.topic !== topic) return false;
      if (!q) return true;
      const text = typeof f.a === "string" ? f.a : "";
      return f.q.toLowerCase().includes(q) || text.toLowerCase().includes(q);
    });
  }, [topic, query]);

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="ui-page-main">
        <section className="ui-help-hero">
          <div className="ui-container">
            <h1>How can we help?</h1>
            <p>Quick answers to the most common questions about booking, payments and your account.</p>
            <div className="ui-input-wrap ui-help-search" style={{ maxWidth: 560 }}>
              <Search size={18} className="lead" />
              <input
                className="ui-input with-icon"
                type="search"
                placeholder="Search for help, e.g. cancel booking"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search help"
              />
            </div>
          </div>
        </section>

        <div className="ui-container">
          <div className="ui-topics" role="group" aria-label="Help topics">
            {TOPICS.map(({ id, label, desc, Icon }) => (
              <button key={id} className={`ui-topic ${topic === id ? "active" : ""}`} onClick={() => setTopic(topic === id ? "all" : id)} aria-pressed={topic === id}>
                <span className="ico"><Icon size={20} /></span>
                <strong>{label}</strong>
                <span className="d">{desc}</span>
              </button>
            ))}
          </div>

          <div className="ui-section" style={{ paddingTop: 30 }}>
            <div className="ui-section-head">
              <h2 className="ui-h2">{topic === "all" ? "Frequently asked questions" : TOPICS.find((t) => t.id === topic).label}</h2>
              {topic !== "all" && <button className="ui-link" onClick={() => setTopic("all")}>Show all</button>}
            </div>

            {shown.length === 0 ? (
              <div className="ui-panel" style={{ textAlign: "center", padding: 40 }}>
                <SearchX size={34} color="#94A3B8" />
                <h3 style={{ margin: "10px 0 4px" }}>No answers found</h3>
                <p className="ui-sub">Try different words, or contact us below and we'll help.</p>
              </div>
            ) : (
              <div className="ui-faq">
                {shown.map((f, i) => (
                  <details key={f.q} open={i === 0 && shown.length < FAQS.length}>
                    <summary>{f.q}</summary>
                    <div className="ans">{f.a}</div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="ui-section" style={{ paddingTop: 30 }}>
            <div className="ui-section-head">
              <div>
                <h2 className="ui-h2">Still need help?</h2>
                <p className="ui-sub">Our team is available {SUPPORT.hours}.</p>
              </div>
            </div>
            <div className="ui-contact">
              <a href={`tel:${SUPPORT.phoneLink}`}>
                <span className="ico" style={{ background: "#E8F7EF", color: "#12A05C" }}><Phone size={20} /></span>
                <div><b>Call us</b><span className="d">{SUPPORT.phoneLabel}</span></div>
              </a>
              <a href={SUPPORT.whatsappLink} target="_blank" rel="noopener noreferrer">
                <span className="ico" style={{ background: "#EEF1FF", color: "#3B5BFD" }}><MessageCircle size={20} /></span>
                <div><b>WhatsApp</b><span className="d">Chat with support</span></div>
              </a>
              <a href={`mailto:${SUPPORT.email}`}>
                <span className="ico" style={{ background: "#FEF3E2", color: "#D97706" }}><Mail size={20} /></span>
                <div><b>Email</b><span className="d">{SUPPORT.email}</span></div>
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
