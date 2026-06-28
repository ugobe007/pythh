# Database API Setup Complete ✅

## What's Been Done

1. ✅ **Installed `pg` dependency** in `/server/package.json`
2. ✅ **Created `/server/db.js`** - PostgreSQL connection pool
3. ✅ **Added `/api/pulse` endpoint** - Time-series signals for heat charts
4. ✅ **Enhanced `/api/health` endpoint** - Now includes database ping
5. ✅ **Added DATABASE_URL placeholder** to `.env`

## New Endpoints Available

### 1. GET /api/health
**Enhanced with database connectivity check**
```bash
curl http://localhost:3002/api/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-22T03:20:00.000Z",
  "port": 3002,
  "version": "0.1.0",
  "database": {
    "connected": true,
    "now": "2026-01-22T03:20:00.000Z"
  }
}
```

### 2. GET /api/pulse (NEW)
**Time-bucketed signal activity for live heat charts**
```bash
curl "http://localhost:3002/api/pulse?windowHours=24&bucketMinutes=10"
```
**Params:**
- `windowHours` - Time window (default: 24, max: 168)
- `bucketMinutes` - Time bucket size (default: 10, max: 60)

**Response:**
```json
{
  "ok": true,
  "windowHours": 24,
  "bucketMinutes": 10,
  "rows": [
    {
      "bucket_ts": "2026-01-22T03:00:00Z",
      "channel": "Series A",
      "signal": 15.5
    }
  ]
}
```

### 3. GET /api/events
**Already exists - works with Supabase client**
```bash
curl "http://localhost:3002/api/events?type=signal&limit=10"
```

### 4. GET /api/live-signals
**Already exists - works with Supabase client**
```bash
curl "http://localhost:3002/api/live-signals?limit=20"
```

### 5. GET /api/engine/status
**Already exists - subsystem health monitoring**
```bash
curl http://localhost:3002/api/engine/status
```

## 🚨 ACTION REQUIRED: Set Your Database Password

The endpoints are ready, but you need to set your actual database password.

### Step 1: Get Your Database Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `unkpogyhhjbvxxjvmxlt`
3. Navigate to: **Settings** → **Database** → **Connection string**
4. Select: **URI** (Transaction mode) - **NOT Session mode**
5. Copy the connection string

### Step 2: Update .env File

Open `/Users/leguplabs/Desktop/hot-honey/.env` and replace this line:

```bash
DATABASE_URL=postgresql://postgres.unkpogyhhjbvxxjvmxlt:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

With your actual connection string (it should look like this):

```bash
DATABASE_URL=postgresql://postgres.unkpogyhhjbvxxjvmxlt:eyJhbGciOiJIUzI1N...@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Note:** The password is a JWT token, not a regular password.

### Step 3: Restart the Server

```bash
cd /Users/leguplabs/Desktop/hot-honey/server
npm start
```

### Step 4: Test the Endpoints

```bash
# Health check with DB
curl http://localhost:3002/api/health

# Get pulse data
curl "http://localhost:3002/api/pulse?windowHours=24&bucketMinutes=10"

# Live signals
curl "http://localhost:3002/api/live-signals?limit=10"

# Events
curl "http://localhost:3002/api/events?limit=5"

# Engine status
curl http://localhost:3002/api/engine/status
```

## Database Schema Verification

Your `investor_events_weighted` table has these columns:
- `id`, `startup_id`, `investor_id`
- `investor_tier`, `archetype`, `event_type`
- `occurred_at`, `metadata`
- `base_event_weight`, `tier_multiplier`, `archetype_multiplier`, `signal_weight`

The `/api/pulse` endpoint uses:
- `occurred_at` - timestamp
- `archetype` - channel/category
- `signal_weight` - weight of the signal

## Port Configuration

Your server runs on **port 3002** (not 3001 as in the example).
This is configured in `/server/index.js`:
```javascript
const PORT = process.env.PORT || 3002;
```

## Files Modified

1. `/server/package.json` - Added `pg` dependency
2. `/server/db.js` - New file (PostgreSQL pool)
3. `/server/index.js` - Added:
   - Import of `{ pool }` from `./db`
   - Enhanced `/api/health` with DB ping
   - New `/api/pulse` endpoint with time-bucketing
4. `/.env` - Added `DATABASE_URL` and `DATABASE_SSL` (needs password)

## Next Steps

Once you set the DATABASE_URL:

1. **Test all endpoints** - Use the curl commands above
2. **Wire up /live page** - Set it to refresh `/api/pulse` every 15 seconds
3. **Monitor health** - Use `/api/health` to check DB connectivity
4. **Scale query** - Adjust `windowHours` and `bucketMinutes` based on your data volume

## Troubleshooting

### "db_unreachable" Error
- ✅ DATABASE_URL is set in .env
- ✅ Password is correct (JWT token from Supabase)
- ✅ Using **Transaction mode** pooler (port 6543, not 5432)
- ✅ DATABASE_SSL=true is set

### "pulse_query_failed" Error
- Check if `investor_events_weighted` table exists
- Verify `occurred_at` and `signal_weight` columns exist
- Check database user has SELECT permissions

### Server Won't Start
```bash
# Check if port 3002 is in use
lsof -ti:3002

# Kill existing process
pkill -f "node.*server.*index.js"

# Restart
cd /Users/leguplabs/Desktop/hot-honey/server && npm start
```

---

**Status:** ✅ Implementation complete - awaiting DATABASE_URL configuration
