# 🎨 Hot Match Official Color Scheme

**Last Updated:** January 6, 2026

---

## 🎯 Color Balance Philosophy

**70% Orange (Primary) | 30% Cyan/Blue (Secondary)**

The site should feel warm and energetic with orange as the dominant accent, balanced by cool cyan/blue for data and secondary information.

---

## 🔥 Primary: Flame Orange (70% Usage)

### When to Use Orange:
- ✅ **Headlines** - All major page titles and headings
- ✅ **Primary CTAs** - Main "Get Started", "Sign Up", "Get Matched" buttons
- ✅ **Brand elements** - Logo, key icons, primary navigation highlights
- ✅ **Accent text** - Important phrases, value props, key numbers
- ✅ **Borders & glows** - Primary interactive elements

### Orange Palette:
```css
/* Primary Flame Orange */
--hh-fire: #FF5A09        /* Main brand color */
--hh-fire-light: #FF7840  /* Hover states */
--hh-fire-dark: #E54D00   /* Pressed/active states */

/* Tailwind Classes */
text-orange-400    /* Standard orange text */
text-orange-500    /* Bolder orange */
bg-orange-500      /* Orange backgrounds */
border-orange-400  /* Orange borders */
```

**Usage Examples:**
```tsx
// Headlines
<h1 className="text-orange-400">Find Your Match</h1>

// Primary CTAs
<button className="bg-orange-500 hover:bg-orange-600">Get Started</button>

// Accent text
<span className="text-orange-400 font-bold">5+ Matches</span>
```

---

## 💎 Secondary: Cyan/Blue (30% Usage)

### When to Use Cyan/Blue:
- ✅ **Data visualization** - Charts, graphs, metrics
- ✅ **Secondary info** - Badges, tags, supplementary text
- ✅ **Data points** - Numbers, stats, analytics
- ✅ **Timing/tech info** - "Processed in <2s", technical details
- ✅ **Background accents** - Subtle glows, decorative elements

### Cyan Palette:
```css
/* Primary Cyan */
--hh-cyan: #06B6D4        /* cyan-500 - Main cyan */
--hh-cyan-light: #22D3EE  /* cyan-400 - Lighter */
--hh-cyan-dark: #0891B2   /* cyan-600 - Darker */

/* Tailwind Classes */
text-cyan-400     /* Standard cyan text */
text-cyan-500     /* Bolder cyan */
bg-cyan-500       /* Cyan backgrounds (use sparingly) */
border-cyan-400   /* Cyan borders */
```

**Usage Examples:**
```tsx
// Data/metrics
<div className="text-cyan-400">Processed in &lt;2s</div>

// Badges
<span className="bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
  AI-Powered
</span>

// Secondary info
<p className="text-cyan-400 text-sm">Analyzed 500+ investors</p>
```

---

## ⚖️ Color Balance Rules

### ✅ DO:
- Use **orange for 70%** of accent elements
- Use **cyan for 30%** of accent elements  
- Orange = Primary actions, headlines, brand
- Cyan = Data, metrics, secondary info
- Keep backgrounds dark/neutral

### ❌ DON'T:
- Don't make everything cyan (currently the problem!)
- Don't use cyan for primary CTAs
- Don't use orange for data/metrics
- Don't mix warm and cool in the same text element

---

## 🎨 Gradient Combinations

### Primary (Orange-focused):
```tsx
// Headlines
from-orange-400 via-amber-400 to-orange-500

// CTAs
from-orange-500 to-amber-500
from-orange-600 to-orange-500

// Badges
from-orange-500/20 to-amber-500/20
```

### Secondary (Cyan for data):
```tsx
// Data highlights
from-cyan-400 to-blue-400

// Background glows (subtle)
bg-cyan-500/5
bg-cyan-600/10
```

### Mixed (Balanced):
```tsx
// When you need both (rare)
from-orange-500/20 to-cyan-500/20
```

---

## 📐 Implementation Checklist

When updating colors, ensure:

- [ ] Headlines use orange (`text-orange-400` or `text-orange-500`)
- [ ] Primary buttons use orange gradients
- [ ] Data/metrics use cyan (`text-cyan-400`)
- [ ] Background glows: 70% orange, 30% cyan
- [ ] No more than 30% cyan on any page
- [ ] Orange feels dominant, cyan feels complementary

---

## 🔍 Quick Reference

| Element | Color | Usage % |
|---------|-------|---------|
| Headlines | Orange | 100% |
| Primary CTAs | Orange | 100% |
| Data/Metrics | Cyan | 100% |
| Badges | Mix | 70% orange, 30% cyan |
| Backgrounds | Dark | Neutral |
| Borders | Orange | 70% orange, 30% cyan |

---

## 📝 Notes

- **"Cyan/Blue"** = Technically it's **cyan** (#06B6D4), but you can use blue-500 (#3B82F6) as a complementary color
- The site was "too blue" because cyan was being used for everything
- Now orange dominates (as it should) with cyan as accent
- This creates a warm, energetic feel with professional data visualization

