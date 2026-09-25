// Shared turf-booking price + split-payment math. Used by the booking route so
// the client can never dictate the amount that gets stored.

function toMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

// Accepts "6:00 PM", "06:00 PM" or 24h "18:00" -> minutes since midnight.
function parseSlotStart(label) {
    if (!label) return null;
    const s = String(label).trim().toUpperCase();
    const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (ampm) {
        let h = parseInt(ampm[1], 10) % 12;
        if (ampm[3] === "PM") h += 12;
        return h * 60 + parseInt(ampm[2], 10);
    }
    return toMinutes(s);
}

const IST_OFFSET_MINUTES = 330;

// Absolute start time of a booking. Bookings store the calendar day as UTC
// midnight and the slot as a label like "6:00 PM" (local Coimbatore time).
function slotStartMs(booking) {
    const minutes = parseSlotStart(booking.startTime);
    if (minutes == null) return null;
    const d = new Date(booking.bookingDate);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) +
        (minutes - IST_OFFSET_MINUTES) * 60000;
}

/**
 * @param {object} turf   Turf document.
 * @param {object} opts
 * @param {boolean} [opts.useFloodlight]
 * @param {number}  [opts.players]
 * @param {string[]} [opts.equipment]  equipment names the player wants to rent.
 */
function computeBookingPrice(turf, opts = {}) {
    const { useFloodlight = false, players = 1, equipment = [], addonLines = [] } = opts;

    const hours = Math.max(1, (turf.slotDurationMinutes || 60) / 60);

    const baseAmount = Math.round((turf.pricePerHour || 0) * hours);

    const floodPerHour = turf.floodlightChargePerHour || 0;
    const floodlightApplied = Boolean(useFloodlight);
    const floodlightAmount = floodlightApplied ? Math.round(floodPerHour * hours) : 0;

    const catalogue = Array.isArray(turf.equipment) ? turf.equipment : [];
    const equipmentSelected = [];
    let equipmentAmount = 0;
    (Array.isArray(equipment) ? equipment : []).forEach((name) => {
        const item = catalogue.find(
            (e) => String(e.name).toLowerCase() === String(name).toLowerCase()
        );
        if (item) {
            equipmentSelected.push({ label: item.name, amount: item.rentalCharge || 0 });
            equipmentAmount += item.rentalCharge || 0;
        }
    });

    const safeAddonLines = Array.isArray(addonLines) ? addonLines : [];
    const addonsAmount = safeAddonLines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0);

    const totalAmount = baseAmount + floodlightAmount + equipmentAmount + addonsAmount;

    const safePlayers = Math.max(1, Math.min(50, parseInt(players, 10) || 1));
    const perPersonAmount = Math.ceil(totalAmount / safePlayers);

    return {
        hours,
        baseAmount,
        floodlightApplied,
        floodlightAmount,
        equipmentSelected,
        equipmentAmount,
        addonLines: safeAddonLines,
        addonsAmount,
        totalAmount,
        players: safePlayers,
        perPersonAmount
    };
}

module.exports = { computeBookingPrice, parseSlotStart, toMinutes, slotStartMs };
