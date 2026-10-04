// Verifies a Google Sign-In ID token ("credential") using Google's public
// tokeninfo endpoint, so no extra dependency is needed. The token is only
// trusted if it was issued for OUR client id.
//
// Set GOOGLE_CLIENT_ID on the backend (the same OAuth client id the frontend
// uses as VITE_GOOGLE_CLIENT_ID).

function googleConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID);
}

async function verifyGoogleCredential(credential) {
    if (!googleConfigured()) {
        const err = new Error("Google sign-in isn't set up on this server yet.");
        err.status = 503;
        throw err;
    }
    if (!credential || typeof credential !== "string" || credential.length > 4096) {
        const err = new Error("Google sign-in failed. Please try again.");
        err.status = 400;
        throw err;
    }

    let data;
    try {
        const res = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (!res.ok) throw new Error("rejected");
        data = await res.json();
    } catch {
        const err = new Error("We couldn't verify your Google account. Please try again.");
        err.status = 401;
        throw err;
    }

    const audienceOk = data.aud === process.env.GOOGLE_CLIENT_ID;
    const issuerOk = data.iss === "accounts.google.com" || data.iss === "https://accounts.google.com";
    const notExpired = Number(data.exp) * 1000 > Date.now();
    const emailOk = data.email && String(data.email_verified) === "true";
    if (!audienceOk || !issuerOk || !notExpired || !emailOk) {
        const err = new Error("This Google sign-in isn't valid. Please try again.");
        err.status = 401;
        throw err;
    }

    return {
        googleId: String(data.sub),
        email: String(data.email).toLowerCase(),
        name: String(data.name || data.given_name || "").trim(),
        picture: String(data.picture || "")
    };
}

module.exports = { verifyGoogleCredential, googleConfigured };
