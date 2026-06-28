# 🔍 Debug Checklist - LiveMatchingStrip Not Showing

**If component is not visible after rebuild, follow these steps:**

---

## 1️⃣ BROWSER CONSOLE CHECKS

### Open DevTools Console (F12 or Cmd+Opt+I)

**Check for React errors:**
```
Look for red error messages
Common issues:
- "Cannot read property 'map' of undefined"
- "Supabase client error"
- Component import errors
```

**Check if component is rendering:**
```javascript
// Type in console:
document.querySelector('[class*="LiveMatching"]')
// Should return an element, not null
```

---

## 2️⃣ NETWORK TAB CHECKS

### Open DevTools Network Tab

**Look for Supabase queries:**
```
Filter by: "rest"
Should see POST requests to:
- unkpogyhhjbvxxjvmxlt.supabase.co/rest/v1/startup_investor_matches
```

**Check response:**
- Status should be 200
- Response should have data array
- If 401: Auth problem
- If 500: Database error
- If empty array: No matches in database

---

## 3️⃣ INSPECT ELEMENT

### Right-click on page → Inspect

**Search for component in DOM:**
```
Cmd+F in Elements tab
Search for: "LiveMatching"
or "Auto-rotating real matches"
```

**If found but invisible:**
- Check CSS: display, opacity, z-index
- Check overflow: hidden on parent
- Check height/width

**If NOT found:**
- Component not rendering
- Check React component tree

---

## 4️⃣ MANUAL DATABASE CHECK

### Run in Browser Console:

```javascript
// Import Supabase client
const { createClient } = window.supabase || {};

// Or if already imported:
const supabaseUrl = 'https://unkpogyhhjbvxxjvmxlt.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY_HERE'; // From .env VITE_SUPABASE_ANON_KEY

const sb = createClient(supabaseUrl, supabaseKey);

// Check matches exist
const { data, error } = await sb
  .from('startup_investor_matches')
  .select('*')
  .gte('match_score', 60)
  .limit(5);

console.log('Matches:', data);
console.log('Error:', error);
```

**Expected result:**
- `data` should be array with 5+ matches
- Each match should have: startup_id, investor_id, match_score

**If data is empty:**
- No matches with score >= 60
- Run: `node match-regenerator.js`

---

## 5️⃣ CHECK COMPONENT FILE

### Verify LiveMatchingStrip.tsx imports Supabase:

```typescript
import { supabase } from '../lib/supabase';
```

**Path should be correct:**
- From components/ → ../lib/supabase ✅
- From pithh/ → ../lib/supabase ✅

---

## 6️⃣ CHECK ENV VARIABLES

### Verify .env has:

```bash
cd /Users/leguplabs/Desktop/hot-honey
cat .env | grep VITE_SUPABASE
```

**Should show:**
```
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**If missing:**
- Component can't connect to database
- Copy from .env.example

---

## 7️⃣ ROUTE CHECK

### Make sure you're on correct page:

**Landing page:**
```
http://localhost:5173/
```

**Signals page:**
```
http://localhost:5173/signals-radar
```

**NOT:**
- /signals (redirects, might break during redirect)
- /discover (different page, doesn't have component)

---

## 8️⃣ QUICK CONSOLE TEST

### Paste this in browser console to force render check:

```javascript
// Check if React sees the component
const allDivs = document.querySelectorAll('div');
const found = Array.from(allDivs).find(div => 
  div.textContent?.includes('Live Matching') || 
  div.textContent?.includes('No active matches')
);
console.log('LiveMatching found:', found);
```

---

## 🛠️ COMMON FIXES

### Fix 1: Restart Dev Server
```bash
# Kill existing
pkill -f "vite"

# Restart
npm run dev
```

### Fix 2: Clear Browser Cache
```
Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
```

### Fix 3: Re-run Match Generator
```bash
node match-regenerator.js
```

### Fix 4: Check PM2 (if using)
```bash
pm2 restart all
pm2 logs
```

### Fix 5: Verify Build Output
```bash
grep -r "LiveMatchingStrip" dist/assets/*.js
# Should find the component code in bundle
```

---

## 📊 EXPECTED BEHAVIOR

### When Working:

1. **Page loads** → Component fetches matches
2. **2-3 seconds** → Cards appear (loading state)
3. **Every 8 seconds** → Cards rotate to next match
4. **Every 60 seconds** → New data fetched from database

### Visual Structure:

```
┌─────────────────────────────────────────────────┐
│  Live Matching Proof                            │
│  ┌──────────────┬──────────────┐                │
│  │  INVESTOR    │   STARTUP    │                │
│  │  (cyan)      │   (violet)   │                │
│  │  Score: 85   │   Score: 85  │                │
│  └──────────────┴──────────────┘                │
└─────────────────────────────────────────────────┘
```

---

## 🚨 ERROR MESSAGES & FIXES

### "No active matches"
**Cause:** Database has 0 matches with score >= 60  
**Fix:** `node match-regenerator.js`

### "Cannot read property 'length' of undefined"
**Cause:** Supabase query returned undefined  
**Fix:** Check network tab for 401/500 errors

### Component renders but cards blank
**Cause:** Foreign key data not loaded  
**Fix:** Check startup_uploads and investors tables have data

### Cards don't rotate
**Cause:** matches.length = 0 or timer not starting  
**Fix:** Check console for errors, verify matches.length > 0

---

## 📝 REPORT BACK WITH:

When you test, please provide:

1. **Console errors** (screenshot or copy/paste)
2. **Network tab** (any failed requests?)
3. **Element inspect** (is `<LiveMatchingStrip />` in DOM?)
4. **Database query result** (run manual check from #4)

This will tell us if it's:
- **Wiring problem** → Component not rendering
- **Database problem** → No data returned
- **CSS problem** → Rendered but invisible
- **Path problem** → Import failing

---

*Ready to debug! Try the rebuild and report findings.*
