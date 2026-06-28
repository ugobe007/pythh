# 🔄 PM2 Restart Instructions

## **Issue**
PM2 is running old code that has the `.catch()` error. You need to restart with environment variable updates.

## **Solution**

### **Option 1: Restart with Environment Update (Recommended)**
```bash
pm2 restart hot-match-autopilot --update-env
```

This will:
- ✅ Reload the latest code
- ✅ Update environment variables from `.env`
- ✅ Clear cached code

### **Option 2: Stop and Start Fresh**
```bash
pm2 stop hot-match-autopilot
pm2 start hot-match-autopilot --update-env
```

### **Option 3: Delete and Recreate**
```bash
pm2 delete hot-match-autopilot
cd /Users/leguplabs/Desktop/hot-honey
pm2 start scripts/core/hot-match-autopilot.js --name hot-match-autopilot --update-env
```

---

## **Verify It's Fixed**

After restarting, check logs:
```bash
pm2 logs hot-match-autopilot --lines 50
```

You should **NOT** see:
- ❌ `TypeError: supabase.from(...).insert(...).catch is not a function`

You **SHOULD** see:
- ✅ Pipeline running successfully
- ✅ "📦 Discovered startups pending: [number]" instead of "null"
- ✅ Import messages

---

## **Why This Happened**

1. The `.catch()` error was fixed in the code
2. But PM2 was still running the old cached version
3. Restarting with `--update-env` forces PM2 to reload everything

---

## **Going Forward**

After fixing `.env`, always use:
```bash
pm2 restart [process-name] --update-env
```

This ensures PM2 picks up environment variable changes.

