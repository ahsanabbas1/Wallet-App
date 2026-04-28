export const DARK_COLORS = {
  // Core
  primary: '#4f5ff7',
  background: '#0f1117',
  card: '#1a1d2e',
  text: '#f0f2ff',
  textSecondary: '#8b8fa8',
  textTertiary: '#6b7080',

  // Status
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f97316',
  accent: '#0bda73',

  // Semantic tokens (used in inline styles)
  border: 'rgba(255,255,255,0.08)',
  surface: 'rgba(255,255,255,0.04)',
  inputBg: '#13151f',
  cardAlt: '#222534',
  overlay: 'rgba(0,0,0,0.85)',
  divider: 'rgba(255,255,255,0.06)',

  // Theme identity
  isDark: true,
};

export const LIGHT_COLORS = {
  // Core
  primary: '#4051b5',
  background: '#eef0f8',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#6b7280',

  // Status
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  accent: '#059669',

  // Semantic tokens
  border: 'rgba(0,0,0,0.08)',
  surface: 'rgba(0,0,0,0.04)',
  inputBg: '#f8fafc',
  cardAlt: '#f3f4f8',
  overlay: 'rgba(0,0,0,0.55)',
  divider: 'rgba(0,0,0,0.06)',

  // Theme identity
  isDark: false,
};

// Default export keeps backward compat for any remaining static usage
export const COLORS = DARK_COLORS;

export const SIZES = {
  padding: 16,
  borderRadius: 12,
};
