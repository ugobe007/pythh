# 🚀 Quick Start - After Critical Fixes

**Updated:** December 6, 2025

---

## ⚡ Quick Setup (2 Minutes)

```bash
# 1. Setup environment variables
cp .env.example .env
cp server/.env.example server/.env

# 2. Edit .env files with your Supabase credentials
# (Open .env and server/.env in your editor)

# 3. Start backend (Terminal 1)
cd server
npm start
# ✅ Should see: "Server is running on http://localhost:3002"

# 4. Start frontend (Terminal 2) 
npm run dev
# ✅ Opens on http://localhost:5173
```

---

## ✅ Quick Test

```bash
# Test health check
curl http://localhost:3002/api/health

# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2025-12-06T...",
#   "port": 3002,
#   "version": "0.1.0"
# }
```

---

## 🔑 What Changed

- **Port:** 3001 → **3002**
- **Environment:** Templates now populated
- **API calls:** No more hardcoded URLs
- **Health check:** New endpoint at `/api/health`
- **Error handling:** Better 404 and 500 responses

---

## 📝 Required .env Variables

### Root `.env`:
```bash
VITE_API_URL=http://localhost:3002
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

### `server/.env`:
```bash
PORT=3002
NODE_ENV=development
```

---

## 🆘 Troubleshooting

**Port 3002 already in use?**
```bash
lsof -ti:3002 | xargs kill -9
```

**Backend not starting?**
```bash
cd server
npm install
npm start
```

**Frontend can't connect?**
- Check `.env` has `VITE_API_URL=http://localhost:3002`
- Restart frontend: `npm run dev`

**Still issues?**
```bash
# Check what's running
lsof -i :3002
lsof -i :5173

# Check logs
cd server && npm start  # See backend logs
```

---

## 📚 More Info

- **Full details:** See `FIXES_APPLIED.md`
- **Architecture:** See GitHub Copilot Instructions
- **API utility:** Use `src/lib/apiConfig.ts` for backend calls

---

**Ready to code!** 🎉
