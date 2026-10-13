---
name: Inflation Station
description: A quiet, compact workbench for importing, categorizing, and reviewing a month of personal spending.
colors:
  ember: "oklch(0.72 0.14 52)"
  ember-ink: "oklch(0.12 0.02 48)"
  ember-light: "oklch(0.55 0.13 48)"
  ember-ring: "oklch(0.72 0.14 48)"
  graphite-bg: "oklch(0.145 0 0)"
  graphite-surface: "oklch(0.205 0 0)"
  graphite-raised: "oklch(0.269 0 0)"
  bone-text: "oklch(0.985 0 0)"
  ash-text: "oklch(0.708 0 0)"
  hairline: "oklch(1 0 0 / 10%)"
  input-wash: "oklch(1 0 0 / 15%)"
  paper-bg: "oklch(1 0 0)"
  paper-text: "oklch(0.145 0 0)"
  ledger-green: "oklch(0.65 0.15 148)"
  caution-ochre: "oklch(0.75 0.14 72)"
  overspend-red: "oklch(0.704 0.191 22.216)"
  uncategorized-grey: "oklch(72% 0 0)"
  deck-ink: "#0E0B1F"
  deck-cream: "#FFF6E5"
  deck-volt: "#D7FF3A"
  deck-lime: "#C6F432"
  deck-signal-red: "#FF4D3D"
  deck-violet: "#4C2EE6"
  deck-steel: "#BFD4FF"
  deck-coral: "#FF7A59"
  deck-amber: "#FFC93C"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
  deck-display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4.5rem, 24vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 62"
  deck-headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 7vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  deck-label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "26px"
spacing:
  card-sm: "12px"
  card: "16px"
  gutter: "20px"
  gutter-wide: "40px"
  page-y: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bone-text}"
    textColor: "{colors.graphite-surface}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.input-wash}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-destructive:
    backgroundColor: "{colors.overspend-red}"
    textColor: "{colors.overspend-red}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  input:
    backgroundColor: "{colors.input-wash}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  badge:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  category-badge-uncategorized:
    backgroundColor: "{colors.uncategorized-grey}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  brand-wordmark:
    textColor: "{colors.ember}"
    typography: "{typography.body}"
  deck-control-primary:
    backgroundColor: "{colors.deck-volt}"
    textColor: "{colors.deck-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
---

# Design System: Inflation Station

## Overview

**Creative North Star: "The Quiet Workbench"**

Inflation Station is a tool you sit down at once a month, at a desk, with a stack of statements to get through. The system is built for that: compact, calm, and precise. The interface steps back so amounts, merchants and categories carry the screen. Controls are small (32px tall), body text is 14px, and surfaces are separated by hairline rings rather than shadows. One warm ember accent marks the brand and focus. Everything else is graphite and bone.

The workbench is dark-first. Dark is the default theme, and the light theme is a full equal, not an afterthought. Users pick from four palettes (Ember, Ocean, Botanical, Plum). Each palette re-tints every neutral and the accent toward its hue. Status colours (green for success, ochre for warning, red for destructive) never change, so a red amount means the same thing in every palette.

There is exactly one sanctioned exception: the **Month in Review deck**. When the month is told back to the user, the workbench gives way to a loud, full-bleed poster. It uses flat saturated grounds, ink and cream, Archivo at weight 900 with condensed numerals, and wipe-up motion. That register lives only inside the deck and never leaks back into the tool.

**Key Characteristics:**
- Compact, desktop-first density: 32px controls, 14px body, 12px labels.
- Graphite neutrals with a single warm ember accent; palettes re-tint the neutrals and accent but leave status colours alone.
- Flat surfaces separated by 1px rings at 10% foreground; shadows only on floating overlays.
- Gently rounded (10px base radius); pills only for badges.
- A single loud register, scoped strictly to the Month in Review deck.

## Colors

Achromatic graphite and bone carry almost the entire screen, with one warm ember accent and a fixed set of status colours. The values below are the default **Ember** palette in dark mode, the normative state. Other palettes and light mode are re-tints with the same roles; they are defined in `src/app/globals.css`.

### Primary
- **Ember** (`--brand`): the brand voice. Used for the "Inflation Station" wordmark in the header, brand-filled highlights, and the sidebar-primary role. Light mode uses the deeper **Ember Light** for contrast on white.
- **Ember Ring** (`--ring`): every focus ring, at 50% opacity, 3px wide. Focus is the one place the accent appears on every screen.

