// "06:00" -> "6:00 AM". Returns null when the value is missing or not a valid HH:MM time.
export function formatTime(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${match[2]} ${period}`;
}

// Opening hours as one readable line, or null when the turf has no hours listed.
export function hoursLabel(open: string | null, close: string | null): string | null {
  if (open === '00:00' && (close === '23:59' || close === '24:00')) return 'Open 24 hours';
  const from = formatTime(open);
  const to = formatTime(close);
  if (from && to) return `${from} – ${to}`;
  if (from) return `Opens ${from}`;
  if (to) return `Closes ${to}`;
  return null;
}

// Removes repeated parts of an address for display: "Coimbatore, Coimbatore" -> "Coimbatore".
export function tidyAddress(address: string): string {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.filter((part, i) => i === 0 || part.toLowerCase() !== parts[i - 1].toLowerCase()).join(', ');
}

// "+91 80720 03119" -> "tel:+918072003119" (opens the phone's dialer; nothing is called until the user presses call).
export function phoneLink(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

// Opens Google Maps (or the phone's maps app) at the turf's position.
export function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
