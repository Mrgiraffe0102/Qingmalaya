---
name: Qing Malaya
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#424849'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#727879'
  outline-variant: '#c2c7c8'
  surface-tint: '#4d6265'
  primary: '#4d6265'
  on-primary: '#ffffff'
  primary-container: '#e0f7fa'
  on-primary-container: '#5d7275'
  inverse-primary: '#b4cbce'
  secondary: '#326578'
  on-secondary: '#ffffff'
  secondary-container: '#b5e7fe'
  on-secondary-container: '#37697d'
  tertiary: '#556158'
  on-tertiary: '#ffffff'
  tertiary-container: '#e9f6ea'
  on-tertiary-container: '#657168'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e7ea'
  primary-fixed-dim: '#b4cbce'
  on-primary-fixed: '#091f21'
  on-primary-fixed-variant: '#364a4d'
  secondary-fixed: '#bbe9ff'
  secondary-fixed-dim: '#9ccee4'
  on-secondary-fixed: '#001f29'
  on-secondary-fixed-variant: '#154d5f'
  tertiary-fixed: '#d9e6da'
  tertiary-fixed-dim: '#bdcabe'
  on-tertiary-fixed: '#131e17'
  on-tertiary-fixed-variant: '#3e4a41'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 20px
  gutter: 12px
---

## Brand & Style

The brand personality for the design system is centered on academic clarity and youthful energy. It serves a community of higher-education students, requiring a balance between a professional educational tool and a modern social platform. The emotional response should be one of "focused calm"—eliminating digital noise to prioritize auditory learning and student discourse.

The design style is **Minimalist** with **Glassmorphism** accents. It utilizes heavy whitespace to reduce cognitive load, paired with soft, translucent layers for floating elements to maintain a sense of depth without visual clutter. Subtle, flat light arcs are used as background motifs to break geometric rigidity, suggesting a path of growth and continuous motion.

## Colors

The palette is designed to be airy and non-intrusive. The primary colors (Light Cyan and Light Blue) are used for high-frequency interactions and brand signifiers. Secondary accents (Mint Green, Grey-Purple, and Warm Orange) serve as categorical identifiers for different podcast genres or student activities, ensuring the UI remains vibrant yet organized.

Backgrounds utilize "Soft White" (#F9FAFB) to reduce eye strain during long listening sessions. Borders and dividers use a subtle Light Gray to provide structure without creating hard visual breaks. Interactive elements leverage the primary palette to signal affordance.

## Typography

This design system utilizes **Inter** as the primary typeface for its exceptional legibility and systematic feel, serving as a clean alternative to PingFang SC for global consistency. 

- **Headlines:** Use Bold and Semi-Bold weights to establish clear hierarchy for episode titles and section headers.
- **Body Text:** Uses a Regular weight with generous line height (150%) to ensure readability for episode descriptions.
- **Labels:** Meta-information such as "Student ID," "Class," or "Time Remaining" are set in `label-md` using uppercase or slightly heavier weights to distinguish them from narrative content.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first consumption. It utilizes a 4-column structure for mobile devices with a standard 20px outer margin to give content "room to breathe."

- **Rhythm:** An 8px linear scale governs all padding and margins to ensure a consistent vertical rhythm.
- **Safe Areas:** Special consideration is given to the bottom of the screen to accommodate the floating island navigation bar and the integrated playback bar.
- **Reflow:** On larger tablet screens, the layout transitions to a 12-column grid, with content cards restricted to a maximum width to maintain readability.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Glassmorphism**. 

- **Level 0 (Base):** The main application background in soft white.
- **Level 1 (Cards):** Elevated cards use a very subtle, diffused ambient shadow (0px 4px 20px rgba(0,0,0,0.04)) and a 1px solid border in `neutral_stroke_hex`.
- **Level 2 (Floating Islands):** The bottom navigation bar and the playback bar utilize a backdrop blur (20px) and a semi-transparent white fill (80% opacity) to create a "floating" effect over the content.
- **Interactive Depth:** Buttons do not use heavy shadows; instead, they use slight tonal shifts or scale-down transforms (0.98x) on press to provide tactile feedback.

## Shapes

The shape language is consistently **Rounded**, reflecting a friendly and accessible educational environment.

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) radius.
- **Featured Elements:** Large episode cover art and "Floating Island" containers use `rounded-xl` (1.5rem/24px) to emphasize their distinct presence.
- **Icons:** Icons should follow a rounded-cap stroke style to match the UI's geometry.

## Components

### Floating Navigation & Playback
- **Floating Island Nav:** A detached container positioned 16px from the screen bottom. It features 5 tabs. Active tabs are indicated by a primary blue tint and a subtle dot indicator; inactive tabs remain in a muted gray.
- **Integrated Playback Bar:** Positioned immediately above the navigation island. It shares the glassmorphic style and contains a mini-progress bar at the top edge, play/pause controls, and the current track title.

### Cards & Lists
- **Podcast Cards:** Use a vertical stack with the cover image at the top (rounded 16px). Metadata (Student Name, Class) is placed in `label-sm` above the title.
- **List Items:** Feature a leading rounded image (48px) and trailing chevron or context menu icon.

### Controls
- **Buttons:** Primarily pill-shaped for "Follow" or "Play" actions. Primary buttons use a gradient of `primary_color_hex` to `secondary_color_hex`.
- **Input Fields:** Soft gray backgrounds with no borders, transitioning to a primary blue border on focus.
- **Chips:** Used for "Subject Tags" (e.g., #Philosophy, #Design). These use the secondary accent colors (Mint, Purple, Orange) at 15% opacity with matching colored text.