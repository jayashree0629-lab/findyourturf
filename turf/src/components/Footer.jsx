import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { SUPPORT } from "../utils/support";

export default function Footer() {
  return (
    <footer className="ui-footer">
      <div className="ui-container ui-footer-grid">
        <div className="ui-footer-brand">
          <Link to="/" className="ui-logo">
            <span className="ui-logo-mark">F</span>
            <span className="ui-logo-text">FindYour<b>Turf</b></span>
          </Link>
          <p>Book sports turfs in Coimbatore, split the cost with your team and follow live tournament scores — all in one place.</p>
        </div>

        <div>
          <h4>Explore</h4>
          <Link to="/turfs">Book a turf</Link>
          <Link to="/tournaments">Tournaments</Link>
          <Link to="/live">Live scores</Link>
          <Link to="/addons">Add-ons</Link>
        </div>

        <div>
          <h4>Community</h4>
          <Link to="/players">Find players</Link>
          <Link to="/chat">Team chat</Link>
          <Link to="/zones/student">Student zone</Link>
          <Link to="/zones/corporate">Corporate zone</Link>
        </div>

        <div>
          <h4>Support</h4>
          <Link to="/help">Help center</Link>
          <Link to="/bookings">My bookings</Link>
          <Link to="/rewards">Rewards</Link>
          <a href={`tel:${SUPPORT.phoneLink}`}><Phone size={13} /> {SUPPORT.phoneLabel}</a>
          <a href={`mailto:${SUPPORT.email}`}><Mail size={13} /> {SUPPORT.email}</a>
          <span className="ui-footer-line"><MapPin size={13} /> {SUPPORT.city}</span>
        </div>
      </div>
      <div className="ui-container ui-footer-bottom">
        <span>© {new Date().getFullYear()} FindYourTurf. All rights reserved.</span>
        <span>Made for players in Coimbatore</span>
      </div>
    </footer>
  );
}
