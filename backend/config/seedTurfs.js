const Turf = require("../models/Turf");
const Booking = require("../models/Booking");

// ---------------------------------------------------------------------------
// VERIFIED Coimbatore turf dataset (provided by the project owner).
//
// Only fields that were actually supplied are set. Everything else is left as
// the model default: pricePerHour = null, floodlightChargePerHour = null,
// roofType = "Not verified", equipment = [], facilities = [], latitude /
// longitude = null. Nothing is invented.
//
// Hours were provided in words and mapped to 24h "HH:MM":
//   "24 hours"          -> 00:00 – 23:59
//   "5 AM - 12 AM"      -> 05:00 – 23:59   (12 AM = midnight)
//   "6 AM - 10 PM"      -> 06:00 – 22:00
//   "approx 5 AM - 1 AM"-> 05:00 – 23:59   (crosses midnight; stored best-effort)
//   not provided        -> null / null    (client falls back to 06:00–23:00
//                                          for slot display only)
// ---------------------------------------------------------------------------
const REAL_TURFS = [
    {
        name: "5th Yard - Football Turf",
        location: "Singanallur",
        sports: ["Football"],
        openingTime: "05:00", closingTime: "23:59",
        contactNumber: "+91 97518 55560",
        weatherLocation: "Singanallur, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Kovai Blasters Turf",
        location: "Chinnavedampatti",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 95004 29839",
        weatherLocation: "Chinnavedampatti, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Grassdale Football Turf and Box Cricket",
        location: "Gounder Mills",
        sports: ["Football", "Box Cricket"],
        openingTime: "06:00", closingTime: "22:00",
        contactNumber: "+91 94425 46622",
        weatherLocation: "Gounder Mills, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "RS Yard Cricket / Football Turf",
        location: "Sanganoor",
        sports: ["Cricket", "Football"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 77081 91787",
        weatherLocation: "Sanganoor, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Day Night Turf",
        location: "Cheran Ma Nagar",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 98941 22260",
        weatherLocation: "Cheran Ma Nagar, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "The Goat Club Multi Sports Turf",
        location: "Sundarapuram",
        sports: ["Multi-sport"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 63819 13267",
        weatherLocation: "Sundarapuram, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Kovai Arena - Football Turf",
        location: "Udayampalayam",
        sports: ["Football"],
        openingTime: "06:00", closingTime: "22:00",
        contactNumber: "+91 84892 29117",
        weatherLocation: "Udayampalayam, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Hit N Run Turf",
        location: "Kalapatti",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 97511 17333",
        weatherLocation: "Kalapatti, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Marutham Sports Arena",
        location: "Vadavalli",
        sports: ["Sports complex"],
        openingTime: null, closingTime: null,
        contactNumber: "+91 89408 06060",
        weatherLocation: "Vadavalli, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Nilgiri Football / Cricket Turf",
        location: "Ganapathy",
        sports: ["Football", "Cricket"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 87784 26099",
        weatherLocation: "Ganapathy, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Play Offs Turf",
        location: "Chinnavedampatti",
        sports: ["Cricket"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 91501 23534",
        weatherLocation: "Chinnavedampatti, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Day Night Turf 2.0",
        location: "Villankurichi",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 98941 22260",
        weatherLocation: "Villankurichi, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "One More Game",
        location: "Civil Aerodrome",
        sports: ["Sports complex"],
        openingTime: "05:00", closingTime: "23:59",
        description: "Operating hours are approximate (around 5 AM - 1 AM).",
        contactNumber: "+91 63747 81465",
        weatherLocation: "Civil Aerodrome, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Innings Infinity Cricket and Football Turf",
        location: "Chinniyampalayam",
        sports: ["Cricket", "Football"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 90801 07312",
        weatherLocation: "Chinniyampalayam, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Kickoff Sports Arena",
        location: "Kuniyamuthur",
        sports: ["Sports complex"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 95438 36363",
        weatherLocation: "Kuniyamuthur, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Spartan Turf",
        location: "Kalapatti",
        sports: ["Football"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 74187 33441",
        weatherLocation: "Kalapatti, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Toss & Trials - Football & Cricket Turf",
        location: "Saravanampatti / Athipalayam",
        sports: ["Football", "Cricket"],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 93454 94659",
        weatherLocation: "Saravanampatti, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "TIFO - Indoor Turf",
        location: "Ganapathy",
        sports: ["Indoor Turf", "Pickleball"],
        // "Indoor" turf -> enclosed / roofed.
        roofType: "Closed",
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 99409 15959",
        weatherLocation: "Ganapathy, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Coimbatore Sports Club - Turf",
        location: "Ramanathapuram",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 73393 72229",
        weatherLocation: "Ramanathapuram, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "KAT Turf",
        location: "Kovaipudur",
        sports: [],
        openingTime: "00:00", closingTime: "23:59",
        contactNumber: "+91 80720 03119",
        weatherLocation: "Kovaipudur, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Herkley Sports Centre",
        location: "Peelamedu",
        address: "Peelamedu, Coimbatore",
        sports: ["Football", "Box Cricket"],
        pricePerHour: 1000,
        roofType: "Closed",
        facilities: ["Roofed arena", "LED lighting"],
        openingTime: "06:00", closingTime: "23:00",
        weatherLocation: "Peelamedu, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Carmel Garden Elite Turf",
        location: "Nadar Colony",
        address: "444 Trichy Road, Nadar Colony, Coimbatore",
        sports: ["Football", "Cricket"],
        pricePerHour: 700,
        facilities: ["Floodlights", "Parking", "Washroom", "Changing room"],
        openingTime: null, closingTime: null,
        weatherLocation: "Nadar Colony, Coimbatore, Tamil Nadu, India"
    },
    {
        name: "Singai Sphere",
        location: "Singanallur",
        sports: ["Cricket", "Football"],
        facilities: ["Floodlit facilities"],
        openingTime: null, closingTime: null,
        weatherLocation: "Singanallur, Coimbatore, Tamil Nadu, India"
    }
];

// Turfs that were seeded with invented details in an earlier build. They are
// deactivated (never deleted — they may carry bookings) so they drop out of
// the public listing while the real data takes over.
const INVENTED_TURF_NAMES = [
    "Green Turf Arena",
    "SkyBox Cricket Ground",
    "KickOff Football Park",
    "Smash Badminton Academy",
    "Champions Box Cricket",
    "Arena 11 Multi-Sport Turf",
    "PowerPlay Turf",
    "The Turf Club"
];

function esc(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function seedTurfs() {
    try {
        // 0. Deactivate any turf whose data was previously invented.
        const deact = await Turf.updateMany(
            { name: { $in: INVENTED_TURF_NAMES } },
            { $set: { status: "Inactive", available: false } }
        );

        // 1. Drop exact-duplicate rows (same name + location) with no bookings.
        const groups = await Turf.aggregate([
            { $group: { _id: { name: "$name", location: "$location" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        for (const g of groups) {
            const [, ...extras] = g.ids;
            for (const id of extras) {
                const used = await Booking.exists({ turf: id });
                if (!used) await Turf.deleteOne({ _id: id });
            }
        }

        // 2. Make sure every remaining turf has a status that matches `available`.
        await Turf.updateMany(
            { status: { $exists: false }, available: false },
            { $set: { status: "Inactive" } }
        );
        await Turf.updateMany(
            { status: { $exists: false } },
            { $set: { status: "Active", available: true } }
        );

        // 3. Insert the verified venues that don't already exist (match by name,
        //    case-insensitive) — never create a duplicate.
        let inserted = 0;
        let backfilled = 0;
        for (const data of REAL_TURFS) {
            const existing = await Turf.findOne({
                name: new RegExp(`^${esc(data.name)}$`, "i")
            });

            if (existing) {
                // Only fill in verified fields that are currently blank.
                const set = {};
                if (!existing.contactNumber && data.contactNumber) set.contactNumber = data.contactNumber;
                if ((!existing.sports || existing.sports.length === 0) && data.sports && data.sports.length) set.sports = data.sports;
                if (!existing.openingTime && data.openingTime) set.openingTime = data.openingTime;
                if (!existing.closingTime && data.closingTime) set.closingTime = data.closingTime;
                if (!existing.address && data.address) set.address = data.address;
                if (data.pricePerHour != null && existing.pricePerHour == null) set.pricePerHour = data.pricePerHour;
                if (data.roofType && existing.roofType === "Not verified") set.roofType = data.roofType;
                if ((!existing.facilities || existing.facilities.length === 0) && data.facilities && data.facilities.length) set.facilities = data.facilities;
                if (data.weatherLocation) set.weatherLocation = data.weatherLocation;
                if (data.name === "Herkley Sports Centre") {
                    set.status = "Active";
                    set.available = true;
                }
                if (Object.keys(set).length) {
                    await Turf.updateOne({ _id: existing._id }, { $set: set });
                    backfilled += 1;
                }
                continue;
            }

            await Turf.create({
                name: data.name,
                location: data.location,
                address: data.address || "",
                sports: data.sports || [],
                sportType: (data.sports && data.sports[0]) || "",
                pricePerHour: data.pricePerHour != null ? data.pricePerHour : null,
                floodlightChargePerHour: null,
                roofType: data.roofType || "Not verified",
                openingTime: data.openingTime || null,
                closingTime: data.closingTime || null,
                slotDurationMinutes: 60,
                equipment: [],
                facilities: data.facilities || [],
                contactNumber: data.contactNumber || "",
                description: data.description || "",
                latitude: null,
                longitude: null,
                weatherLocation: data.weatherLocation || "Coimbatore, Tamil Nadu, India",
                rating: null,
                reviewsCount: 0,
                status: "Active",
                available: true
            });
            inserted += 1;
        }

        console.log("----------------------------------");
        console.log(`🏟️  Turf seed: +${inserted} verified venue(s), ${backfilled} back-filled, ${deact.modifiedCount || 0} legacy turf(s) deactivated`);
        console.log("----------------------------------");
    } catch (err) {
        console.error("⚠️  Failed to seed turfs:", err.message);
    }
}

module.exports = seedTurfs;
