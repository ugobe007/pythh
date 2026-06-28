# 🗺️ discovered_startups Column Mapping Reference

**Quick reference for correct column names when working with discovered_startups table**

---

## ✅ CORRECT COLUMNS (Use These!)

```javascript
// When inserting/querying discovered_startups, use:
{
  website: 'https://example.com',           // ✅ CORRECT
  article_url: 'https://techcrunch.com/..', // ✅ CORRECT  
  imported_to_startups: false               // ✅ CORRECT
}
```

---

## ❌ WRONG COLUMNS (Don't Use!)

```javascript
// These columns DO NOT EXIST (Supabase cache ghosts):
{
  url: 'https://example.com',      // ❌ WRONG - use 'website'
  source: 'https://...',           // ❌ WRONG - use 'article_url'
  imported_to_review: false        // ❌ WRONG - use 'imported_to_startups'
}
```

---

## 🔧 Complete Schema (20 columns)

```sql
discovered_startups:
  1. id                         UUID (primary key)
  2. name                       TEXT (required)
  3. website                    TEXT ✅ Use this, not "url"
  4. description                TEXT
  5. funding_amount             TEXT
  6. funding_stage              TEXT
  7. investors_mentioned        TEXT[]
  8. discovered_from_article_id UUID (FK to rss_articles)
  9. article_url                TEXT ✅ Use this, not "source"
  10. article_title             TEXT
  11. article_date              TIMESTAMPTZ
  12. rss_source                TEXT
  13. imported_to_startups      BOOLEAN ✅ Use this, not "imported_to_review"
  14. imported_at               TIMESTAMPTZ
  15. startup_id                UUID
  16. website_verified          BOOLEAN
  17. website_status            TEXT
  18. discovered_at             TIMESTAMPTZ
  19. created_at                TIMESTAMPTZ
  20. updated_at                TIMESTAMPTZ
```

---

## 📝 Example Queries

### **INSERT (Direct Postgres - RECOMMENDED)**

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

await pool.query(
  `INSERT INTO discovered_startups 
   (name, website, description, article_url, discovered_at, imported_to_startups)
   VALUES ($1, $2, $3, $4, NOW(), false)`,
  [name, website, description, articleUrl]
);
```

### **SELECT Pending Startups**

```javascript
const result = await pool.query(
  `SELECT name, website, description, discovered_at 
   FROM discovered_startups 
   WHERE imported_to_startups = false
   ORDER BY discovered_at DESC 
   LIMIT 20`
);
```

### **UPDATE After Import**

```javascript
await pool.query(
  `UPDATE discovered_startups 
   SET imported_to_startups = true, 
       imported_at = NOW(),
       startup_id = $1
   WHERE id = $2`,
  [startupId, discoveredId]
);
```

---

## 🔍 Verification

Run this to see actual columns:

```bash
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.POSTGRES_URL}); pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = \\'discovered_startups\\' AND table_schema = \\'public\\' ORDER BY ordinal_position').then(r => { r.rows.forEach(row => console.log(row.column_name)); pool.end(); });"
```

Expected output: 20 columns, **NO** `url`, `source`, or `imported_to_review`

---

## ⚠️ Common Mistakes

### **Mistake 1: Using Supabase JS SDK**
```javascript
// ❌ DON'T - SDK sees ghost columns
const { data } = await supabase
  .from('discovered_startups')
  .insert({ url: '...', source: '...', imported_to_review: false });
// Error: column "url" does not exist
```

```javascript
// ✅ DO - Use direct Postgres
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
await pool.query(
  'INSERT INTO discovered_startups (website, article_url, imported_to_startups) VALUES ($1, $2, false)',
  [website, articleUrl]
);
```

### **Mistake 2: Wrong Column Names in WHERE Clauses**
```javascript
// ❌ DON'T
.where('imported_to_review = false')

// ✅ DO  
.where('imported_to_startups = false')
```

---

## 📋 Search & Replace Guide

If updating old code, do these replacements:

| Find | Replace With |
|------|-------------|
| `discovered_startups.url` | `discovered_startups.website` |
| `{ url: ` | `{ website: ` |
| `.source` | `.article_url` |
| `imported_to_review` | `imported_to_startups` |

---

## 🎯 Why This Matters

- **Schema Cache:** Supabase PostgREST serves stale schema with ghost columns
- **Real Database:** Only has 20 columns with correct names
- **Scripts:** Must use direct Postgres to avoid cache issues
- **Performance:** Using wrong columns = runtime errors

---

**Last Updated:** December 12, 2025  
**Status:** All scripts fixed and working ✅
