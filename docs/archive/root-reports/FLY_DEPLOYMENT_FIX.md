# 🔧 Fly.io Deployment Fix

**Issue:** Site is down at https://hot-honey.fly.dev/admin/health

---

## 🔍 Likely Causes

### 1. **Machine Auto-Stopped** (Most Likely)
**Problem:** `min_machines_running = 0` in fly.toml means machines can stop when idle

**Fix Applied:**
- Changed `min_machines_running = 0` → `min_machines_running = 1`
- This keeps at least 1 machine running at all times

### 2. **Missing Build**
**Problem:** `dist` folder might not be built or deployed

**Fix:**
```bash
npm run build
flyctl deploy
```

### 3. **Deployment Failed**
**Problem:** Last deployment might have failed

**Fix:**
```bash
flyctl status
flyctl logs
flyctl deploy --remote-only
```

---

## 🚀 Quick Fix

### Option 1: Use Fix Script (Recommended)
```bash
chmod +x fix-fly-deployment.sh
./fix-fly-deployment.sh
```

### Option 2: Manual Steps

#### Step 1: Build the App
```bash
npm run build
```

#### Step 2: Check Fly Status
```bash
flyctl status
flyctl logs
```

#### Step 3: Restart Machine
```bash
flyctl machine restart
# Or
flyctl scale count 1
```

#### Step 4: Redeploy
```bash
flyctl deploy --remote-only
```

---

## 🔍 Diagnostic Commands

### Check Machine Status
```bash
flyctl status
flyctl machine list
```

### View Logs
```bash
flyctl logs
flyctl logs --app hot-honey
```

### Check if Site is Accessible
```bash
curl https://hot-honey.fly.dev/admin/health
```

### Restart Machine
```bash
flyctl machine restart
```

### Scale to 1 Machine (Keep Running)
```bash
flyctl scale count 1
```

---

## ✅ Changes Made

### 1. Updated fly.toml
- Changed `min_machines_running = 0` → `min_machines_running = 1`
- This prevents the site from going down when idle

### 2. Created Fix Script
- `fix-fly-deployment.sh` - Automated deployment fix

---

## 🎯 Next Steps

1. **Run the fix script:**
   ```bash
   ./fix-fly-deployment.sh
   ```

2. **Or manually:**
   ```bash
   npm run build
   flyctl deploy --remote-only
   ```

3. **Verify it's working:**
   ```bash
   flyctl open
   # Or visit: https://hot-honey.fly.dev/admin/health
   ```

---

## 🐛 Common Issues

### Issue: "Machine not found"
**Fix:**
```bash
flyctl machine list
flyctl scale count 1
```

### Issue: "Build failed"
**Fix:**
```bash
npm run build
# Check for errors
flyctl deploy --remote-only
```

### Issue: "502 Bad Gateway"
**Fix:**
- Machine might be starting up (wait 30 seconds)
- Check logs: `flyctl logs`
- Restart: `flyctl machine restart`

### Issue: "404 Not Found"
**Fix:**
- Check if dist folder exists: `ls -la dist/`
- Rebuild: `npm run build`
- Redeploy: `flyctl deploy`

---

## 📊 Expected Results

After fix:
- ✅ Site accessible at https://hot-honey.fly.dev
- ✅ At least 1 machine always running
- ✅ Health endpoint working: `/admin/health`
- ✅ No more downtime from auto-stop

---

**Run `./fix-fly-deployment.sh` to fix the deployment! 🚀**

