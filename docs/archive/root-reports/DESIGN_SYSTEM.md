# Hot Match - Official Design System

**LAST UPDATED:** December 18, 2025

---

## Official Hybrid Color Palette

### 🔥 Primary: Warm Accents (Brand Identity)
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Fire Orange** | `#FF5A09` | `hh-fire` | Primary CTAs, buttons, links |
| **Coral** | `#F3843E` | `hh-coral` | Secondary accents, hover states |
| **Amber** | `#FF9900` | `hh-amber` | Highlights, active states, badges |
| **Honey** | `#FFB402` | `hh-honey` | Subtle warmth, icons |

### 🌫️ Neutrals: Muted Grays (Professional Base)
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Charcoal** | `#393939` | `hh-charcoal` | Primary backgrounds |
| **Charcoal Light** | `#454545` | `hh-charcoal-light` | Cards, elevated surfaces |
| **Charcoal Dark** | `#2d2d2d` | `hh-charcoal-dark` | Deeper backgrounds |
| **Steel** | `#6E6E6E` | `hh-steel` | Borders, muted text |
| **Slate** | `#8A8A8A` | `hh-slate` | Secondary text |
| **Silver** | `#B0B0B0` | `hh-silver` | Disabled states |

### 💎 Secondary: Cool Accents (Data & Info)
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Teal** | `#00B4B4` | `hh-teal` | Info badges, charts |
| **Cyan** | `#00CED1` | `hh-cyan` | Data visualization primary |
| **Blue** | `#3B82F6` | `hh-blue` | Links in content, info |
| **Indigo** | `#6366F1` | `hh-indigo` | Charts secondary |
| **Purple** | `#8B5CF6` | `hh-purple` | Premium/special features |

### ✅ Semantic: Status Colors
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| **Success** | `#22C55E` | `hh-success` | Success states |
| **Warning** | `#F59E0B` | `hh-warning` | Warning states |
| **Error** | `#EF4444` | `hh-error` | Error states |
| **Info** | `#00B4B4` | `hh-info` | Info states |

---

## Color Usage Guidelines

### ✅ DO
```tsx
// Primary actions = orange accent
<button className="bg-hh-fire hover:bg-hh-coral">Get Started</button>

// Backgrounds = muted grays
<div className="bg-hh-charcoal text-white">

// Data visualizations = cool tones
<div className="bg-hh-teal">Active Users</div>
<div className="bg-hh-indigo">Revenue</div>

// Info/status = semantic colors
<span className="text-hh-success">✓ Approved</span>
<span className="text-hh-error">✗ Rejected</span>
```

### ❌ DON'T
```tsx
// Don't use cool colors for primary CTAs
<button className="bg-hh-teal">Sign Up</button>  // ❌ Wrong

// Don't use hot colors for info states  
<span className="text-hh-fire">ℹ Note</span>  // ❌ Wrong

// Don't mix warm and cool in the same component
<div className="bg-hh-fire text-hh-teal">  // ❌ Clashing
```

---

## Design Principles

### 1. Every Element Must Be Actionable
- Buttons must DO something when clicked
- Tables must have clickable rows leading to detail views
- No decorative-only interactive elements

### 2. Data Display: Tables Over Buttons
- **DO**: Use tables/grids for lists of data
- **DON'T**: Put data in oversized buttons
- Tables must be sortable and filterable where possible

### 3. Page Connectivity
- Every page links to related workflow pages
- Clear breadcrumbs showing current location
- "Next steps" suggestions based on context

### 4. ALL Menus Must Be Hamburger Menus
- Hamburger menu (LogoDropdownMenu) in top-left corner
- NO header bars, NO footer bars, NO sidebar navigation for public pages
- Admin pages may use AdminSidebar but must also have hamburger access
- Consistent placement across all pages
- Menu items: muted background `#393939`, orange accent on hover

### 5. No Duplicates (SSOT)
- Each piece of data shown in ONE place only
- Reference other pages, don't repeat content
- Use "View Details →" links instead of copying data

### 6. TrueMatch Transparency
- Every match score shows calculation breakdown on click
- GOD Score components visible (protect exact weights)
- "How was this calculated?" link on all scores

### 7. Admin Pages: Practical + Powerful
- Every metric is clickable → drill down to details
- Bulk actions available for common tasks
- Real data only - never fake/placeholder content

### 8. Menu Button Styling (Muted, Not Bright)
- Background: `#393939` (charcoal)
- Hover: `#454545` with orange left border
- Text: white, turns `#FF9900` on hover
- Icons: `#FF9900` (amber) or `#F3843E` (coral)
- NO bright solid-color buttons in menus

---

## Stage System

**Stage 1:** Anonymous voting • Need 5 "yes" votes to advance
**Stage 2:** Review materials • Need 5 "yes" votes to advance  
**Stage 3:** Meet founder • Need 5 "yes" votes to advance
**Stage 4:** Deal room • Need 1 "yes" vote to close

---

## Five Points Format (MUST FOLLOW)

1. **Value Proposition** (Bold, text-base) - "ChatGPT for HR"
2. **Market Size** (Bold, text-base) - "$45B market"
3. **Unique Value** (Bold, text-base) - "Code teaches itself"
4. **Team** (Semibold, text-sm) - "Google, Airbnb, Doordash"
5. **Investment** (Semibold, text-sm) - "$3M seed"

---

## Background Colors

- **Home page:** `bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50`
- **Vote Demo:** `bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-800`

---

## Card Styling

```
bg-gradient-to-br from-amber-300 via-orange-400 to-yellow-500
rounded-3xl p-6
shadow-[0_20px_50px_rgba(0,0,0,0.3)]
border-4 border-orange-500
```

---

## Card Features

- Fire bubbles on "yes" vote
- Swipe away after voting
- Honeypot reveals secrets
- Comment filtering (blocks profanity)
- Vote counts displayed
- Progress bar to next stage