# 🎯 Hot Money Honey - Quick Diagnostic Reference

**Use this card when things break or after every Copilot session**

---

## 🚦 Step 1: Run Automated Regression Test

```bash
cd /Users/leguplabs/Desktop/hot-honey
./regression-test.sh
```

**Takes:** 10 seconds  
**Checks:** File existence, imports, env vars, dependencies, code quality, git status

**Result:**
- ✅ **All Pass** → Safe to continue
- ⚠️ **Warnings** → Review before deploy
- ❌ **Failures** → Fix before continuing

---

## 🔬 Step 2: Run Data Mapping Diagnostic

**When to use:** 
- Regression test passes but app doesn't work right
- Scores all showing same value (85, 0, etc)
- Data not displaying in UI
- After modifying matchingService.ts or database queries

**How to run:**
1. Open browser: `http://localhost:5175`
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Copy entire file: `data-mapping-diagnostic.js`
5. Paste in console and press Enter
6. Read results (takes 2-5 seconds)

**What it tells you:**
```
✅ Database connected
✅ 50 startups found
⚠️ team field in extracted_data but GOD reads top level
⚠️ traction field in extracted_data but GOD reads top level
❌ revenue field not found anywhere
```

**Then what:**
- See the "FIELDS THAT NEED FALLBACK MAPPING" section
- Copy the suggested fixes to matchingService.ts
- Test again

---

## 🐛 Step 3: Check Specific Issues

### Issue: "App won't load / white screen"

```bash
# Check for compile errors
npm run dev

# Look for red errors in terminal
# Fix any TypeScript errors before continuing
```

### Issue: "Database not connected"

```bash
# Check environment variables
cat .env | grep SUPABASE

# Should see:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...

# If missing, copy from Supabase dashboard
```

### Issue: "Scores all show 85 or 0"

**This is the data mapping bug!**

Run the data mapping diagnostic (Step 2 above). It will show exactly which fields are undefined.

Common fix pattern:
```typescript
// In matchingService.ts
const team = startup.team || startup.extracted_data?.team || [];
const traction = startup.traction || startup.extracted_data?.traction || '';
const revenue = startup.revenue || startup.extracted_data?.revenue || 0;
```

### Issue: "Changes not appearing"

```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run dev

# Hard refresh browser
# Mac: Cmd + Shift + R
# Windows: Ctrl + Shift + R
```

---

## 📊 Interpreting Diagnostic Results

### ✅ Good Output:
```
✅ Supabase client found
✅ Found 50 startups
✅ Found 20 investors
✅ team → startup.team
✅ traction → startup.traction
✅ All expected fields found at top level
✅ All fields properly mapped with fallbacks
```
**Action:** Keep coding! Everything works.

---

### ⚠️ Warning Output:
```
⚠️ team → startup.extracted_data.team
⚠️ traction → startup.extracted_data.traction

🚨 FIELDS THAT NEED FALLBACK MAPPING:
   Startup: team, traction
```
**Action:** Add fallback operators to matchingService.ts

**Fix:**
```typescript
// Before
const profile = {
  team: startup.team,
  traction: startup.traction
};

// After
const profile = {
  team: startup.team || startup.extracted_data?.team || [],
  traction: startup.traction || startup.extracted_data?.traction || ''
};
```

---

### ❌ Error Output:
```
❌ Supabase client not found
❌ Startup query failed: permission denied
❌ revenue → NOT FOUND
```
**Actions:**
1. **Supabase not found:** Add to .env, restart dev server
2. **Permission denied:** Check RLS policies in Supabase
3. **Field not found:** Either field doesn't exist in DB or needs to be added to query

---

## 🎓 Common Patterns

### Pattern 1: After modifying matchingService.ts
```bash
./regression-test.sh
# Then run data diagnostic in browser
```

### Pattern 2: After modifying database schema
```bash
# Run diagnostic to see new field structure
# Update matchingService.ts to use new fields
./regression-test.sh
```

### Pattern 3: Before committing code
```bash
./regression-test.sh
npm run build
git add .
git commit -m "Your message"
```

### Pattern 4: After pulling from GitHub
```bash
npm install
./regression-test.sh
npm run dev
```

---

## 🆘 Emergency Fixes

### "Everything is broken!"

1. **Stop dev server** (Ctrl+C)
2. **Clean install:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. **Check .env exists:**
   ```bash
   ls -la .env
   ```
4. **Run regression test:**
   ```bash
   ./regression-test.sh
   ```
5. **Start dev server:**
   ```bash
   npm run dev
   ```

### "Diagnostic tool won't run"

The diagnostic needs access to Supabase client. Add this temporarily to `src/lib/supabase.ts`:

```typescript
// At the bottom of the file
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
```

Then restart dev server and try again.

---

## 📞 Support

**If both diagnostics pass but app still broken:**

1. Check browser console for errors (F12 → Console)
2. Check Network tab for failed requests (F12 → Network)
3. Check Supabase logs (Supabase Dashboard → Logs)
4. Review last git commit - what changed?

**If diagnostics find issues you can't fix:**

1. Copy the exact error output
2. Share with AI Copilot with context
3. Ask: "The diagnostic found these issues: [paste output]. How do I fix them?"

---

## 🎯 TL;DR

**After every Copilot session:**

```bash
# 1. Run this (10 sec)
./regression-test.sh

# 2. If it passes, open browser and run data diagnostic
#    Copy/paste data-mapping-diagnostic.js into console (30 sec)

# 3. Fix any issues it finds

# 4. Test the app manually (2 min)
```

**Total time: < 3 minutes to catch 95% of bugs**

---

*Quick Reference v1.0 - December 6, 2025*