### Neutral
- **Graphite Background** (`--background`): page ground.
- **Graphite Surface** (`--card`, `--popover`): cards, popovers, dialogs, sidebar.
- **Graphite Raised** (`--secondary`, `--muted`, `--accent`): secondary buttons, hover fills, muted wells, table row hovers.
- **Bone Text** (`--foreground`): primary text, and the fill of the default (primary) button, which is bone-on-graphite rather than ember.
- **Ash Text** (`--muted-foreground`): descriptions, secondary metadata, placeholder text.
- **Hairline** (`--border`) and **Input Wash** (`--input`): translucent white at 10% and 15%. They draw dividers, card rings and field strokes, and tint field backgrounds at 30%.
- **Paper Background / Paper Text**: the light-mode ground and ink.

### Status
- **Ledger Green** (`--success`): confirmed, saved, money in.
- **Caution Ochre** (`--warning`): needs attention, low-confidence suggestions, unresolved import rows.
- **Overspend Red** (`--destructive`): errors, deletion, overspend. Destructive buttons use it as tinted text on a 20% wash, never as a solid fill.

### Category colours
Each category gets a deterministic hue from its name (`getDeterministicColorFromText`, "muted" profile: chroma 0.14, lightness 64%). Text colour is chosen for at least 7:1 contrast. The one fixed exception is **Uncategorized Grey**, a neutral fallback with its own light and dark text colours. Category colours belong to data, not chrome.

### Month in Review deck worlds
The deck has its own closed palette in `month-in-review.worlds.ts`. Each "world" is a flat background, a foreground, an accent and a muted colour, built from **Deck Ink** and **Deck Cream** plus one saturated ground: Volt on Ink, Lime, Signal Red, Violet, Steel, Coral or Amber. Slides switch worlds with a 450ms colour transition.

### Named Rules
**The Status Is Sacred Rule.** Palettes never override `success`, `warning` or `destructive`. A palette's light and dark blocks declare the same custom properties (`theme-palettes.test.ts` enforces this).

**The Bone Button Rule.** The primary button is bone-on-graphite (inverted to ink-on-paper in light mode), not ember. Ember is reserved for brand and focus; it does not mean "click here".

**The Closed Deck Palette Rule.** Deck world colours appear only inside `.mir-deck`. App chrome never uses Volt, Lime, Signal Red or any other deck ground.

## Typography

**Body Font:** Plus Jakarta Sans (with ui-sans-serif, system-ui)
**Mono Font:** Geist Mono (with ui-monospace)
**Deck Font:** Archivo, variable width (Month in Review only)

**Character:** Plus Jakarta Sans gives the workbench a friendly but precise geometric voice at small sizes. Geist Mono marks machine-ish values: build info, raw imported strings, IDs. Archivo at weight 900 and condensed width is the deck's shouting voice.

### Hierarchy
- **Headline** (600, 1.5rem, tight tracking): page `h1`, one per route. Grows to 1.875rem on wide screens only where a page has room.
- **Title** (600, 1.25rem, tight tracking): section `h2` within a page.
- **Card Title** (500, 1rem): card headers; 0.875rem in small cards.
- **Body** (400, 0.875rem): the workhorse. Tables, forms, descriptions, buttons. Inputs use 1rem on narrow screens (to prevent zoom on focus) and 0.875rem from `md` up.
- **Label** (500, 0.75rem): badges, helper text, nav-menu descriptions, table metadata.
- **Mono** (400, 0.75rem): raw values and build metadata.
- **Deck Display** (900, clamp 4.5–6rem, line height 0.9, condensed): the single giant number on a deck slide.
- **Deck Headline** (800, clamp 2–4rem): slide statements, balanced wrap.
- **Deck Label** (600, 0.875rem, uppercase, 0.08em tracking): definition-list terms in the deck. The only routine uppercase in the product.

### Named Rules
**The Small Type Rule.** The workbench tops out at 1.5rem (1.875rem at most). Big type belongs to the deck. A large number in app chrome is a bug, not emphasis.

**The Tabular Money Rule.** Columns of amounts use `tabular-nums` so digits line up; the deck sets it globally.

## Layout

The app is a centered single column: `max-w-6xl` (72rem), with 20px gutters widening to 40px from `md`, and 32px vertical page padding. A sticky header (translucent background at 95%, backdrop blur, bottom hairline) holds the wordmark and the primary navigation on the same container width.

Density is high and deliberate: 32px controls, 16px card padding (12px for small cards), and 12–24px gaps between related groups. Lists of transactions are tables, not cards. The layout is designed for desktop, and narrow viewports only need to stay usable, not optimized. Since a Norwegian UI is planned, labels and buttons must tolerate longer words without clipping; avoid fixed-width text containers.

The Month in Review deck is full-bleed and slide-based, ignoring the app container entirely.

## Elevation & Depth

The workbench is flat by default. Resting surfaces are separated by tone (graphite background → graphite surface → graphite raised) plus a 1px ring at 10% foreground. Shadows appear only on things that float above the page: popovers, dropdowns, selects, comboboxes, hover cards and the navigation menu panel (`shadow-md` to `shadow-lg`). Interactive feedback is a background-tone shift, not a lift. The single tactile cue is a 1px press-down on active buttons.

