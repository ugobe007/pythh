# 🚪 Startup Exits Tracking System

## 🎯 Overview

Tracks startup exits (acquisitions, mergers, IPOs) and correlates with investors for portfolio performance tracking.

**Key Features:**
- Detects exits from news articles
- Distinguishes exits from investments/partnerships
- Links exits to investors
- Tracks portfolio performance
- Analyzes what made startups attractive

---

## 📊 Database Schema

### `startup_exits` Table

**Fields:**
- `startup_id` - Reference to startup
- `startup_name` - Startup name
- `exit_type` - 'acquisition', 'merger', 'ipo', 'spac', 'direct_listing'
- `exit_date` - Date of exit
- `exit_value` - Value (e.g., "$1.2B")
- `exit_value_numeric` - Numeric value for analysis
- `acquirer_name` - Acquirer (for acquisitions/mergers)
- `exchange` - Exchange (for IPOs)
- `ticker_symbol` - Ticker (for IPOs)
- `investors_involved` - Array of investor IDs
- `lead_investor_id` - Lead investor
- `key_factors` - What made startup attractive
- `exit_notes` - AI-generated insights

**View:**
- `investor_portfolio_performance` - Aggregates exit data per investor

---

## 🔍 Exit Detection Logic

### Distinguishes Between:

**✅ EXIT (Tracked):**
- "Company X acquired Startup Y for $1B"
- "Startup Y merges with Company X"
- "Startup Y goes public on NASDAQ"

**❌ INVESTMENT (Ignored):**
- "Facebook invests $50M in Startup Y"
- "Stripe leads $100M Series B in Fintech"
- "Company X participates in funding round"

**❌ PARTNERSHIP (Ignored):**
- "Stripe partners with Fintech startup"
- "Company X teams up with Startup Y"
- "Strategic partnership announced"

### Detection Methods:

1. **Keyword Matching** - Identifies exit keywords
2. **AI Classification** - Uses Anthropic AI to distinguish exits from investments
3. **Context Analysis** - Analyzes article context for transaction type

---

## 🚀 Usage

### Run Exit Detection:
```bash
node detect-startup-exits.js
```

### Update Portfolio Performance:
```bash
node update-investor-portfolio-performance.js
```

### Create Database Schema:
```sql
-- Run in Supabase SQL Editor
\i supabase-startup-exits.sql
```

---

## 📋 Automation

**Added to automation-engine:**
- **Exit Detection:** Runs daily
- **Portfolio Performance:** Runs daily (after exit detection)

---

## 🎯 What We Learn from Exits

### Key Factors Tracked:
- Product-market fit indicators
- Team strength
- Rapid growth metrics
- Market timing
- Strategic value
- Technology/IP value

### Portfolio Performance Metrics:
- Total exits per investor
- Total exit value
- Exit types breakdown (acquisitions vs IPOs)
- Verified exits count
- Most recent exit date

---

## ✅ Status

- ✅ **Database Schema:** Created (`supabase-startup-exits.sql`)
- ✅ **Exit Detection Script:** Created (`detect-startup-exits.js`)
- ✅ **Portfolio Performance Script:** Created (`update-investor-portfolio-performance.js`)
- ✅ **Automation Integration:** Added to automation-engine
- ⚠️ **Database Migration:** Needs to be run in Supabase

---

## 📝 Next Steps

1. **Run Database Migration:**
   ```sql
   -- In Supabase SQL Editor
   \i supabase-startup-exits.sql
   ```

2. **Add portfolio_performance column to investors table:**
   ```sql
   ALTER TABLE investors 
   ADD COLUMN IF NOT EXISTS portfolio_performance JSONB;
   ```

3. **Run Exit Detection:**
   ```bash
   node detect-startup-exits.js
   ```

4. **Update Portfolio Performance:**
   ```bash
   node update-investor-portfolio-performance.js
   ```

---

**Last Updated:** December 20, 2025  
**Status:** ✅ **READY** (needs database migration)





