# Portfolio Website — Russel Janzen E. Mamaclay

## Overview

A minimalist, interactive, dark-first personal portfolio for a Data Scientist / ML Engineer. The design language is **restrained and deliberate** — heavy use of negative space, monochromatic base with teal accents, smooth choreographed transitions, and micro-interactions that reward curiosity. Think: verse.sh meets a data scientist's aesthetic.

---

## Design System

### Colors

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#000000` | Page background |
| `--color-surface` | `#0f0f0f` | Cards, panels |
| `--color-surface-2` | `#1a1a1a` | Elevated elements |
| `--color-border` | `#2a2a2a` | Dividers, outlines |
| `--color-text-primary` | `#f5f5f5` | Headings, primary text |
| `--color-text-secondary` | `#888888` | Labels, metadata |
| `--color-text-muted` | `#444444` | Timestamps, captions |
| `--color-accent` | `#008080` | Teal — highlights, active states |
| `--color-accent-glow` | `rgba(0,128,128,0.15)` | Glow effects |
| `--color-accent-soft` | `#005f5f` | Hover states |

**Light Mode Overrides:**
| Token | Value |
|---|---|
| `--color-bg` | `#ffffff` |
| `--color-surface` | `#f5f5f5` |
| `--color-surface-2` | `#ebebeb` |
| `--color-border` | `#e0e0e0` |
| `--color-text-primary` | `#0a0a0a` |
| `--color-text-secondary` | `#555555` |
| `--color-text-muted` | `#aaaaaa` |

### Typography

```css
/* Display / Name */
font-family: 'Syne', sans-serif;
font-weight: 800;

/* Body / UI */
font-family: 'DM Sans', sans-serif;
font-weight: 400;

/* Mono / Labels / Dates */
font-family: 'JetBrains Mono', monospace;
font-weight: 400;
```

### Motion Principles

- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — snappy spring feel
- **Duration scale:** 150ms (micro), 300ms (standard), 600ms (page), 1200ms (entrance)
- **Stagger:** 80ms between sibling elements
- **Principle:** Animate only `opacity`, `transform`, and `filter` (GPU-friendly)
- **Loading states:** Skeleton shimmer using gradient animation

---

## Workflow (Build Instructions)

When given a reference image, CSS notes, or a page section to implement:

1. **Generate** a single `index.html` file using Tailwind CSS via CDN. All content inline — no external files unless specified.
2. **Screenshot** the rendered page using Puppeteer (`npx puppeteer screenshot index.html --fullpage` or equivalent). Capture distinct sections separately.
3. **Compare** screenshot against reference. Check for:
   - Spacing and padding (in px)
   - Font sizes, weights, line heights
   - Colors (exact hex values)
   - Alignment and positioning
   - Border radii, shadows, effects
   - Responsive behavior
   - Icon/image sizing and placement
4. **Fix** every mismatch found.
5. **Re-screenshot** and compare again.
6. **Repeat** steps 3–5 until within ~2–3px everywhere.

> Do NOT stop after one pass. Always complete at least 2 comparison rounds.

### Technical Defaults

- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/`
- Mobile-first responsive design
- Single `index.html` unless otherwise requested
- Dark mode default; light mode via `class="light"` on `<html>`

---

## Pages

---

### Landing Page (`index.html`)

**Purpose:** First impression. Pure atmosphere. No clutter.

**Sequence:**

1. **Loading animation** (1.5–2s)
   - Centered teal pulsing dot or a minimal animated SVG mark
   - Subtle scan-line or noise texture overlay fades in
   - Smooth exit via `opacity: 0` + upward translate

2. **Name reveal**
   - `RUSSEL JANZEN E. MAMACLAY` in large Syne 800 weight
   - Letter-by-letter stagger animation (opacity + slight upward translate)
   - Appears at vertical center of screen

3. **Role typewriter cycle**
   - Below the name, monospace font cycles through:
     - `Data Enthusiast`
     - `Data Scientist`
     - `Machine Learning Engineer`
   - Typewriter effect with blinking cursor
   - Each phrase holds for ~1.5s before erasing

4. **Dock navigation**
   - Appears after roles finish cycling (~4–5s total)
   - Centered horizontal row of icon buttons (macOS dock inspired)
   - Icons: About · Timeline · Projects · Skills · Contact
   - Hovering an icon shows a label above it + scale-up animation (1.0 → 1.2)
   - Neighbor icons slightly scale up too (dock magnification effect)
   - Active icon glows with `--color-accent-glow`
   - One small dot indicator on the active section's icon

5. **Dark/Light mode toggle**
   - Fixed top-right corner
   - Sun/Moon icon, smooth icon morph on toggle
   - Persisted in `localStorage`

6. **Background**
   - Pure black `#000000`
   - Optional: very subtle animated gradient mesh (teal + dark purple) at low opacity (~5%) using CSS `@keyframes`