### Named Rules
**The Float-Only Shadow Rule.** If it scrolls with the page, it has no shadow. Shadows mean "this is on top of the page".

## Shapes

Gently rounded throughout, all derived from a 10px base radius (`--radius: 0.625rem`). Inputs and buttons use 10px; small buttons tighten to 8px; cards use 14px with images clipped to match. Badges and the deck's controls are full pills. Borders are hairlines, never heavier than 1px in the workbench. The deck uses 2px underlines and 3px focus outlines, its louder voice.

## Components

### Buttons
Compact and quiet. A button reads as a tool, not a call to action.
- **Shape:** gently rounded (10px), 32px tall, 10px horizontal padding, 14px medium text, 16px icons with a 6px gap.
- **Primary:** bone fill, graphite text; hover drops the fill to 80%.
- **Outline:** input-wash fill (30%) with an input stroke; hover deepens the wash to 50%.
- **Secondary / Ghost:** raised graphite fill, or transparent with a muted hover fill.
- **Destructive:** overspend-red text on a 20% red wash; hover deepens to 30%. Never a solid red slab.
- **Focus:** ring-colour border plus a 3px ember ring at 50%. **Active:** 1px press-down. **Disabled:** 50% opacity, no pointer events.
- **Sizes:** xs 24px, sm 28px, default 32px, lg 36px, with matching square icon buttons.

### Badges and category badges
- **Badge:** 20px pill, 12px medium text, 8px horizontal padding.
- **Category badge:** a ghost badge filled with the category's deterministic colour, a darker border of the same hue, and contrast-checked text that switches between light and dark mode. Uncategorized is always the neutral grey.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** graphite surface.
- **Shadow Strategy:** none; a 1px ring at 10% foreground (see Elevation & Depth).
- **Internal Padding:** 16px (12px in small cards); footers sit on a 50% muted wash under a top hairline.

### Inputs / Fields
- **Style:** 32px tall, 10px radius, 1px input stroke, input-wash background at 30% in dark mode; placeholder in ash.
- **Focus:** stroke turns ring colour plus a 3px ember ring at 50%, the same as buttons.
- **Error / Disabled:** `aria-invalid` draws a red stroke and a 20% red ring; disabled drops to 50% opacity on a denser wash.

### Navigation
A single horizontal row in the sticky header: the ember wordmark, then flat text links (Transactions, Import, Monthly Review), then a **Configuration** trigger. The trigger opens a floating panel listing settings, each as a medium label over a two-line ash description. Hover and active states are muted-fill tone shifts.

### Toasts
Success and failure feedback for mutations goes through Sonner toasts, not inline text.

### Month in Review deck (signature)
A full-bleed slide deck scoped under `.mir-deck`. Each slide picks a deck world, which sets four custom properties (`--mir-bg`, `--mir-fg`, `--mir-accent`, `--mir-muted`). Type is Archivo with tabular numerals; giant condensed weight-900 numbers carry the key figures. Motion uses one expressive ease (`cubic-bezier(0.16, 1, 0.3, 1)`): a clip-path wipe-up for headlines (800ms), bars that grow from the left (900ms), stepped ticks for list rows (240ms), and 450ms colour cross-fades between worlds. Everything respects `prefers-reduced-motion`. Controls are pills: an outlined accent pill and a solid accent pill with the background colour as text. Focus is a 3px accent outline at a 3px offset.

## Do's and Don'ts

### Do:
- **Do** use semantic tokens (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`) rather than hard-coded palette classes, so all four palettes and both modes keep working.
- **Do** keep controls at the 32px default and body at 14px; reach for `sm` or `xs` sizes in dense tables rather than enlarging anything.
- **Do** separate resting surfaces with tone and 1px rings; save shadows for overlays.
- **Do** use the shared table primitives for transaction lists and `ChartContainer` for overview charts.
- **Do** colour categories only through `getCategoryColor`, and keep Uncategorized neutral.
- **Do** add any new palette as a matching light and dark block that declares the same properties and leaves status colours alone.
- **Do** let labels grow: Norwegian copy is coming, so no fixed-width text slots.

### Don't:
- **Don't** use ember as a primary-button fill or generic highlight; it is brand and focus only.
- **Don't** bring deck colours, Archivo, weight-900 type or wipe animations into the workbench.
- **Don't** put shadows on cards, rows or anything that scrolls with the page.
- **Don't** override `success`, `warning` or `destructive` inside a palette.
- **Don't** fill destructive buttons with solid red.
- **Don't** set type above 1.875rem outside the Month in Review deck.
