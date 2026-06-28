# VC Card Data Mapping Issues

## 🔴 CRITICAL: Database Schema Mismatch

The `EnhancedInvestorCard.tsx` component was built expecting fields that **DON'T EXIST** in your actual database.

## ❌ Fields in Component (WRONG)
```typescript
type?: string
check_size?: string
geography?: string
portfolio_size?: number
aum?: string
fund_size?: string
exits?: number
unicorns?: number
partners?: string[]
```

## ✅ Actual Database Fields (CORRECT)
```typescript
firm?: string
title?: string
bio?: string
check_size_min?: number
check_size_max?: number
geography_focus?: string[]
total_investments?: number
successful_exits?: number
active_fund_size?: string
partners?: string | null
board_seats?: number
leads_rounds?: boolean
follows_rounds?: boolean
investment_thesis?: string
photo_url?: string
linkedin_url?: string
twitter_url?: string
```

## 🔧 CHANGES MADE

### 1. Border Thickness
- ✅ Changed from `border-2` to `border-4` (both compact and full card)

### 2. Fire Icon Removed
- ✅ Removed duplicate fire icon from full card view
- ✅ Kept single fire icon in compact card view

### 3. Interface Updated
- ✅ Updated `Investor` interface to match actual database schema

### 4. Helper Functions Updated
- ✅ `formatCheckSize()` now uses `check_size_min` and `check_size_max`
- ✅ Added `getInvestorType()` to derive type from firm name
- ✅ `getTypeBadgeColor()` simplified to always return cyan/blue

## 🚨 REMAINING WORK NEEDED

You need to update these sections in `EnhancedInvestorCard.tsx`:

### Update Type Badge (Line ~129, ~333)
```typescript
// CHANGE FROM:
{investor.type || 'Active'}

// CHANGE TO:
{getInvestorType()}
```

### Update Fund Details Section (Line ~188-220)
```typescript
// REPLACE fund_size, aum, exits, unicorns WITH:
{investor.active_fund_size && (...)}
{investor.total_investments && (...)}
{investor.successful_exits && (...)}
{investor.board_seats && (...)}
```

### Remove Partners Section, Add Investment Thesis
```typescript
// REMOVE Partners section (it's null in DB)
// ADD Investment Thesis section:
{investor.investment_thesis && (
  <div className="mb-4">
    <div className="flex items-center gap-2 mb-2">
      <Target className="w-4 h-4 text-cyan-400" />
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Investment Thesis</span>
    </div>
    <div className="text-white text-sm leading-relaxed">
      {investor.investment_thesis}
    </div>
  </div>
)}
```

### Update Geography Display (Line ~252)
```typescript
// CHANGE FROM:
{investor.geography}

// CHANGE TO:
{investor.geography_focus && investor.geography_focus.length > 0 && (
  <span>{investor.geography_focus.slice(0, 2).join(', ')}</span>
)}
```

### Update Portfolio Size Display (Line ~248)
```typescript
// CHANGE FROM:
{investor.portfolio_size} companies

// CHANGE TO:
{investor.total_investments} investments
```

### Update Full Card Key Metrics (Line ~355-365)
```typescript
// Portfolio metric should use:
{investor.total_investments || '—'}
```

## 📊 ACTUAL DATA IN DATABASE

Based on real query, investors have:
- ✅ `name`, `firm`, `bio`
- ✅ `stage[]`, `sectors[]`
- ✅ `check_size_min`, `check_size_max`
- ✅ `notable_investments[]`
- ✅ `total_investments`, `successful_exits`
- ✅ `investment_thesis`, `linkedin_url`, `twitter_url`
- ✅ `board_seats`, `leads_rounds`, `follows_rounds`
- ❌ NO: `type`, `tagline`, `aum`, `fund_size`, `partners[]`

## 🎯 RECOMMENDED SOLUTION

Create a data adapter in MatchingEngine.tsx to map database fields to component expectations:

```typescript
const mapInvestorForCard = (dbInvestor: any) => ({
  ...dbInvestor,
  // Map database fields to component props
  tagline: dbInvestor.bio,
  geography: dbInvestor.geography_focus?.[0],
  portfolio_size: dbInvestor.total_investments,
  exits: dbInvestor.successful_exits,
  // Add derived type
  type: dbInvestor.firm?.includes('Capital') ? 'VC' : 'Investor'
});
```

## 🔗 INTEGRATION GUIDE

The COPILOT_INTEGRATION_GUIDE.md you referenced is **OUTDATED**. It references fields that don't exist.

You need to update it to reference the actual database schema shown above.