---

### About

**Layout:** Full-screen overlay or page. Centered content, max-width ~680px.

**Sections:**

- **Avatar / photo** — circular, bordered with thin teal ring
- **Name + tagline** — brief 2-line intro (who I am, what I do)
- **Bio paragraph** — 3–4 sentences about background, interests, and approach
- **Location badge** — monospace label, e.g. `📍 Philippines`
- **Contact info row** — Email · LinkedIn (icon links, subtle hover underline)
- **Testimonials** — horizontal scroll or carousel
  - Card per testimonial: quote, name, role, avatar
  - Soft background `--color-surface`, rounded `12px`

**Nav / Exit:**
- Top nav bar with links to other pages
- `×` button (top-right) returns to Landing Page dock view
- Nav links styled as minimal text, teal underline on hover

---

### Timeline

**Layout:** Single-column scrollable page with a vertical timeline spine.

**Toggle:**
- Two pill buttons at top: `Education` · `Experience`
- Can select both simultaneously → merged chronological view
- Active state: filled teal background, white text
- Inactive: outlined, muted text

**Timeline item:**
- Date on the left (monospace, muted color)
- Circle node on the spine: hollow ring (default), filled teal (active/current)
- Content on the right:
  - Institution / Company name (bold)
  - Role / Degree
  - Date range
  - Short description
  - Optional: image thumbnail (project screenshot, institution logo)
- Entry animation: fade-in + slide from right as user scrolls into view (Intersection Observer)

**Current status indicator:**
- Topmost (latest) entry uses a glowing green dot (like verse.sh reference) for "active/present"

**Nav / Exit:**
- Top nav bar
- `×` button returns to Landing Page dock view

---

### Projects

**Layout:** Full-screen canvas with scattered draggable cards.

**Card behavior:**
- Cards are positioned with slight random rotation (–8° to +8°) and offset
- Drag: user can freely reposition cards anywhere on canvas
- Cards in a "stack" group by default (3–4 cards stacked per group, like the reference images)
- `grab` cursor on hover, `grabbing` while dragging

**Card states:**

1. **Front (default)**
   - Project name in large Syne bold text
   - Minimal — name only, clean white card on dark background
   - Slight box shadow for depth

2. **Flipped (on click)**
   - CSS 3D card flip (`rotateY(180deg)`)
   - Back shows:
     - Project icon / logo (top-left)
     - Project name (heading)
     - Screenshot or preview image
     - 1–2 sentence description
     - `Visit →` or `Repo →` button (teal, subtle)

3. **Interaction hint**
   - Bottom center: `Drag a card to move it around, or click to flip it over.`
   - Fades out after 3s on first visit

**Nav / Exit:**
- `×` button (top-center, like reference image 4) returns to dock
- Twitter / mail icon links preserved in center for quick contact

---

### Skills & Certifications

**Layout:** Two-section scrollable page.

**Skills Section:**
- Grid of tech stack items
- Each item:
  - Technology logo (SVG icon)
  - Name label
  - Horizontal progress bar (fills left to right on scroll into view)
  - Percentage label (e.g. `82%`)
  - Bar color: teal gradient (`#005f5f` → `#008080`)
- Categories: Languages · Libraries & Frameworks · Tools & Platforms · Data & ML

**Certifications Section:**
- Card grid (2–3 columns on desktop, 1 on mobile)
- Each card:
  - Certification badge / logo
  - Certificate name
  - Issuing organization
  - Issue date (monospace)
  - Short 1–2 line description
  - Optional: verify link

**Nav / Exit:**
- Top nav bar
- `×` button returns to Landing Page dock view

---

### Contact

**Behavior:** Modal / popup overlay (not a full page).

**Triggered by:** Clicking the Contact icon in the dock.

