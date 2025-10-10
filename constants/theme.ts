import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Color Palette (refined)
export const colors = {
  // Background Colors
  primary: '#0B0C0E',
  secondary: '#14161A',
  surface: '#1C1F24', // Slightly richer tone for contrast

  // Accent Colors
  accent: '#2EE6D6',
  accentBlue: '#2EA7FF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Text Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#E5E8EC',
  textMuted: '#A7B1C0',
  textDisabled: '#6C7380',

  // Border Colors
  border: '#2A2E35',
  borderAccent: '#2EE6D64D', // 30% opacity

  // Safety Level Colors
  safe: '#4caf50',
  caution: '#ff9800',
  risk: '#f44336',
  unknown: '#757575',

  // Gradients
  gradientPrimary: ['#2EE6D6', '#2EA7FF'],
  gradientSecondary: ['#2EA7FF', '#2EE6D6'],
  gradientCard: ['#14161A', '#262A31'],
  gradientBackground: ['#0B0C0E', '#14161A'],
  gradientButton: ['#2EE6D6', '#2EA7FF'],

  // Glow
  glowAccent: 'rgba(46,167,255,0.25)',
};

// Typography System
export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
  sizes: {
    h1: 44,
    h2: 32,
    h3: 24,
    h4: 20,
    h5: 18,
    bodyLarge: 18,
    body: 16,
    bodySmall: 14,
    caption: 12,
    button: 16,
    link: 16,
    label: 14,
  },
  lineHeights: {
    heading: 1.2,
    body: 1.5,
    caption: 1.4,
  },
};

// Spacing System
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  screenPadding: 20,
  cardPadding: 24,
  buttonPadding: 16,
  inputPadding: 16,
};

// Border Radius System
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 50,
};

// Shadow Styles
export const shadows = {
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heavy: {
    shadowColor: 'rgba(46,167,255,0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Animation Durations
export const animations = {
  quick: 150,
  standard: 300,
  slow: 600,
  extraSlow: 1000,
};

// Screen Dimensions
export const dimensions = {
  width,
  height,
  isSmallDevice: width < 375,
  isTablet: width > 768,
};

// Component Variants
export const variants = {
  button: {
    primary: {
      backgroundColor: 'transparent',
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.buttonPadding,
      paddingVertical: 12,
      gradient: colors.gradientButton, // 💡 NEW: actual gradient reference
      textColor: colors.textPrimary,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.buttonPadding,
      paddingVertical: 12,
      textColor: colors.accent,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      textColor: colors.textMuted,
    },
  },

  card: {
    default: {
      borderRadius: borderRadius.xl,
      padding: spacing.cardPadding,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  },

  input: {
    default: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.inputPadding,
      paddingVertical: 14,
      fontSize: typography.sizes.body,
      color: colors.textPrimary,
    },
  },
};

// Helper functions
export const getTextStyle = (variant: keyof typeof typography.sizes, weight?: keyof typeof typography.weights) => ({
  fontSize: typography.sizes[variant],
  fontWeight: weight ? typography.weights[weight] : typography.weights.regular,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
});

export const getShadowStyle = (level: keyof typeof shadows) => shadows[level];

export const getSpacingStyle = (
  top?: keyof typeof spacing,
  right?: keyof typeof spacing,
  bottom?: keyof typeof spacing,
  left?: keyof typeof spacing
) => ({
  paddingTop: top ? spacing[top] : 0,
  paddingRight: right ? spacing[right] : 0,
  paddingBottom: bottom ? spacing[bottom] : 0,
  paddingLeft: left ? spacing[left] : 0,
});

// Default Theme
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  dimensions,
  variants,
  getTextStyle,
  getShadowStyle,
  getSpacingStyle,
};

export default theme;
