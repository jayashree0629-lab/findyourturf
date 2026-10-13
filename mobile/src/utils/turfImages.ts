// Picks photos for a turf. Same rules as the website: use the turf's own photos when it has
// any, otherwise a stock sports photo (the same turf always gets the same one).

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?q=80&w=${width}&auto=format&fit=crop`;

// Photo IDs only; the width is added when we build the URL.
// Every photo below was checked to load. (Three of the website's football photos are dead
// links, so they are not used here.)
const STOCK: Record<string, string[]> = {
  Football: [
    'photo-1579952363873-27f3bade9f55',
    'photo-1574629810360-7efbbe195018',
    'photo-1431324155629-1a6deb1dec8d',
    'photo-1560272564-c83b66b1ad12',
    'photo-1517927033932-b3d18e61fb3a',
  ],
  Cricket: ['photo-1531415074968-036ba1b575da', 'photo-1540747913346-19e32dc3e97e', 'photo-1624526267942-ab0ff8a3e972'],
  Badminton: ['photo-1626224583764-f87db24ac4ea', 'photo-1613918108466-292b78a8ef95'],
  Basketball: ['photo-1546519638-68e109498ffc', 'photo-1519861531473-9200262188bf'],
  Tennis: ['photo-1595435934249-5df7ed86e1c0', 'photo-1554068865-24cecd4e34b8'],
  Default: ['photo-1579952363873-27f3bade9f55', 'photo-1531415074968-036ba1b575da', 'photo-1431324155629-1a6deb1dec8d'],
};

type TurfLike = { _id?: string; name?: string; sportType?: string; images?: unknown };

// Unsplash photos in the database are often 1200px wide; resize to what the screen needs.
function resize(url: string, width: number) {
  return url.includes('images.unsplash.com') ? url.replace(/([?&])w=\d+/, `$1w=${width}`) : url;
}

function ownPhotos(turf: TurfLike): string[] {
  return Array.isArray(turf.images)
    ? turf.images.filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
    : [];
}

function stockPhoto(turf: TurfLike, width: number): string {
  const pool = STOCK[turf.sportType ?? ''] ?? STOCK.Default;
  const seed = turf.name ?? turf._id ?? '';
  const hash = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return unsplash(pool[hash % pool.length], width);
}

// One photo, for the list card.
export function getTurfImage(turf: TurfLike): { url: string; own: boolean } {
  const own = ownPhotos(turf);
  return own.length > 0 ? { url: resize(own[0], 800), own: true } : { url: stockPhoto(turf, 800), own: false };
}

// All photos, for the details screen pager. Always returns at least one.
export function getTurfGallery(turf: TurfLike): { urls: string[]; own: boolean } {
  const own = ownPhotos(turf);
  return own.length > 0
    ? { urls: own.map((u) => resize(u, 1000)), own: true }
    : { urls: [stockPhoto(turf, 1000)], own: false };
}
