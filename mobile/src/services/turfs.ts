import type { Equipment, Turf, TurfDetail } from '@/types/turf';
import { tidyAddress } from '@/utils/format';
import { getTurfGallery, getTurfImage } from '@/utils/turfImages';
import { ApiError, apiGet } from './http';

// The fields we read from the backend's turf record (it has more; we ignore the rest).
type RawTurf = {
  _id?: string;
  name?: string;
  location?: string;
  address?: string;
  description?: string;
  pricePerHour?: number | null;
  sportType?: string;
  sports?: unknown;
  rating?: number | null;
  reviewsCount?: number;
  roofType?: string;
  floodlightChargePerHour?: number | null;
  facilities?: unknown;
  equipment?: unknown;
  openingTime?: string | null;
  closingTime?: string | null;
  slotDurationMinutes?: number | null;
  contactNumber?: string;
  latitude?: number | null;
  longitude?: number | null;
  images?: unknown;
  status?: string;
  available?: boolean;
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const cleanList = (value: unknown) => (Array.isArray(value) ? value.map(clean).filter(Boolean) : []);

// Same rule as the website: use the "sports" list, else the single "sportType", else nothing.
function sportsOf(raw: RawTurf): string[] {
  const listed = cleanList(raw.sports);
  const list = listed.length > 0 ? listed : clean(raw.sportType) ? [clean(raw.sportType)] : [];
  return [...new Set(list)];
}

const ROOF_LABEL = { Open: 'Open air', Partial: 'Partial roof', Closed: 'Roofed' } as const;

function toTurf(raw: RawTurf): Turf {
  const sports = sportsOf(raw);
  const roof = ROOF_LABEL[raw.roofType as keyof typeof ROOF_LABEL];
  const tags = [
    ...sports.slice(1), // extra sports, for example "Box Cricket"
    roof,
    (raw.floodlightChargePerHour ?? 0) > 0 ? 'Floodlights' : undefined,
  ].filter((t): t is string => Boolean(t));
  const photo = getTurfImage({ ...raw, sportType: clean(raw.sportType) });

  return {
    id: String(raw._id),
    name: clean(raw.name) || 'Turf',
    area: clean(raw.location),
    sports,
    primarySport: sports[0] ?? 'Turf',
    pricePerHour: typeof raw.pricePerHour === 'number' && raw.pricePerHour > 0 ? raw.pricePerHour : null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    reviewsCount: typeof raw.reviewsCount === 'number' ? raw.reviewsCount : 0,
    tags: tags.slice(0, 3),
    image: photo.url,
    hasOwnPhoto: photo.own,
  };
}

function equipmentOf(value: unknown): Equipment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const e = (item ?? {}) as { name?: unknown; rentalCharge?: unknown };
      return { name: clean(e.name), rentalCharge: typeof e.rentalCharge === 'number' ? e.rentalCharge : 0 };
    })
    .filter((e) => e.name);
}

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function toTurfDetail(raw: RawTurf): TurfDetail {
  const base = toTurf(raw);
  const gallery = getTurfGallery({ ...raw, sportType: clean(raw.sportType) });
  const floodlight = numberOrNull(raw.floodlightChargePerHour);

  return {
    ...base,
    hasOwnPhoto: gallery.own,
    address: tidyAddress(clean(raw.address)),
    description: clean(raw.description),
    facilities: [...new Set(cleanList(raw.facilities))],
    equipment: equipmentOf(raw.equipment),
    openingTime: clean(raw.openingTime) || null,
    closingTime: clean(raw.closingTime) || null,
    slotMinutes: numberOrNull(raw.slotDurationMinutes),
    roof: ROOF_LABEL[raw.roofType as keyof typeof ROOF_LABEL] ?? null,
    floodlightCharge: floodlight !== null && floodlight > 0 ? floodlight : null,
    contactNumber: clean(raw.contactNumber),
    latitude: numberOrNull(raw.latitude),
    longitude: numberOrNull(raw.longitude),
    gallery: gallery.urls,
    bookable: raw.status !== 'Inactive' && raw.available !== false,
    isComplete: true,
  };
}

// The short list version of a turf, dressed up as a TurfDetail. The details screen shows this
// instantly (from the cached list) while the full record loads.
export function summaryToDetail(turf: Turf): TurfDetail {
  return {
    ...turf,
    address: '',
    description: '',
    facilities: [],
    equipment: [],
    openingTime: null,
    closingTime: null,
    slotMinutes: null,
    roof: null,
    floodlightCharge: null,
    contactNumber: '',
    latitude: null,
    longitude: null,
    gallery: [turf.image],
    bookable: true, // the list only contains active turfs
    isComplete: false,
  };
}

// READ-ONLY: asks the backend for the turf list. "activeOnly=1" hides turfs the admin has
// switched off, so the app only lists turfs people can actually book.
export async function fetchTurfs(): Promise<Turf[]> {
  const data = await apiGet<unknown>('/api/turfs?activeOnly=1');
  if (!Array.isArray(data)) {
    throw new ApiError('server', 'The server sent an unexpected turf list.');
  }
  return data.filter((item): item is RawTurf => Boolean(item && item._id)).map(toTurf);
}

// READ-ONLY: the full record for one turf (GET /api/turfs/:id, the same call the website uses).
export async function fetchTurf(id: string): Promise<TurfDetail> {
  const data = await apiGet<RawTurf | null>(`/api/turfs/${encodeURIComponent(id)}`);
  if (!data || typeof data !== 'object' || !data._id) {
    throw new ApiError('server', 'The server sent an unexpected turf record.');
  }
  return toTurfDetail(data);
}
