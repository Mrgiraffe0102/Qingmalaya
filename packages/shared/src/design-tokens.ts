/**
 * Design tokens derived from DESIGN.md frontmatter.
 * Material 3 color palette, Inter type scale, rounded radii, and 8px spacing rhythm.
 * Do NOT edit values by hand — realign against DESIGN.md.
 */

export interface TextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}

export const colors = {
  surface: '#fbf9f8',
  'surface-dim': '#dbdad9',
  'surface-bright': '#fbf9f8',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f5f3f3',
  'surface-container': '#efeded',
  'surface-container-high': '#e9e8e7',
  'surface-container-highest': '#e3e2e2',
  'on-surface': '#1b1c1c',
  'on-surface-variant': '#424849',
  'inverse-surface': '#303031',
  'inverse-on-surface': '#f2f0f0',
  outline: '#727879',
  'outline-variant': '#c2c7c8',
  'surface-tint': '#4d6265',
  primary: '#4d6265',
  'on-primary': '#ffffff',
  'primary-container': '#e0f7fa',
  'on-primary-container': '#5d7275',
  'inverse-primary': '#b4cbce',
  secondary: '#326578',
  'on-secondary': '#ffffff',
  'secondary-container': '#b5e7fe',
  'on-secondary-container': '#37697d',
  tertiary: '#556158',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#e9f6ea',
  'on-tertiary-container': '#657168',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  'primary-fixed': '#d0e7ea',
  'primary-fixed-dim': '#b4cbce',
  'on-primary-fixed': '#091f21',
  'on-primary-fixed-variant': '#364a4d',
  'secondary-fixed': '#bbe9ff',
  'secondary-fixed-dim': '#9ccee4',
  'on-secondary-fixed': '#001f29',
  'on-secondary-fixed-variant': '#154d5f',
  'tertiary-fixed': '#d9e6da',
  'tertiary-fixed-dim': '#bdcabe',
  'on-tertiary-fixed': '#131e17',
  'on-tertiary-fixed-variant': '#3e4a41',
  background: '#fbf9f8',
  'on-background': '#1b1c1c',
  'surface-variant': '#e3e2e2',
} as const;

export const typography: Record<string, TextStyle> = {
  'display-lg': {
    fontFamily: 'Inter',
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '40px',
    letterSpacing: '-0.02em',
  },
  'headline-md': {
    fontFamily: 'Inter',
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '32px',
    letterSpacing: '-0.01em',
  },
  'headline-sm': {
    fontFamily: 'Inter',
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: '28px',
  },
  'body-lg': {
    fontFamily: 'Inter',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '24px',
  },
  'body-md': {
    fontFamily: 'Inter',
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '20px',
  },
  'label-md': {
    fontFamily: 'Inter',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '16px',
    letterSpacing: '0.05em',
  },
  'label-sm': {
    fontFamily: 'Inter',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '14px',
  },
  'headline-md-mobile': {
    fontFamily: 'Inter',
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: '28px',
  },
};

export const rounded = {
  sm: '0.25rem',
  DEFAULT: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
} as const;

export const spacing = {
  base: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  'container-padding': '20px',
  gutter: '12px',
} as const;

export const designTokens = {
  colors,
  typography,
  rounded,
  spacing,
} as const;
