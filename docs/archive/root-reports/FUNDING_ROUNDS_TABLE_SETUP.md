# Funding Rounds Table Setup Guide 📊

## ⚠️ Important: Use the SQL File, Not TypeScript!

The error you saw (`syntax error at or near "export"`) means you accidentally tried to run a TypeScript file (`database.types.ts`) as SQL.

**Use this file instead:** `create-funding-rounds-table.sql`

---

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor
- Go to your Supabase Dashboard
- Navigate to **SQL Editor**
- Click **New Query**

### 2. Copy the SQL from `create-funding-rounds-table.sql`

**File location:** `/Users/leguplabs/Desktop/hot-honey/create-funding-rounds-table.sql`

**OR copy this SQL directly:**

```sql
-- Funding Rounds Table
CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,
  amount NUMERIC,
  valuation NUMERIC,
  date DATE NOT NULL,
  lead_investor TEXT,
  investors TEXT[],
  source TEXT,
  source_url TEXT,
  announced BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_rounds_startup ON funding_rounds(startup_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_date ON funding_rounds(date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_startup_date ON funding_rounds(startup_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_type ON funding_rounds(round_type);

CREATE OR REPLACE FUNCTION update_funding_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_funding_rounds_updated_at
  BEFORE UPDATE ON funding_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_funding_rounds_updated_at();
```

### 3. Paste into SQL Editor and Run

- Paste the SQL into the editor
- Click **Run** (or press Cmd/Ctrl + Enter)
- You should see: "Success. No rows returned"

### 4. Verify Table Created

Run this query to verify:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'funding_rounds';
```

Should return: `funding_rounds`

---

## What This Creates

✅ **`funding_rounds` table** with:
- Links to `startup_uploads` via `startup_id`
- Round type, amount, valuation, date
- Investor information
- Source tracking
- Automatic `updated_at` trigger

✅ **4 indexes** for fast queries:
- By startup_id
- By date (descending)
- By startup_id + date
- By round_type

---

## Next Steps

After the table is created:
1. Extract funding history from existing data
2. Populate `funding_rounds` table
3. Test velocity calculations
4. Integrate into GOD scoring

---

**Remember:** Always use `.sql` files in the SQL Editor, never `.ts` or `.js` files! 🚀





