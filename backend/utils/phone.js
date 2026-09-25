const crypto = require("crypto");

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

// "9876543210", "+91 98765 43210", "091-9876543210" -> "9876543210" (or null).
function normalisePhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    const local =
        digits.length === 12 && digits.startsWith("91")
            ? digits.slice(2)
            : digits.length === 11 && digits.startsWith("0")
            ? digits.slice(1)
            : digits;
    return INDIAN_MOBILE.test(local) ? local : null;
}

// Stable, non-reversible id for a phone number. Public payloads (chat, feed,
// player requests) expose this instead of the phone so clients can tell
// "is this me?" without ever learning anyone's number.
function hashPhone(phone) {
    const salt = process.env.JWT_SECRET || "turf-hub";
    return crypto.createHash("sha256").update(`${salt}:${phone}`).digest("hex").slice(0, 12);
}

function cleanText(value, max) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Keeps line breaks (for chat / posts) but collapses runaway whitespace.
function cleanMultiline(value, max) {
    return String(value || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max);
}

module.exports = { normalisePhone, hashPhone, cleanText, cleanMultiline };
