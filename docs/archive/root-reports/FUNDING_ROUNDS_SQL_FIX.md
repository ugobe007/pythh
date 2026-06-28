# Funding Rounds Table - SQL Fix 🔧

## The Error
`ERROR: 42601: syntax error at end of input`

This usually means:
- Missing semicolon
- Incomplete SQL statement
- Issue with trigger function syntax

## Solution: Run in Steps

### Option 1: Run All at Once (Try This First)

Copy and paste this **entire block** into Supabase SQL Editor:

```sql
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
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_funding_rounds_updated_at
  BEFORE UPDATE ON funding_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_funding_rounds_updated_at();
```

### Option 2: Run Step by Step (If Option 1 Fails)

**Step 1:** Create the table
```sql
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
```

**Step 2:** Create indexes
```sql
CREATE INDEX IF NOT EXISTS idx_funding_rounds_startup ON funding_rounds(startup_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_date ON funding_rounds(date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_startup_date ON funding_rounds(startup_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_type ON funding_rounds(round_type);
```

**Step 3:** Create trigger function
```sql
CREATE OR REPLACE FUNCTION update_funding_rounds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

**Step 4:** Create trigger
```sql
CREATE TRIGGER trigger_update_funding_rounds_updated_at
  BEFORE UPDATE ON funding_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_funding_rounds_updated_at();
```

### Option 3: Minimal Version (No Trigger)

If the trigger is causing issues, you can skip it for now:

```sql
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
```

## Verify It Worked

After running, verify with:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'funding_rounds';
```

Should return: `funding_rounds`

## Common Issues

1. **Missing semicolon** - Make sure each statement ends with `;`
2. **Copy/paste issues** - Make sure you copy the entire SQL block
3. **Trigger syntax** - Some SQL editors are picky about `$$` delimiters

Try Option 1 first, then Option 2 if needed! 🚀





