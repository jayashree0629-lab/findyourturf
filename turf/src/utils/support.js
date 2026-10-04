// Where players can reach the FindYourTurf team. Override per deployment with
// VITE_SUPPORT_PHONE / VITE_SUPPORT_EMAIL; the defaults are placeholders.
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

const phone = String(env.VITE_SUPPORT_PHONE || "9876543210").replace(/\D/g, "").slice(-10);

export const SUPPORT = {
  phoneLink: `+91${phone}`,
  phoneLabel: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
  whatsappLink: `https://wa.me/91${phone}`,
  email: env.VITE_SUPPORT_EMAIL || "support@findyourturf.in",
  city: "Coimbatore, Tamil Nadu",
  hours: "Every day, 8 AM – 10 PM",
};
