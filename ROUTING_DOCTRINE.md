# 🔒 Routing Doctrine (Locked - Jan 2026)

## 🎯 Canonical Founder Flow

### **Flow: / → /discover → /matches**

```
1. Visit pythhh.ai (/)
   ↓ [Enter website URL]
   
2. Submit → /discover?url=were.com
   ↓ [Matching engine computes]
   
3. Navigate → /matches?url=were.com&signal=growth
   ↓ [Top 3-5 matches by signal]
```

---

## 📋 Route Table

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | FindMyInvestors | Front page (minimal CTA) |
| `/discover` | PythhMatchingEngine | Matching engine surface |
| `/matches` | DiscoveryResultsPage | Results (top matches by signal) |
| `/discovery` | → `/discover` | Backwards compat alias |
| `/pythh` | → `/discover` | Branded alias |
| `/hotmatch` | → `/discover` | Hot Match legacy |
| `/results` | → `/matches` | Old results page |

---

## 🏗️ Surface Responsibilities

### **1. `/` (FindMyInvestors.tsx)**
**Purpose:** Minimal CTA home page  

**Contains:**
- Headline: "Find My Investors"
- Subhead: "Discover investors that understand your signals."
- SmartSearchBar
- Signal Science credibility line

**On submit:**
```tsx
navigate(`/discover?url=${encodeURIComponent(cleanUrl)}`);
```

---

### **2. `/discover` (PythhMatchingEngine.tsx)**
**Purpose:** Matching engine surface (compute + progressive reveal)

**Contains:**
- Top 3 Decision Strip (sticky)
- Batch controls (25 matches)
- Match cycling (10s autopilot)
- Telemetry footer
- "Why these?" modal (component fit scores)
- Save/share/filter controls
- Auto-refresh (10min)
- Survival mode (MIN_MATCH_SCORE=20)

**Data loads:**
- URL param: `?url=were.com`
- Resolves startup via `resolveStartupFromUrl()`
- Fetches ALL matches above threshold
- Batches into groups of 25

**On compute finish (optional):**
```tsx
// After matching completes, navigate to results
navigate(`/matches?url=${url}&signal=${topSignal}`);
```

---

### **3. `/matches` (DiscoveryResultsPage.tsx)**
**Purpose:** Results surface (Top matches by signal)

**Contains:**
- Title: "Top Matches by [signal]"
- Subtitle: "These firms match your signals"
- 3-5 investor cards with:
  - Focus areas
  - Stage preference
  - Check size
  - Signal match

**Data loads:**
- URL params: `?url=were.com&signal=growth`
- Displays top matches by specified signal
- Minimal controls (no cycling, no batches)

---

## 🚫 Anti-Patterns (DO NOT DO)

### **Don't drift to "single surface"**
❌ Making `/` render the full engine  
❌ Making `/matches` redirect to `/discovery`  
✅ Keep three distinct tiers with clear purposes

### **Don't merge surfaces**
❌ Adding Top 3 strip to `/matches`  
❌ Adding telemetry to `/`  
✅ Keep each surface minimal and focused

### **Don't break backwards compat**
❌ Removing `/hotmatch` or `/results` redirects  
❌ Changing redirect targets  
✅ Preserve querystring on all redirects

### **Don't invent new routes without doctrine update**
❌ Adding `/top-matches` or `/investors`  
✅ Update this document before adding routes

---

## 🎯 When to Use Each Surface

### **Use `/` when:**
- First-time visitor (cold traffic)
- Marketing campaigns
- SEO landing page
- User wants to "find investors" (search intent)

### **Use `/matches` when:**
- User submitted a URL
- Showing search results
- Persuasive presentation needed
- Call-to-action context (e.g., email, share link)

### **Use `/discovery` when:**
- Power user wants full control
- Deep exploration of match pool
- Batch analysis needed
- Instrumentation/diagnostics required

---

## 🔄 Migration Notes (Phase B Cleanup)

### **To be removed:**
- `/home` route (if it exists) - conflicts with `/` being canonical
- `ResultsPageDoctrine` component (unused legacy)
- `Home` component from `HomePage.tsx` (unused legacy)
- Unused route guards: `L1Guard`, `L2Guard`, `L4Guard`, `AuthGuard`
- Unused imports: `LogoDropdownMenu`

### **To be preserved:**
- `MatchController` (legacy route handler)
- Admin routes (L5Guard protected)
- App instrument routes

---

## ✅ Validation Checklist

Before deploying routing changes:

- [ ] `/` renders FindMyInvestors (minimal)
- [ ] `/matches` renders DiscoveryResultsPage (Top 5)
- [ ] `/discovery` renders PythhMatchingEngine (full engine)
- [ ] `/hotmatch?url=X` redirects to `/matches?url=X`
- [ ] `/results?url=X` redirects to `/matches?url=X`
- [ ] `/pythh?url=X` redirects to `/discovery?url=X`
- [ ] SmartSearchBar navigates to `/matches` on submit
- [ ] 404 routes go to `/` (not `/discovery`)
- [ ] No console errors on any route
- [ ] Build succeeds with no lint errors

---

**Last Updated:** Jan 22, 2026  
**Status:** ✅ Locked (IA stable, no drift allowed)
