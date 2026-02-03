// src/constants/theme.ts
// Gen Z Design System - Aurora UI + Dark Mode

export const COLORS = {
  // Background
  background: '#101922',
  card: '#1A2332',
  cardElevated: '#1E293B',
  cardHover: '#243447',

  // Primary Gradient (Purple)
  primary: '#7C3AED',
  primaryLight: '#A855F7',
  primaryDark: '#6D28D9',

  // Secondary (Cyan)
  secondary: '#06B6D4',
  secondaryLight: '#22D3EE',
  secondaryDark: '#0891B2',

  // Accent (Orange)
  accent: '#F97316',
  accentLight: '#FB923C',

  // Status
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#EAB308',
  error: '#EF4444',
  errorLight: '#F87171',

  // Text
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDark: '#475569',

  // Border
  border: '#334155',
  borderLight: '#475569',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassStrong: 'rgba(255, 255, 255, 0.1)',
};

export const GRADIENTS = {
  primary: ['#7C3AED', '#A855F7'],
  secondary: ['#06B6D4', '#0EA5E9'],
  accent: ['#F97316', '#FB923C'],
  aurora: ['#7C3AED', '#06B6D4', '#22C55E'],
  sunset: ['#F97316', '#EF4444', '#A855F7'],
  card: ['rgba(124, 58, 237, 0.1)', 'rgba(6, 182, 212, 0.05)'],
};

export const SHADOWS = {
  glow: {
    primary: '0 0 20px rgba(124, 58, 237, 0.4)',
    secondary: '0 0 20px rgba(6, 182, 212, 0.4)',
    accent: '0 0 15px rgba(249, 115, 22, 0.4)',
    success: '0 0 15px rgba(34, 197, 94, 0.4)',
  },
  card: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const ANIMATION = {
  fast: 150,
  normal: 200,
  slow: 300,
  spring: {
    damping: 15,
    stiffness: 150,
  },
};

// Font weights for Fredoka + Nunito
export const FONTS = {
  heading: {
    regular: 'Fredoka-Regular',
    medium: 'Fredoka-Medium',
    semibold: 'Fredoka-SemiBold',
    bold: 'Fredoka-Bold',
  },
  body: {
    light: 'Nunito-Light',
    regular: 'Nunito-Regular',
    medium: 'Nunito-Medium',
    semibold: 'Nunito-SemiBold',
    bold: 'Nunito-Bold',
  },
};
