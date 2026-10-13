// Spacing scale: use these numbers instead of random values so layouts stay even.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Corner roundness.
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

// Soft shadow used by cards.
export const shadows = {
  card: { boxShadow: '0 4px 14px rgba(11, 16, 32, 0.07)' },
} as const;
