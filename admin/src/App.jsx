import { useState, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import "./App.css";
import AdminDashboard from "./pages/AdminDashboard";
import TournamentManagement from "./pages/TournamentManagement";
import LiveScoringConsole from "./pages/LiveScoringConsole";
import AdminLogin from "./pages/AdminLogin";
import OwnerPortal from "./pages/OwnerPortal";
import { isAdminAuthenticated } from "./services/auth";

function App() {
  const location = useLocation();
  const [authed, setAuthed] = useState(() => isAdminAuthenticated());

  // Keep auth state in sync if the token changes in another tab, or is
  // cleared by a 401 handler / logout elsewhere in the app.
  useEffect(() => {
    const sync = () => setAuthed(isAdminAuthenticated());
    window.addEventListener("storage", sync);
    window.addEventListener("admin-auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("admin-auth-changed", sync);
    };
  }, []);

  // A turf owner's private booking page. It is opened from a secret link and
  // needs no admin login.
  if (location.pathname.startsWith("/owner/")) {
    return (
      <Routes>
        <Route path="/owner/:token" element={<OwnerPortal />} />
      </Routes>
    );
  }

  if (!authed) {
    return (
      <Routes>
        <Route
          path="*"
          element={<AdminLogin onSuccess={() => setAuthed(true)} />}
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/tournament/:eventId" element={<TournamentManagement />} />
      <Route
        path="/live-matches/:matchId/score"
        element={<LiveScoringConsole />}
      />

      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default App;
