# 🚀 Quick Migration Guide - Startup Exits

## ⚡ Fast Setup (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Copy & Paste SQL
1. Open `supabase-startup-exits.sql` in this project
2. **Select All** (Cmd+A / Ctrl+A)
3. **Copy** (Cmd+C / Ctrl+C)
4. **Paste** into Supabase SQL Editor (Cmd+V / Ctrl+V)

### Step 3: Run
1. Click **Run** button (or press Cmd+Enter / Ctrl+Enter)
2. Wait for "Success" message

### Step 4: Verify
```bash
node verify-exits-setup.js
```

---

## ✅ What Gets Created

- ✅ `startup_exits` table
- ✅ Indexes for performance
- ✅ `investor_portfolio_performance` view
- ✅ `portfolio_performance` column on `investors` table

---

## 🎯 After Migration

Once migration is complete, you can:

1. **Detect Exits:**
   ```bash
   node detect-startup-exits.js
   ```

2. **Update Portfolio Performance:**
   ```bash
   node update-investor-portfolio-performance.js
   ```

3. **Verify Setup:**
   ```bash
   node verify-exits-setup.js
   ```

---

## ❌ Common Errors

### Error: "syntax error at or near '#!/'"
**Cause:** Trying to execute a JavaScript file as SQL  
**Fix:** Make sure you're copying from `supabase-startup-exits.sql`, not a `.js` file

### Error: "table already exists"
**Cause:** Migration was already run  
**Fix:** This is safe - the migration uses `IF NOT EXISTS`, so it won't break anything

### Error: "permission denied"
**Cause:** Using wrong API key  
**Fix:** Use Service Role Key (not anon key) for migrations

---

**That's it! The migration takes about 30 seconds to run.**





