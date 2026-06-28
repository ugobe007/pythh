# Design Tokens — Obsidian Terminal Dark Theme

## OKLCH Color Palette

```css
/* Backgrounds */
--bg-base:        oklch(0.13 0.01 264);   /* Deep obsidian — page background */
--bg-surface:     oklch(0.16 0.01 264);   /* Cards, inputs */
--bg-elevated:    oklch(0.18 0.01 264);   /* Hover states, nested cards */
--bg-border:      oklch(0.22 0.01 264);   /* Subtle borders */
--bg-border-mid:  oklch(0.25 0.01 264);   /* Mid-weight borders */
--bg-border-strong: oklch(0.30 0.01 264); /* Strong borders */

/* Text */
--text-primary:   oklch(0.97 0.005 264);  /* Headlines */
--text-secondary: oklch(0.65 0.01 264);   /* Body copy */
--text-muted:     oklch(0.55 0.01 264);   /* Captions, details */
--text-faint:     oklch(0.40 0.01 264);   /* Timestamps, labels */

/* Accents */
--emerald:        oklch(0.696 0.17 162.48);  /* Primary — CTAs, active states */
--emerald-glow:   oklch(0.696 0.17 162.48 / 0.5); /* Shadow/glow */
--emerald-subtle: oklch(0.696 0.17 162.48 / 0.1); /* Background tints */
--amber:          oklch(0.769 0.188 70.08);  /* Secondary — approvals, warnings */
--amber-subtle:   oklch(0.769 0.188 70.08 / 0.1);
```

## Typography

```html
<!-- Google Fonts — add to index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

```css
/* index.css */
--font-display: 'Space Grotesk', sans-serif;   /* Headlines, nav, CTAs */
--font-mono:    'JetBrains Mono', monospace;   /* Data values, scores, emails */
--font-body:    'Space Grotesk', sans-serif;   /* Body copy */
```

## Tailwind CSS Custom Classes

```css
.font-display { font-family: var(--font-display); }
.font-mono    { font-family: var(--font-mono); }
.section-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

## Animation Utilities

```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.6s ease forwards;
}
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }

@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.4; }
  100% { transform: scale(1.6); opacity: 0; }
}
.animate-pulse-ring {
  animation: pulse-ring 1.8s ease-out infinite;
}
```

## Hero Section Structure

```
min-h-screen
  ├── Background image (opacity 0.25, cover)
  ├── Gradient overlay (left 45% solid → right 20% transparent)
  ├── Bottom fade (h-40, solid → transparent)
  └── Content (max-w-2xl, left-aligned)
       ├── Section label (emerald, mono, uppercase)
       ├── H1 (clamp 2.75rem–4.75rem, last word in emerald)
       ├── Subheadline (agent name in amber)
       ├── Closing line (emerald, font-medium)
       ├── URL input + CTA button (flex row)
       └── Trust line ("No credit card. No setup calls.")
  └── Right panel (agent activity card, absolute or flex)
```

## Agent Activity Card

```tsx
// Hero right-side card showing PYTHIA working in real time
<div style={{ backgroundColor: "oklch(0.16 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
  <header>  {/* Avatar + name + "Active" badge + role */}  </header>
  <ul>      {/* 4 recent milestones with icons + timestamps */}  </ul>
  <footer>  {/* Amber "Approve Meeting →" CTA */}  </footer>
</div>
```
