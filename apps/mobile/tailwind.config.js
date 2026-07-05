/**
 * Tailwind config for @qingmalaya/mobile.
 * Color tokens are imported directly from @qingmalaya/shared so the mobile
 * palette stays in lockstep with DESIGN.md and the shared design tokens.
 *
 * NOTE: We require() the shared TS source directly (the workspace package's
 * `main` field points at src/index.ts). Taro's webpack5 runner is configured
 * to run babel over packages/shared/src via config/h5.ts -> compile.include,
 * so importing TS here is safe at build time.
 */
const { colors, typography, rounded } = require('@qingmalaya/shared')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Material 3 surface stack
        surface: colors.surface,
        'surface-dim': colors['surface-dim'],
        'surface-bright': colors['surface-bright'],
        'surface-container-lowest': colors['surface-container-lowest'],
        'surface-container-low': colors['surface-container-low'],
        'surface-container': colors['surface-container'],
        'surface-container-high': colors['surface-container-high'],
        'surface-container-highest': colors['surface-container-highest'],
        'surface-variant': colors['surface-variant'],
        'surface-tint': colors['surface-tint'],
        'on-surface': colors['on-surface'],
        'on-surface-variant': colors['on-surface-variant'],
        'inverse-surface': colors['inverse-surface'],
        'inverse-on-surface': colors['inverse-on-surface'],
        // Primary
        primary: colors.primary,
        'on-primary': colors['on-primary'],
        'primary-container': colors['primary-container'],
        'on-primary-container': colors['on-primary-container'],
        'inverse-primary': colors['inverse-primary'],
        'primary-fixed': colors['primary-fixed'],
        'primary-fixed-dim': colors['primary-fixed-dim'],
        'on-primary-fixed': colors['on-primary-fixed'],
        'on-primary-fixed-variant': colors['on-primary-fixed-variant'],
        // Secondary
        secondary: colors.secondary,
        'on-secondary': colors['on-secondary'],
        'secondary-container': colors['secondary-container'],
        'on-secondary-container': colors['on-secondary-container'],
        'secondary-fixed': colors['secondary-fixed'],
        'secondary-fixed-dim': colors['secondary-fixed-dim'],
        'on-secondary-fixed': colors['on-secondary-fixed'],
        'on-secondary-fixed-variant': colors['on-secondary-fixed-variant'],
        // Tertiary
        tertiary: colors.tertiary,
        'on-tertiary': colors['on-tertiary'],
        'tertiary-container': colors['tertiary-container'],
        'on-tertiary-container': colors['on-tertiary-container'],
        'tertiary-fixed': colors['tertiary-fixed'],
        'tertiary-fixed-dim': colors['tertiary-fixed-dim'],
        'on-tertiary-fixed': colors['on-tertiary-fixed'],
        'on-tertiary-fixed-variant': colors['on-tertiary-fixed-variant'],
        // Error
        error: colors.error,
        'on-error': colors['on-error'],
        'error-container': colors['error-container'],
        'on-error-container': colors['on-error-container'],
        // Outline
        outline: colors.outline,
        'outline-variant': colors['outline-variant'],
        // Background
        background: colors.background,
        'on-background': colors['on-background']
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'PingFang SC', 'sans-serif']
      },
      borderRadius: {
        sm: rounded.sm,
        DEFAULT: rounded.DEFAULT,
        md: rounded.md,
        lg: rounded.lg,
        xl: rounded.xl,
        full: rounded.full
      }
    }
  },
  plugins: []
}
