# Design Guidelines: Cartel Bio Page - Dark Web/Watchdogs Aesthetic

## Design Approach: Reference-Based (Watchdogs Game + Dark Web Aesthetic)

**Primary References:** Watchdogs game UI, hacker terminals, dark web interfaces, cyberpunk aesthetics
**Core Principle:** Immersive hacker experience with glitch effects, terminal styling, and dystopian digital atmosphere

## Color Palette

### Dark Mode (Primary)
- **Background Base:** 8 8% 8% (deep charcoal black)
- **Background Elevated:** 140 5% 12% (subtle green-tinted dark)
- **Primary/Accent:** 158 100% 45% (neon cyan/green - hacker terminal)
- **Secondary Accent:** 280 100% 65% (electric purple for warnings/alerts)
- **Text Primary:** 140 80% 85% (bright green-tinted white)
- **Text Secondary:** 140 20% 55% (muted green-gray)
- **Danger/Alert:** 0 85% 60% (corrupted red)
- **Success:** 158 95% 50% (terminal green)

### Effects Colors
- **Glitch RGB:** Red 0 100% 50%, Green 158 100% 45%, Blue 280 100% 65%
- **Scanline Overlay:** 140 50% 20% at 3% opacity

## Typography

**Font Stack:**
- Primary: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace (terminal aesthetic)
- Display/Headers: 'Space Mono', 'Share Tech Mono', monospace (wider, more impact)

**Scale:**
- Terminal Prompt: text-xs to text-sm (10-14px)
- Body Text: text-sm to text-base (14-16px)
- Section Headers: text-2xl to text-4xl (24-36px) - uppercase, tracked spacing
- Hero/ASCII Art: text-6xl to text-8xl (custom sizing for ASCII)

**Styling:**
- All text with slight letter-spacing (tracking-wide/wider)
- Headers: UPPERCASE with extra tracking
- Code blocks: bg with subtle glow effect
- Animated typing effect for hero text

## Layout System

**Spacing Primitives:** Tailwind units of 1, 2, 4, 8, 16 (tight, precise spacing like terminal layouts)

**Grid Structure:**
- Full-viewport sections with CRT curvature effect on container
- Terminal window-style boxes with borders
- Asymmetric split layouts (70/30, 60/40) for data/content
- Padding: py-8 to py-16 (compact, information-dense)

**Containers:**
- Max width: max-w-7xl for main content
- Terminal boxes: max-w-4xl with border effects
- Content blocks: p-6 to p-8 with glitch borders

## Component Library

### Navigation
- Fixed top bar styled as system status bar
- Glitch text logo with flicker animation
- Menu items with terminal cursor hover (> indicator)
- Background: semi-transparent with backdrop blur

### Hero Section
- Full-screen terminal interface (80vh)
- Large ASCII art logo or "CARTEL" with animated drawing effect
- Typing animation for tagline/description
- CRT scanline overlay effect
- Glitch distortion on hover/interval
- Prominent Discord join CTA with pulsing effect

### Content Sections

**About/Info Blocks:**
- Terminal window styling with header bar (• • • controls)
- Green phosphor glow on borders
- Line numbers on left side
- Content with typing animation on scroll-in

**Discord Integration:**
- Large widget styled as system notification
- Member count with live update animation
- Glowing join button with hack-in effect
- Server stats in terminal readout format

**Rules/Guidelines:**
- Numbered list with terminal prompt ($ or >)
- Each rule in code block styling
- Warning/Alert items with red accent
- Collapsible sections with glitch transition

**Links/Social:**
- Icon grid with hexagonal or circuit-board layout
- Neon glow on hover
- Connection lines between icons (circuit aesthetic)
- Platform names in terminal text

### Interactive Elements

**Buttons:**
- Primary: Solid neon green with shadow glow, uppercase text
- Secondary: Outline with green border, transparent bg with blur if on images
- Hover: Intensify glow, subtle glitch effect
- No additional hover states needed - built-in states handle all contexts

**Forms (if needed):**
- Input fields: terminal style with cursor blink
- Labels as terminal prompts (> Enter name:)
- Focus state: bright green border glow

### Special Effects

**Global:**
- Subtle CRT curve on main container (border-radius minimal)
- Animated scanlines moving top-to-bottom (3-5s loop)
- Random glitch effect every 8-12 seconds
- VHS tracking lines occasionally

**Text Effects:**
- Typing animation for hero and section reveals
- Glitch distortion on headers (RGB split, 2-3px offset)
- Matrix rain background (optional, very subtle, low opacity)

**Cursor:**
- Custom crosshair cursor or terminal block cursor
- Change to pointer with green glow on interactive elements

## Images

**Approach:** Minimal - aesthetic is code/terminal driven

**If Used:**
- Background: Subtle matrix code rain or circuit patterns (very dark, 5-10% opacity)
- Hero: Optional glitchy cityscape or abstract data visualization (heavily filtered/processed)
- Decorative: Corrupted/glitched images as section dividers
- Format: All images with intentional digital artifacts, scan lines, chromatic aberration

**Hero Image (if used):** Full-width, heavily processed dark cyberpunk cityscape with green/cyan color grading, positioned behind terminal overlay with strong blur and darkness (30% opacity max)

## Accessibility & Polish

- Maintain minimum 4.5:1 contrast despite glitch effects
- Provide option to reduce motion (disable animations)
- All text remains readable even with effects
- Focus indicators with strong green glow
- Keyboard navigation with visual terminal-style feedback

## Animation Guidelines

**Use Sparingly but Impactfully:**
- Hero typing effect (once on load)
- Scanline continuous subtle animation
- Glitch effects: triggered, not constant (every 10s or on interaction)
- Section reveals: terminal boot-up sequence
- Hover effects: subtle glow intensification

**Performance:**
- Use CSS transforms/opacity for smooth animations
- Limit simultaneous effects
- Provide reduce-motion fallbacks

## Page Structure

1. **System Boot Header** - Terminal-style loading bar transitioning to navigation
2. **Hero Terminal** - Full-screen ASCII art + typing tagline + Discord CTA
3. **Server Info Block** - Terminal window with stats and description
4. **About/Mission** - Code-style content with line numbers
5. **Rules Section** - Terminal command list format
6. **Discord Widget** - Prominent join interface with live stats
7. **Links/Connections** - Circuit-board style link grid
8. **Footer** - System status bar with minimal info

**Critical:** Every section should feel like a different terminal window or system interface - varied but cohesive hacker aesthetic throughout.