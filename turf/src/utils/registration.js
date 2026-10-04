// Mirrors the backend's registration-status rule (backend/routes/registrationRoutes.js)
// so the UI can disable the Register button before the API ever gets called.
const REGISTRATION_CLOSED_STATUSES = ["Ongoing", "Completed", "Cancelled"];

export function isRegistrationOpen(status) {
  return !REGISTRATION_CLOSED_STATUSES.includes(status);
}

export function registrationClosedLabel(status) {
  return status === "Completed" ? "Tournament Completed" : "Registration Closed";
}
