// Design System for PhotoLingo - Cosmic Theme

export const colors = {
  // Primary palette - Cosmic Violet
  primary: '#8B5CF6',      // Violet - cosmic, space-like
  primaryDark: '#7C3AED',
  primaryLight: '#A78BFA',

  // Secondary - Deep Space
  navy: '#0F172A',         // Deep space black
  navyLight: '#1E293B',

  // Accent - Stellar Amber
  accent: '#F59E0B',       // Amber - warm CTAs
  accentLight: '#FCD34D',

  // Success
  mint: '#22C55E',         // Clean green for success
  mintLight: '#4ADE80',

  // XP & Progress
  xp: '#FBBF24',           // Gold for XP
  xpLight: '#FDE68A',
  level: '#A855F7',        // Purple for levels

  // Mastery colors
  masteryNew: '#94A3B8',
  masteryLearning: '#F59E0B',
  masteryFamiliar: '#22C55E',
  masteryMastered: '#FBBF24',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // States
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  // Overlays
  overlay: 'rgba(15, 23, 42, 0.8)',
  overlayLight: 'rgba(15, 23, 42, 0.5)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,

  // Font weights
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
};
