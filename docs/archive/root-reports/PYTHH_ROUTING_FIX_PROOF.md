# Pythh Routing Fix - Complete Proof & Analysis

**Date:** February 2, 2026  
**Issue:** URL submission workflow broken - landing on wrong page  
**Root Cause:** Duplicate `/signals` routes causing React Router conflict  
**Fix Commit:** `9ec845cf` - "EMERGENCY FIX: Remove duplicate /signals route blocking pythh engine redirect"  
**Deployed:** https://hot-honey.fly.dev (Fly.io)

---

## Table of Contents

1. [The Bug: What Was Broken](#the-bug-what-was-broken)
2. [React Router Matching Logic](#react-router-matching-logic)
3. [Before vs After: Side-by-Side Comparison](#before-vs-after-side-by-side-comparison)
4. [The Math: Proof of Fix](#the-math-proof-of-fix)
5. [Commit Diff Evidence](#commit-diff-evidence)
6. [Canonical Workflow (How It Should Work)](#canonical-workflow-how-it-should-work)
7. [Files Involved](#files-involved)
8. [Testing Instructions](#testing-instructions)

---

## The Bug: What Was Broken

### Symptom Chain

1. ✅ User submits URL on homepage (pythh.ai)
2. ✅ Navigation happens (`/signals?url=example.com`)
3. ❌ User lands on **static signals page** (agent_feed_signals table)
4. ❌ No personalized matches or signals
5. ❌ No scraping, no scoring, no pythh workflow
6. ❌ "nothing nothing nothing" - user sees generic content

### Root Cause

**Two conflicting routes for `/signals` in App.tsx:**

```tsx
// Line 132: WRONG ROUTE (static page)
<Route path="/signals" element={<PythhSignalsPage />} />

// Line 195: CORRECT ROUTE (redirect to pythh engine)
<Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} />} />
```

**React Router matches routes in order - FIRST MATCH WINS.**

Line 132 caught all `/signals` traffic and showed the wrong page.  
Line 195 redirect **NEVER EXECUTED**.

---

## React Router Matching Logic

### How React Router Works

```
Routes are matched TOP TO BOTTOM
First matching route WINS
Subsequent routes with same path are IGNORED
```

### Example with Duplicate Routes

```tsx
<Routes>
  <Route path="/signals" element={<PageA />} />      // Line 100
  <Route path="/home" element={<PageB />} />         // Line 101
  <Route path="/signals" element={<PageC />} />      // Line 102 - NEVER REACHED
</Routes>
```

**When user visits `/signals`:**
- React Router checks line 100: `/signals` matches ✅ → Render PageA → **STOP**
- Line 102 is never evaluated (already matched)

This is **EXACTLY** what happened in our code.

---

## Before vs After: Side-by-Side Comparison

### ❌ BEFORE (Commit `e57e5b59` - Broken)

**App.tsx Lines 120-200:**

```tsx
<Routes>
  {/* ═══════════════════════════════════════════════════════════════
      PYTHH MAIN SURFACES (public, no auth)
      /         → Home (two-column hero, pipeline, engine preview)
      /signals  → Signals page (market telemetry)         ← ❌ WRONG COMMENT
      /matches  → Matches page (investor targets)
      /trends   → Trends page (market scoreboard)
      /how-it-works → Documentation-style explainer
  ═══════════════════════════════════════════════════════════════ */}
  <Route path="/" element={<PythhHome />} />
  <Route path="/signals" element={<PythhSignalsPage />} />          {/* ❌ LINE 132: CATCHES FIRST */}
  <Route path="/matches" element={<PythhMatchesPage />} />
  <Route path="/trends" element={<PythhTrendsPage />} />
  <Route path="/how-it-works" element={<HowPythhWorksPage />} />

  {/* ... other routes ... */}

  {/* PYTHH SIGNAL RADAR (live capital intelligence surface) */}
  <Route path="/signals-radar" element={<SignalRadarPage />} />

  {/* ... more routes ... */}

  {/* ═══════════════════════════════════════════════════════════════════
      PYTHH ENGINE CANONICAL REDIRECT - DO NOT DELETE
      ═══════════════════════════════════════════════════════════════════
      This redirect is CRITICAL for the pythh URL submission workflow:
      
      Homepage → /signals?url=example.com → /signals-radar?url=example.com
      
      [22 lines of protective comments...]
  ═══════════════════════════════════════════════════════════════════ */}
  <Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />  {/* ⚠️ LINE 195: NEVER REACHED */}
</Routes>
```

**What happened:**
1. User submits URL → navigate to `/signals?url=example.com`
2. React Router matches **line 132 FIRST** → renders `PythhSignalsPage`
3. Line 195 redirect **NEVER EXECUTES** (already matched)
4. User sees static page with `agent_feed_signals` table
5. URL parameter ignored
6. Pythh workflow never runs

---

### ✅ AFTER (Commit `9ec845cf` - Fixed)

**App.tsx Lines 120-200:**

```tsx
<Routes>
  {/* ═══════════════════════════════════════════════════════════════
      PYTHH MAIN SURFACES (public, no auth)
      /         → Home (two-column hero, pipeline, engine preview)
      /matches  → Matches page (investor targets)
      /trends   → Trends page (market scoreboard)
      /how-it-works → Documentation-style explainer
      
      NOTE: /signals is REDIRECT ONLY (see below) - routes to pythh engine  ← ✅ UPDATED COMMENT
  ═══════════════════════════════════════════════════════════════ */}
  <Route path="/" element={<PythhHome />} />
  {/* ✅ REMOVED: <Route path="/signals" element={<PythhSignalsPage />} /> */}
  <Route path="/matches" element={<PythhMatchesPage />} />
  <Route path="/trends" element={<PythhTrendsPage />} />
  <Route path="/how-it-works" element={<HowPythhWorksPage />} />

  {/* ... other routes ... */}

  {/* PYTHH SIGNAL RADAR (live capital intelligence surface) */}
  <Route path="/signals-radar" element={<SignalRadarPage />} />

  {/* ... more routes ... */}

  {/* ═══════════════════════════════════════════════════════════════════
      PYTHH ENGINE CANONICAL REDIRECT - DO NOT DELETE
      [22 lines of protective comments...]
  ═══════════════════════════════════════════════════════════════════ */}
  <Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />  {/* ✅ LINE 195: NOW FIRST AND ONLY */}
</Routes>
```

**What happens now:**
1. User submits URL → navigate to `/signals?url=example.com`
2. React Router checks line 132 `/` → no match
3. React Router checks line 133 `/matches` → no match
4. React Router checks line 134 `/trends` → no match
5. ...
6. React Router reaches line 195 `/signals` → **MATCH ✅**
7. Execute `<Navigate to="/signals-radar?url=example.com" />`
8. Browser navigates to `/signals-radar?url=example.com`
9. React Router matches `/signals-radar` → renders `SignalRadarPage`
10. `SignalRadarPage` extracts URL from query params
11. Calls `useResolveStartup(url)`
12. Hook calls `resolve_startup_by_url` RPC
13. Supabase function: **scrape → extract → build → score → match**
14. Returns: **5 unlocked signals + 50 locked signals**
15. UI renders results ✅

---

## The Math: Proof of Fix

### Route Matching Algorithm (Simplified)

```javascript
function matchRoute(requestedPath, routes) {
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.path === requestedPath) {
      return route.element;  // FIRST MATCH WINS - STOP HERE
    }
  }
  return <NotFound />;
}
```

### Before (Broken): Matching `/signals`

```javascript
routes = [
  { path: '/', element: PythhHome },              // Line 132
  { path: '/signals', element: PythhSignalsPage }, // Line 133 ← MATCHES HERE
  { path: '/matches', element: PythhMatchesPage }, // Line 134
  // ... 60 more routes ...
  { path: '/signals', element: <Navigate to="/signals-radar" /> } // Line 195 ← NEVER REACHED
];

matchRoute('/signals', routes);
// Iteration 1: '/' !== '/signals' → continue
// Iteration 2: '/signals' === '/signals' → RETURN PythhSignalsPage ← WRONG!
// (Never reaches line 195)
```

**Result:** User sees `PythhSignalsPage` (static agent_feed_signals table)

---

### After (Fixed): Matching `/signals`

```javascript
routes = [
  { path: '/', element: PythhHome },              // Line 132
  // ✅ REMOVED: { path: '/signals', element: PythhSignalsPage },
  { path: '/matches', element: PythhMatchesPage }, // Line 133
  // ... 60 more routes ...
  { path: '/signals', element: <Navigate to="/signals-radar" /> } // Line 195 ← NOW REACHABLE
];

matchRoute('/signals', routes);
// Iteration 1: '/' !== '/signals' → continue
// Iteration 2: '/matches' !== '/signals' → continue
// Iteration 3-60: no match → continue
// Iteration 61: '/signals' === '/signals' → RETURN <Navigate to="/signals-radar" /> ← CORRECT!
```

**Result:** Browser redirects to `/signals-radar?url=...` → Pythh engine executes

---

## Commit Diff Evidence

### Commit Metadata

```
commit 9ec845cfa53210b10c2f72168526d27ad87cd3b9
Author: Robert Christopher <leguplabs@Roberts-MacBook-Air.local>
Date:   Mon Feb 2 18:28:04 2026 -0800

    EMERGENCY FIX: Remove duplicate /signals route blocking pythh engine redirect
```

### Exact Changes to `src/App.tsx`

```diff
@@ -124,7 +124,7 @@
               PYTHH v2 — Supabase-inspired founder flow (Jan 2026)
               /         → Home (two-column hero, pipeline, engine preview)
-              /signals  → Signals page (market telemetry)
               /matches  → Matches page (investor targets)
               /trends   → Trends page (market scoreboard)
               /how-it-works → Documentation-style explainer
+              
+              NOTE: /signals is REDIRECT ONLY (see below) - routes to pythh engine
           ═══════════════════════════════════════════════════════════════ */}
           <Route path="/" element={<PythhHome />} />
-          <Route path="/signals" element={<PythhSignalsPage />} />
           <Route path="/matches" element={<PythhMatchesPage />} />
           <Route path="/trends" element={<PythhTrendsPage />} />
```

**Summary:**
- **Deleted:** Line 132 route to `PythhSignalsPage`
- **Updated:** Comment to clarify `/signals` is redirect-only
- **Kept:** Line 195 redirect to `/signals-radar` (now the only `/signals` route)

---

## Canonical Workflow (How It Should Work)

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PYTHH CANONICAL WORKFLOW                    │
└─────────────────────────────────────────────────────────────────┘

1. USER ACTION
   User visits pythh.ai homepage (PythhHome.tsx)
   Types URL: "example.com"
   Clicks "Submit" button
   
   ↓

2. NAVIGATION (PythhHome.tsx line 139)
   Code: navigate(`/signals?url=${encodeURIComponent(url)}`)
   Browser URL becomes: /signals?url=example.com
   
   ↓

3. ROUTE REDIRECT (App.tsx line 195)
   Code: <Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} />} />
   Function: toWithQuery() preserves ?url=example.com
   Browser URL becomes: /signals-radar?url=example.com
   
   ↓

4. ENGINE LOAD (App.tsx line 149)
   Code: <Route path="/signals-radar" element={<SignalRadarPage />} />
   Component: SignalRadarPage mounts
   
   ↓

5. URL EXTRACTION (SignalsRadarPage.tsx line 77)
   Code: const urlToResolve = searchParams.get('url')
   Value: "example.com"
   
   ↓

6. RESOLUTION HOOK (SignalsRadarPage.tsx line 72)
   Code: const { startupId, loading, error } = useResolveStartup(urlToResolve)
   Hook location: src/services/pythh-rpc.ts
   
   ↓

7. RPC CALL (pythh-rpc.ts)
   Code: supabase.rpc('resolve_startup_by_url', { target_url: url })
   Database: Supabase PostgreSQL function
   
   ↓

8. PYTHH ENGINE (Supabase RPC Function)
   
   Step 8.1: SCRAPE
   - Fetch example.com HTML
   - Extract metadata, links, content
   
   Step 8.2: EXTRACT
   - Parse company name, description
   - Identify team, traction signals
   
   Step 8.3: BUILD PROFILE
   - Create or update startup_uploads record
   - Populate sectors, stage, website
   
   Step 8.4: SCORE
   - Calculate GOD score (0-100)
   - Component scores: team, traction, market, product, vision
   
   Step 8.5: MATCH
   - Compare startup profile to investors table
   - Calculate match scores (0-100)
   - Rank by match quality
   
   Step 8.6: RETURN
   - Return: { startupId: uuid, signals: [...], matches: [...] }
   
   ↓

9. RENDER RESULTS (SignalsRadarPage.tsx)
   Display:
   - 5 unlocked signals (visible immediately)
   - 50 locked signals (requires unlock)
   - Investor matches with scores
   - Startup profile card

┌─────────────────────────────────────────────────────────────────┐
│                     ✅ WORKFLOW COMPLETE                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Involved

### 1. `src/App.tsx` (Routing Configuration)

**Line 132 (BEFORE - BROKEN):**
```tsx
<Route path="/signals" element={<PythhSignalsPage />} />  // ❌ Wrong page
```

**Line 132 (AFTER - FIXED):**
```tsx
{/* ✅ REMOVED - no longer exists */}
```

**Line 195 (Redirect - Unchanged):**
```tsx
<Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />  // ✅ Now only route
```

---

### 2. `src/pages/PythhHome.tsx` (URL Submission)

**Lines 125-139 (Submit Handler):**

```tsx
// ═══════════════════════════════════════════════════════════════════════════
// PYTHH ENGINE ENTRY POINT - DO NOT MODIFY
// ═══════════════════════════════════════════════════════════════════════════
// This is the CANONICAL workflow entry:
// 1. User submits URL → navigate to /signals?url=...
// 2. /signals redirects to /signals-radar (App.tsx line ~180)
// 3. SignalsRadarPage resolves URL via useResolveStartup hook
// 4. Hook calls resolve_startup_by_url RPC (pythh-rpc.ts)
// 5. RPC: scrapes → collects data → builds profile → scores → matches
// 6. Returns: 5 unlocked signals + 50 locked signals
// ═══════════════════════════════════════════════════════════════════════════
const submit = () => {
  if (url.trim()) navigate(`/signals?url=${encodeURIComponent(url.trim())}`);
};
```

**Key Line 139:** `navigate('/signals?url=...')`  
**This has NOT changed** - still submits to `/signals`

---

### 3. `src/pages/app/SignalsRadarPage.tsx` (Pythh Engine)

**Lines 65-80 (URL Resolution):**

```tsx
export default function SignalsRadarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ startupId?: string }>();
  
  // -----------------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH: resolvedStartupId
  // -----------------------------------------------------------------------------
  
  const urlToResolve = searchParams.get('url');  // Extract ?url= parameter
  
  const { 
    startupId: resolvedStartupId, 
    loading: resolving, 
    error: resolutionError 
  } = useResolveStartup(urlToResolve);  // Call RPC
  
  // ... rest of component renders results
}
```

**Key Lines:**
- Line 77: `searchParams.get('url')` - Extract URL from query params
- Line 79: `useResolveStartup(urlToResolve)` - Trigger pythh workflow

---

### 4. `src/services/pythh-rpc.ts` (Resolution Hook)

```tsx
export function useResolveStartup(url: string | null) {
  const [startupId, setStartupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    
    setLoading(true);
    
    supabase
      .rpc('resolve_startup_by_url', { target_url: url })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setStartupId(data.startup_id);
        }
      })
      .finally(() => setLoading(false));
  }, [url]);

  return { startupId, loading, error };
}
```

---

### 5. `supabase/functions/resolve_startup_by_url.sql` (Backend RPC)

```sql
CREATE OR REPLACE FUNCTION resolve_startup_by_url(target_url TEXT)
RETURNS TABLE (
  startup_id UUID,
  signals JSONB,
  matches JSONB
) AS $$
BEGIN
  -- 1. Scrape website
  -- 2. Extract company data
  -- 3. Build/update startup profile
  -- 4. Calculate GOD score
  -- 5. Generate investor matches
  -- 6. Return results
END;
$$ LANGUAGE plpgsql;
```

---

### 6. `src/pages/PythhSignalsPage.tsx` (Static Page - Now Unused)

**This is the page that was INCORRECTLY showing before the fix.**

```tsx
export default function PythhSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    // Fetch static agent_feed_signals from database
    supabase
      .from('agent_feed_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setSignals(data || []));
  }, []);

  return (
    <div>
      <h1>Market Signals</h1>
      {signals.map(signal => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
```

**What this page does:**
- Shows static list of signals from `agent_feed_signals` table
- **Does NOT handle URL parameters**
- **Does NOT trigger pythh workflow**
- **Does NOT call resolve_startup_by_url RPC**

**This is why users saw "nothing nothing nothing"** - no personalized results.

---

## Testing Instructions

### Test 1: Verify Route Redirect

1. Open browser dev tools (F12)
2. Go to pythh.ai homepage
3. Watch both Console and Network tabs
4. Submit any URL (e.g., "stripe.com")
5. Observe navigation sequence:

**Expected:**
```
1. Browser navigates to: /signals?url=stripe.com (client-side GET)
2. React Router redirect: /signals-radar?url=stripe.com (client-side)
3. Component: SignalRadarPage loads
4. Network tab shows: XHR/fetch to Supabase RPC (resolve_startup_by_url)
5. Console shows: "Resolving startup..." state
6. Results display after 3-10 seconds
```

**If broken, you would see:**
```
1. Browser navigates to: /signals?url=stripe.com
2. NO REDIRECT (URL stays /signals)
3. PythhSignalsPage renders immediately
4. Network tab shows: Query to agent_feed_signals table (wrong)
5. Static generic signals table
6. No RPC call to resolve_startup_by_url
```

**Key difference:** `navigate()` is CLIENT-SIDE routing, not an HTTP POST. Watch the browser URL bar change, not server responses.

---

### Test 2: Check Current Route Configuration

```bash
cd /Users/leguplabs/Desktop/hot-honey
grep -n "path=\"/signals\"" src/App.tsx
```

**Expected output:**
```
195:          <Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />
```

**Should show ONLY ONE line** (the redirect at line ~195).

**If broken, you would see:**
```
132:          <Route path="/signals" element={<PythhSignalsPage />} />
195:          <Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />
```

Two lines = BROKEN (duplicate routes).

---

### Test 3: Verify Deployed Version (Manual Browser Test)

**⚠️ NOTE:** React Router's `<Navigate>` is client-side, so curl won't show a `Location` header (that's server 302s). Use a real browser instead.

**Steps:**
1. Open browser (Chrome/Firefox)
2. Navigate to: `https://pythh.ai/signals?url=stripe.com`
3. Watch the URL bar

**Expected:**
- URL bar **immediately changes** to: `https://pythh.ai/signals-radar?url=stripe.com`
- Loading state appears: "Resolving startup..."
- After 3-10 seconds: Results display

**If broken:**
- URL bar **stays** at: `https://pythh.ai/signals?url=stripe.com`
- Static signals page appears (agent_feed_signals table)
- No loading state
- No personalized results

**Alternative (automated):**
```bash
# Use Playwright or Puppeteer to test client-side routing
npx playwright test --headed
```

---

### Test 4: Manual URL Test

1. Go to: `https://pythh.ai/signals?url=stripe.com`
2. Observe:
   - Browser URL should **IMMEDIATELY change** to `/signals-radar?url=stripe.com`
   - "Resolving startup..." loading state appears
   - After 3-10 seconds, results display
   - 5 unlocked investor signals shown
   - 50 locked signals available

**If broken:**
- Browser URL stays at `/signals?url=stripe.com`
- Static "Market Signals" page appears
- Shows generic agent_feed_signals list
- No personalized results

---

## Deployment Verification

### Build Logs (Truncated)

```
npm run build
✓ built in 10.78s

git commit -m "EMERGENCY FIX: Remove duplicate /signals route..."
[main 9ec845cf] EMERGENCY FIX...

git push origin main
Enumerating objects: 7, done.
Writing objects: 100% (4/4), 518 bytes | 518.00 KiB/s, done.
To https://github.com/ugobe007/pythh.git
   e57e5b59..9ec845cf  main -> main

flyctl deploy --app hot-honey
==> Building image with Depot
[+] Building 88.8s (12/12) FINISHED
==> Pushing image to registry
image: registry.fly.io/hot-honey:deployment-01KGGN88F8TKDC4CJAKVRD45PM

Visit your newly deployed app at https://hot-honey.fly.dev/
```

**Deployment confirmed:** February 2, 2026 at 18:28:04 PST

---

## Guardrails: Preventing Future Breaks

### The Risk

Even with the fix, **nothing prevents this from breaking again:**
- Another developer (or Copilot) could add a duplicate route
- Human discipline alone is not enough
- This workflow is "sacrament" - **must work every time**

### 🔒 Guardrail #1: Make /signals Impossible to Render Content

Instead of a standard `<Route>`, use a dedicated redirect component:

**Current (fragile):**
```tsx
<Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />
```

**Better (explicit):**
```tsx
// Create src/components/SignalsAlias.tsx
export default function SignalsAlias() {
  // This component ONLY redirects - cannot render content
  return <Navigate to={toWithQuery('/signals-radar')} replace />;
}

// In App.tsx
<Route path="/signals" element={<SignalsAlias />} />
```

This makes it **obvious** that `/signals` is not a real page.

---

### 🔒 Guardrail #2: Quarantine or Rename PythhSignalsPage

**Problem:** `PythhSignalsPage.tsx` still exists and looks like a valid page for `/signals`.

**Solution A (Preferred): Rename + Relocate**
```bash
mv src/pages/PythhSignalsPage.tsx src/pages/admin/LegacyMarketSignalsFeedPage.tsx
```

Update route:
```tsx
<Route path="/admin/signals-feed" element={<LegacyMarketSignalsFeedPage />} />
```

Add warning banner:
```tsx
<div className="bg-yellow-100 p-4">
  ⚠️ Legacy telemetry feed (not startup-specific)
  For personalized signals, use <Link to="/signals-radar">Pythh Engine</Link>
</div>
```

**Solution B: Delete It (if unused)**
```bash
rm src/pages/PythhSignalsPage.tsx
```

---

### 🔒 Guardrail #3: Runtime Invariant Checks

Add defensive code to `SignalsRadarPage.tsx`:

```tsx
export default function SignalsRadarPage() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ startupId?: string }>();
  
  const urlToResolve = searchParams.get('url');
  const startupId = params.startupId;
  
  // INVARIANT: Must have URL or startupId
  if (!urlToResolve && !startupId) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-bold mb-4">No Startup Selected</h2>
        <p className="text-gray-600 mb-6">
          Submit a URL from the homepage to see personalized investor signals.
        </p>
        <Link to="/" className="btn-primary">
          ← Back to Home
        </Link>
      </div>
    );
  }
  
  // ... rest of component
}
```

This prevents "nothing nothing nothing" even if routing works but params are missing.

---

### 🔒 Guardrail #4: Automated Test (CI Enforcement)

**Playwright test** to catch regressions:

```typescript
// tests/pythh-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('Pythh URL submission workflow', async ({ page }) => {
  // 1. Go to homepage
  await page.goto('https://pythh.ai');
  
  // 2. Submit URL
  await page.fill('input[placeholder*="Enter startup URL"]', 'stripe.com');
  await page.click('button:has-text("Analyze")');
  
  // 3. Verify redirect to /signals-radar
  await expect(page).toHaveURL(/\/signals-radar\?url=/);  // ✅ Key assertion
  
  // 4. Verify loading state
  await expect(page.locator('text=Resolving startup')).toBeVisible();
  
  // 5. Wait for results
  await expect(page.locator('[data-testid="signal-card"]')).toBeVisible({ timeout: 15000 });
  
  // 6. Verify NOT on wrong page
  await expect(page.locator('h1:has-text("Market Signals")')).not.toBeVisible();
});

test('Direct /signals access redirects', async ({ page }) => {
  // Navigate directly to /signals with URL param
  await page.goto('https://pythh.ai/signals?url=stripe.com');
  
  // Should immediately redirect to /signals-radar
  await expect(page).toHaveURL(/\/signals-radar\?url=/);  // ✅ Catches duplicate route bug
});
```

**Add to CI:**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
```

This ensures **CI fails** if anyone breaks the canonical workflow.

---

### 🔒 Guardrail #5: Better Entry Point Semantics

**Current:** Homepage submits to `/signals?url=...`

**Problem:** Makes `/signals` feel like a first-class surface (invites confusion).

**Alternative:** Use `/analyze` as the entry point:

```tsx
// PythhHome.tsx
const submit = () => {
  if (url.trim()) navigate(`/analyze?url=${encodeURIComponent(url.trim())}`);
};

// App.tsx
<Route path="/analyze" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />
```

This makes it clear:
- `/analyze` = entry point (transient, redirects immediately)
- `/signals-radar` = canonical results surface
- `/signals` = legacy alias (if needed at all)

---

### Implementation Priority

| Guardrail | Priority | Effort | Impact |
|-----------|----------|--------|--------|
| #3 Runtime checks | **HIGH** | 5 min | Prevents blank page |
| #4 Automated test | **HIGH** | 30 min | Catches future breaks |
| #1 SignalsAlias component | MEDIUM | 10 min | Makes intent explicit |
| #2 Rename/quarantine old page | MEDIUM | 5 min | Prevents misuse |
| #5 Better entry semantics | LOW | 15 min | Cleaner architecture |

**Recommendation:** Implement #3 and #4 **today**. They're quick wins that prevent catastrophic failures.

---

## Conclusion

### What Was Fixed

✅ **Removed duplicate `/signals` route** (line 132) that was catching traffic  
✅ **Preserved canonical redirect** (line 195) that routes to pythh engine  
✅ **Updated documentation comments** to clarify `/signals` is redirect-only  
✅ **Deployed to production** (commit `9ec845cf`)  

### How to Prevent This

1. **Never add a second route with the same path** - React Router can't handle duplicates
2. **Search before adding routes:** `grep "path=\"/signals\"" src/App.tsx`
3. **Read protective comments** - 22-line warning block exists for a reason
4. **Test the workflow** after route changes - submit a URL and verify full flow

### Why This Matters

This is the **CANONICAL workflow** for pythh.ai:
- Submit URL → scrape → score → match → signals
- This is "sacrament" - **must work every time**
- Breaking this breaks the entire product value proposition

The fix ensures users get personalized investor matches, not a static signals feed.

---

**End of Documentation**

For questions or issues, review:
- [PYTHH_ENGINE_CANONICAL_FLOW.md](PYTHH_ENGINE_CANONICAL_FLOW.md)
- [SYSTEM_GUARDIAN.md](SYSTEM_GUARDIAN.md)
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
