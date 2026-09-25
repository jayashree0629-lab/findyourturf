// High-resolution curated sports images with robust fallback system
export const SPORTS_IMAGES = {
  Football: [
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=800&auto=format&fit=crop", // Lush football turf under floodlights
    "https://images.unsplash.com/photo-1529900245534-47fbf5de02f5?q=80&w=800&auto=format&fit=crop", // Soccer field with goals
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop", // Night football match
    "https://images.unsplash.com/photo-1518605368461-1ee18eb1e79f?q=80&w=800&auto=format&fit=crop", // Football training arena
  ],
  Cricket: [
    "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=800&auto=format&fit=crop", // Cricket pitch with turf
    "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop", // Stadium illuminated cricket pitch
    "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=800&auto=format&fit=crop", // Cricket turf nets
  ],
  Badminton: [
    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800&auto=format&fit=crop", // Badminton indoor synthetic court
    "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?q=80&w=800&auto=format&fit=crop", // Badminton racket on court
  ],
  Basketball: [
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800&auto=format&fit=crop", // Basketball court outdoor
    "https://images.unsplash.com/photo-1519861531473-9200262188bf?q=80&w=800&auto=format&fit=crop", // Basketball arena
  ],
  Tennis: [
    "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop", // Tennis court
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=800&auto=format&fit=crop", // Tennis ball on clay/turf
  ],
  Default: [
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1529900245534-47fbf5de02f5?q=80&w=800&auto=format&fit=crop",
  ]
};

export const SPORT_CATEGORIES = [
  {
    id: "Football",
    name: "Football",
    icon: "⚽",
    badge: "5v5 • 7v7",
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop",
    color: "#10B981"
  },
  {
    id: "Cricket",
    name: "Cricket",
    icon: "🏏",
    badge: "Box & Nets",
    image: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=600&auto=format&fit=crop",
    color: "#F59E0B"
  },
  {
    id: "Badminton",
    name: "Badminton",
    icon: "🏸",
    badge: "Wooden & Mat",
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop",
    color: "#6366F1"
  },
  {
    id: "Basketball",
    name: "Basketball",
    icon: "🏀",
    badge: "Full & Half Court",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop",
    color: "#EC4899"
  },
  {
    id: "Tennis",
    name: "Tennis",
    icon: "🎾",
    badge: "Synthetic Turf",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600&auto=format&fit=crop",
    color: "#8B5CF6"
  }
];

export function getTurfImage(turf, index = 0) {
  // Prefer the turf's own gallery images from the database.
  const gallery = Array.isArray(turf?.images)
    ? turf.images.filter((u) => typeof u === "string" && u.startsWith("http"))
    : [];
  if (gallery.length) {
    return gallery[index % gallery.length];
  }
  if (turf?.image && typeof turf.image === "string" && turf.image.startsWith("http")) {
    return turf.image;
  }
  const sport = turf?.sportType || "Default";
  const pool = SPORTS_IMAGES[sport] || SPORTS_IMAGES.Default;
  const hash = (turf?.name || turf?._id || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const selectedIndex = (hash + index) % pool.length;
  return pool[selectedIndex] || pool[0];
}

export function getEventImage(event, index = 0) {
  if (event?.eventImage && typeof event.eventImage === "string" && (event.eventImage.startsWith("http") || event.eventImage.startsWith("/"))) {
    return event.eventImage;
  }
  const isNightRiders = event?.eventName === "night riders";
  if (isNightRiders) return "/cricket-turf.jpg";

  const sport = event?.sport || "Cricket";
  const pool = SPORTS_IMAGES[sport] || SPORTS_IMAGES.Cricket;
  const hash = (event?.eventName || event?._id || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const selectedIndex = (hash + index) % pool.length;
  return pool[selectedIndex] || pool[0];
}
