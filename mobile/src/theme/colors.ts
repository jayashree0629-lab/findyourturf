// Every colour used in the app lives here. Change a value once and the whole app updates.
export const colors = {
  // Brand: the same blue as the FindYourTurf website.
  primary: '#4058F5',
  primaryDark: '#2F44D4',
  primarySoft: '#EEF1FF',
  primaryBorder: '#C8D0FF',

  // Success (confirmed bookings, available slots, "paid").
  success: '#12A05C',
  successSoft: '#E8F7EF',

  warning: '#B45309',
  warningSoft: '#FEF3E2',

  danger: '#DC2626',
  dangerSoft: '#FEECEC',

  // Surfaces
  background: '#F6F7FB', // light page background
  surface: '#FFFFFF', // cards, bars, inputs
  border: '#E6E8F0',
  borderStrong: '#D5D9E5',

  // Text
  text: '#0B1020',
  textSecondary: '#475569',
  textMuted: '#64748B', // still readable on white (use for captions)
  placeholder: '#94A3B8', // placeholders and disabled icons only

  onPrimary: '#FFFFFF',
} as const;
