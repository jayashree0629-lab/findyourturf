// A turf as the app's screens use it. The backend's raw record is converted into this
// shape in src/services/turfs.ts, so screens never have to deal with missing fields.
export type Turf = {
  id: string;
  name: string;
  area: string; // the backend's "location" (for example "RS Puram")
  sports: string[]; // can be empty for turfs that have no sport listed
  primarySport: string; // first sport, or "Turf" when none is listed
  pricePerHour: number | null; // null = "price on request" (cannot be booked online yet)
  rating: number | null;
  reviewsCount: number;
  tags: string[]; // up to 3 small labels, for example "Floodlights"
  image: string; // always a usable image URL
  hasOwnPhoto: boolean; // false when the image is a stock sports photo, not this turf's own
};

export type Equipment = { name: string; rentalCharge: number };

// Everything the Turf Details screen can show. Fields are empty (or null) when the backend
// has no data for them, and the screen simply hides those sections.
export type TurfDetail = Turf & {
  address: string;
  description: string;
  facilities: string[];
  equipment: Equipment[];
  openingTime: string | null; // "06:00"
  closingTime: string | null; // "23:59"
  slotMinutes: number | null;
  roof: 'Open air' | 'Partial roof' | 'Roofed' | null; // null = not verified
  floodlightCharge: number | null; // extra ₹ per hour; null = none listed
  contactNumber: string;
  latitude: number | null;
  longitude: number | null;
  gallery: string[]; // photos for the pager (at least one)
  bookable: boolean; // false when the admin has switched the turf off
  isComplete: boolean; // false while we only have the short list version
};
