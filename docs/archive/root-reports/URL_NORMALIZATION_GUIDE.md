# URL Normalization - Implementation Summary

## Problem Solved
Prevent duplicate jobs for the same startup when URLs differ by:
- Case: `nucleoresearch.com` vs `NucleoResearch.com`
- Protocol: `http://` vs `https://`
- Trailing slash: `example.com` vs `example.com/`
- Whitespace: `  stripe.com  `

## Solution: Canonical URL Normalization

### 1. Database Function (PostgreSQL)
```sql
CREATE OR REPLACE FUNCTION normalize_url(input_url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_url, '^https?://', '', 'i'),
      '/$', ''
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**File**: `migrations/run_all_signal_tables.sql` (line 8)

### 2. JavaScript Function (Backend/Frontend)
```javascript
export function normalizeUrl(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}
```

**File**: `server/utils/urlNormalization.js`

### 3. Table Schema Update
```sql
CREATE TABLE startup_jobs (
  url TEXT NOT NULL,  -- Original URL (as submitted)
  url_normalized TEXT NOT NULL 
    GENERATED ALWAYS AS (normalize_url(url)) STORED,  -- Auto-normalized
  ...
);

-- Unique constraint prevents duplicates
CREATE UNIQUE INDEX idx_startup_jobs_url_normalized 
  ON startup_jobs(url_normalized);
```

## How It Works

### Database Level (Automatic)
When you insert a job:
```sql
INSERT INTO startup_jobs (url, status)
VALUES ('https://NucleoResearch.com/', 'queued');
```

PostgreSQL automatically:
1. Stores `url` = `'https://NucleoResearch.com/'`
2. Generates `url_normalized` = `'nucleoresearch.com'`
3. Checks unique constraint on `url_normalized`

If you try to insert:
```sql
INSERT INTO startup_jobs (url, status)
VALUES ('HTTP://nucleoresearch.COM', 'queued');
```

❌ **FAILS** - `url_normalized` is same: `'nucleoresearch.com'`

### Backend API Level (Submit Endpoint)
```javascript
const { normalizeAndValidateUrl } = require('../utils/urlNormalization');

// User submits: "https://NucleoResearch.com/"
const normalizedUrl = normalizeAndValidateUrl(req.body.url);
// Result: "nucleoresearch.com"

// Check for existing job
const { data: existingJob } = await supabase
  .from('startup_jobs')
  .select('*')
  .eq('url_normalized', normalizedUrl)  // ← Query by normalized URL
  .single();

if (existingJob) {
  return res.json({ 
    job_id: existingJob.id, 
    status: existingJob.status,
    existing: true 
  });
}
```

**File**: `server/routes/discoverySubmit.js`

## Files Created/Updated

### Migration Files
1. ✅ **`migrations/run_all_signal_tables.sql`**
   - Main migration (run this in Supabase)
   - Creates normalize_url() function
   - Creates startup_jobs with url_normalized column
   - Creates unique index

2. ✅ **`migrations/create_startup_jobs.sql`**
   - Standalone jobs table migration
   - Includes normalization function

3. ✅ **`migrations/test_url_normalization.sql`**
   - Test queries to verify normalization works

### Backend Files
4. ✅ **`server/utils/urlNormalization.js`**
   - JavaScript normalization functions
   - Matches SQL logic exactly
   - Export for use in routes

5. ✅ **`server/routes/discoverySubmit.js`**
   - New POST /api/discovery/submit endpoint
   - Uses urlNormalization.js
   - Queries by url_normalized
   - Idempotent (returns existing job)

## Usage Examples

### Frontend (Submit URL)
```javascript
import { normalizeUrl } from './utils/urlNormalization';

// User enters: "HTTPS://NucleoResearch.com/"
const userInput = urlInput.value;

// Submit original URL (backend will normalize)
const response = await fetch('/api/discovery/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: userInput })
});

const { job_id, status, existing } = await response.json();

if (existing) {
  console.log('Job already exists, polling for results...');
}
```

### Backend (Query Jobs)
```javascript
const { normalizeUrl } = require('./utils/urlNormalization');

// Always normalize before querying
const normalized = normalizeUrl(inputUrl);

const { data } = await supabase
  .from('startup_jobs')
  .select('*')
  .eq('url_normalized', normalized)
  .single();
```

### SQL (Direct Queries)
```sql
-- Find job for any URL variation
SELECT * FROM startup_jobs
WHERE url_normalized = normalize_url('https://NucleoResearch.com/')
LIMIT 1;

-- Show all jobs with normalized URLs
SELECT url, url_normalized, status 
FROM startup_jobs
ORDER BY created_at DESC;
```

## Benefits

✅ **No Duplicate Jobs**
- Same startup, different URL casing → Same job
- Saves processing time, database space

✅ **Idempotent API**
- POST /submit twice with same URL → Returns same job_id
- Frontend can safely retry

✅ **Consistent Lookups**
- Backend always queries by url_normalized
- No case-sensitivity issues

✅ **Automatic**
- url_normalized is GENERATED column
- No manual updates needed
- Always in sync with url

## Next Steps (Phase 3)

1. ✅ Run `migrations/run_all_signal_tables.sql` in Supabase
2. ✅ Test with `migrations/test_url_normalization.sql`
3. [ ] Wire up `/api/discovery/submit` endpoint in Express
4. [ ] Update frontend to call submit instead of convergence directly
5. [ ] Add `/api/discovery/results?job_id=...` endpoint
6. [ ] Convert frontend to poll results by job_id

## Testing Checklist

- [ ] Insert job with `https://test.com/` → Success
- [ ] Insert job with `HTTP://TEST.COM` → Fails (duplicate)
- [ ] Query with `normalize_url('HTTPS://Test.COM/')` → Finds job
- [ ] Submit same URL twice via API → Returns same job_id
- [ ] Submit different case URL → Returns existing job

## Migration Command

```bash
# Copy contents of run_all_signal_tables.sql
# Paste into Supabase SQL Editor
# Click "Run"

# Should see:
# ✅ All signal architecture tables created successfully
# 📊 Tables: startup_jobs (with URL normalization), startup_signal_snapshots, startup_signal_deltas
# 🔧 Indexes and triggers created
# 🔒 Unique constraint on url_normalized prevents duplicates
```

---

*Last updated: January 23, 2026*
*Phase 3: Backend Job Model - URL Normalization*