**Content:**
- Brief heading: `Let's connect.`
- Email row: mail icon + `your@email.com` (click to copy or mailto)
- LinkedIn row: LinkedIn icon + profile URL (opens in new tab)
- Close button (`×`) dismisses modal

**Styling:**
- Centered card, `--color-surface` background
- Backdrop blur + dark overlay behind modal
- Slide-up entrance animation
- `max-width: 400px`, `border-radius: 16px`

---

## Shared Components

### Navigation Bar

```
[Logo/Name]                    [About] [Timeline] [Projects] [Skills] [Contact]   [☀/🌙]
```

- Sticky top, `backdrop-filter: blur(12px)`, semi-transparent background
- Active page link highlighted in teal
- Mobile: collapses to hamburger menu

### Dock

```
[ 🗂 About ] [ ⏱ Timeline ] [ 📁 Projects ] [ ⭐ Skills ] [ ✉ Contact ]
```

- macOS-style magnification on hover
- Labels appear above icon on hover
- Active state: teal glow dot beneath icon
- Smooth spring animation on mount

### Theme Toggle

- Fixed position: top-right on all pages
- Morphs between Sun (☀) and Moon (🌙) icons
- `localStorage.setItem('theme', 'dark'|'light')`
- Smooth color transition: `transition: color, background 300ms ease`

---

## File Structure

Following standard separation of concerns in web development — HTML for structure, CSS for styles, and JS for behavior. Each concern lives in its own file.

```
/
├── index.html              # Landing page (entry point)
├── about.html              # About page
├── timeline.html           # Timeline page
├── projects.html           # Projects page
├── skills.html             # Skills & Certifications page
│
├── css/
│   ├── main.css            # Global styles: CSS variables, resets, typography, theme tokens
│   ├── animations.css      # All @keyframes and transition definitions
│   ├── components.css      # Reusable UI: dock, navbar, modal, cards, buttons
│   └── pages/
│       ├── landing.css     # Landing page-specific styles
│       ├── about.css
│       ├── timeline.css
│       ├── projects.css
│       └── skills.css
│
├── js/
│   ├── main.js             # Global logic: theme toggle, localStorage, shared utilities
│   ├── dock.js             # Dock magnification and navigation behavior
│   ├── animations.js       # Scroll-triggered animations (Intersection Observer)
│   └── pages/
│       ├── landing.js      # Loading sequence, typewriter, name reveal
│       ├── timeline.js     # Education/Experience toggle, scroll events
│       ├── projects.js     # Drag-and-drop, card flip logic
│       └── skills.js       # Progress bar fill animations
│
├── assets/
│   ├── fonts/              # Self-hosted font files (woff2)
│   ├── icons/              # SVG tech stack logos
│   ├── images/             # Avatar, project screenshots, cert badges
│   └── certificates/       # Certificate images
│
├── .gitignore
├── README.md
└── claude.md               # This file
```

### Key Conventions

- **`css/main.css`** is the first stylesheet linked on every page — it contains all CSS custom properties (`--color-bg`, `--color-accent`, etc.) and the light/dark mode overrides. All other stylesheets inherit these tokens.
- **`js/main.js`** is the first script loaded on every page — it handles theme initialization from `localStorage` before the page renders to prevent flash of wrong theme (FOUT).
- Page-specific CSS and JS files are only loaded on their respective pages — no unnecessary bloat.
- Tailwind CSS (via CDN) is used as a utility layer on top of custom CSS, not as a replacement for it.
- No inline `style=""` attributes on HTML elements. No `<style>` blocks inside HTML files. All styles go in `/css/`.
- No `<script>` logic blocks inside HTML files. All behavior goes in `/js/`. HTML files only contain `<script src="...">` link tags.

---

## Accessibility & Performance

- All interactive elements have `:focus-visible` ring in teal
- `prefers-reduced-motion` media query disables non-essential animations
- Semantic HTML5 landmarks (`<main>`, `<nav>`, `<section>`, `<article>`)
- Alt text on all images
- Color contrast ratio: ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- Lazy-load images with `loading="lazy"`
- Fonts loaded via `<link rel="preconnect">` + `display=swap`

---

## Reference Inspirations

- **verse.sh** — timeline layout, dock navigation, minimal dark aesthetic
- **Linear.app** — smooth transitions, icon clarity
- **Lusion.co** — interactive canvas feel for Projects page
- **Brian Lovin's site** — clean typography hierarchy
