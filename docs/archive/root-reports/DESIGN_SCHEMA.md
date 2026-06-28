# Pythh Design Schema — Global System

## ✅ Implementation Complete (Phase A Pages)

### What Was Built

**1. Core Layout Components**
- `PageShell.tsx` - Global page wrapper with cinematic gradient + vignette
- `TopBar.tsx` - Consistent header across all pages
- `designTokens.ts` - Global constants for styling

**2. Pages Converted**
- ✅ `/` (FindMyInvestors) - Home page
- ✅ `/matches` (DiscoveryResultsPage) - Results page

**3. Design Tokens Applied**
```typescript
PythhTokens = {
  bg: {
    page: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950',
    glasPanel: 'bg-white/5 border border-white/10 backdrop-blur',
    rowCard: 'bg-white/[0.03] border border-white/20',
  },
  text: {
    hero: 'text-5xl sm:text-6xl font-bold tracking-tight',
    subhead: 'text-xl sm:text-2xl text-white/80',
  },
  container: {
    standard: 'max-w-6xl mx-auto px-6',
    dense: 'max-w-7xl mx-auto px-6',
  },
  button: {
    primary: 'px-6 py-3 rounded-xl bg-orange-500 text-black font-semibold',
    secondary: 'px-6 py-3 rounded-xl border border-white/15 bg-white/5',
  },
}
```

---

## Usage Guide

### Standard Page Template

```tsx
import PageShell, { ContentContainer, GlassPanel, RowCard } from '../components/layout/PageShell';
import TopBar, { TopBarBrand } from '../components/layout/TopBar';
import { PythhTokens } from '../lib/designTokens';

export default function YourPage() {
  return (
    <PageShell variant="standard"> {/* or "dense" for /app/* */}
      <TopBar 
        leftContent={<TopBarBrand />}
        rightLinks={[
          { label: 'Live', to: '/live' },
          { label: 'Signals', to: '/signals' },
        ]}
      />

      <main className={PythhTokens.spacing.page}>
        <ContentContainer variant="standard">
          <h1 className={PythhTokens.text.hero}>
            Your Headline
          </h1>
          
          <p className={`mt-6 ${PythhTokens.text.subhead}`}>
            Your subhead text
          </p>

          {/* Content */}
          <div className={PythhTokens.spacing.section}>
            <GlassPanel className="p-6">
              Panel content
            </GlassPanel>
            
            <RowCard className="px-6 py-6">
              Row content
            </RowCard>
          </div>
        </ContentContainer>
      </main>
    </PageShell>
  );
}
```

---

## Component Patterns

### 1. PageShell (Required on Every Page)
```tsx
<PageShell variant="standard"> {/* founder surfaces */}
<PageShell variant="dense">    {/* instrument mode: /app/* */}
```
- Provides: cinematic gradient, vignette overlay, text-white default
- Variants: `standard` (max-w-6xl) | `dense` (max-w-7xl)

### 2. TopBar (Consistent Header)
```tsx
<TopBar 
  leftContent={<TopBarBrand />}
  rightLinks={[
    { label: 'Live', to: '/live' },
    { label: 'External', to: 'https://...', external: true },
  ]}
  rightContent={<CustomComponent />}
/>
```

### 3. ContentContainer (Standard Wrapper)
```tsx
<ContentContainer variant="standard">
  {/* Your content */}
</ContentContainer>
```

### 4. Panels
```tsx
{/* Glass panel for inputs, modals */}
<GlassPanel className="p-6">
  Content
</GlassPanel>

{/* Row card for list items */}
<RowCard className="px-6 py-6" onClick={() => alert('clicked')}>
  Content
</RowCard>
```

---

## Typography Scale

| Element | Token | Example |
|---------|-------|---------|
| Hero H1 | `PythhTokens.text.hero` | `pythh signals` |
| Subhead | `PythhTokens.text.subhead` | `Top Matches by [signal]` |
| Body | `PythhTokens.text.body` | Standard paragraph text |
| Label | `PythhTokens.text.label` | `UPPERCASE LABEL` |
| Micro | `PythhTokens.text.micro` | Tiny supporting text |

---

## Button Patterns

```tsx
{/* Primary CTA (orange) */}
<button className={PythhTokens.button.primary}>
  Discover Matches
</button>

{/* Secondary (ghost) */}
<button className={PythhTokens.button.secondary}>
  Learn More
</button>

{/* Minimal ghost */}
<button className={PythhTokens.button.ghost}>
  Cancel
</button>
```

---

## Color System

### Backgrounds
- **Page**: Slate gradient (950 → 900 → 950)
- **Glass panels**: white/5 with backdrop-blur
- **Row cards**: white/[0.03] with white/20 border
- **Error states**: rose-500/10 bg + rose-400/30 border
- **Success states**: emerald-500/10 bg + emerald-400/30 border

### Accents
- **Action/CTA**: Orange 500 (warm, inviting)
- **Science/Telemetry**: Cyan 400 (precise, technical)
- **Borders**: white/10 (soft), white/20 (medium), white/30 (strong)

---

## Next: Pages to Convert

### Phase A (Public/Founder)
- ✅ `/` (FindMyInvestors)
- ✅ `/matches` (DiscoveryResultsPage)
- ⏳ `/discover` (PythhMatchingEngine) - needs TopBar integration
- ⏳ `/live` (Live signals feed)
- ⏳ `/signals` (How it works)

### Phase B (Instrument Mode)
- ⏳ `/app` (Dashboard)
- ⏳ `/app/engine` (Engine status)
- ⏳ `/app/logs` (Event stream)
- ⏳ `/app/startup/:id` (Intelligence dossier)

---

## Visual Consistency Checklist

Before shipping any page, verify:
- [ ] Uses `PageShell` wrapper
- [ ] Has `TopBar` with consistent brand
- [ ] All headlines use `PythhTokens.text.hero`
- [ ] Subheads use `PythhTokens.text.subhead`
- [ ] Panels use `GlassPanel` or `RowCard` components
- [ ] Buttons use token classes
- [ ] No hardcoded gradients (use PageShell)
- [ ] No random color schemes (stick to orange/cyan)
- [ ] Container widths match variant (standard/dense)
- [ ] Border colors use white/10, white/20, or white/30

---

**Status**: Design schema implemented ✅  
**Build**: 3.76s, 1.59MB bundle  
**Date**: January 22, 2026
