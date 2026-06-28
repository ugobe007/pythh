# RADAR Canonical Data Contract v1

> **Status:** LOCKED (January 30, 2026)  
> **Owner:** Phase 1 - Data Wiring  
> **Files:** `src/lib/radar-view-model.ts`, `src/components/pythh/LiveMatchTableV2.tsx`

## Core Principle (Non-Negotiable)

- **Radar rows are investor-relative**
- **Startup scores (GOD) are constant per page**
- **Nothing is recomputed in the UI. Ever.**
- If a value repeats incorrectly, the bug is **upstream**, not cosmetic

---

## Field Mapping

### 1. ENTITY Column

| Field | Type | Source |
|-------|------|--------|
| `name` | string | `investor.name` (unlocked) or `"Locked Investor"` |
| `context` | string \| null | Unlocked: investor thesis. Locked: FIT-derived text |

**Locked Context Rules:**
- High FIT (≥4) → "Top-tier alignment"
- Medium FIT (3) → "Strong market overlap"
- Low FIT (≤2) → "Relevant sector match"

### 2. SIGNAL Column (Movement)

| Field | Type | Source | Scale |
|-------|------|--------|-------|
| `value` | number | `match.signal_score` | 0.0 - 10.0, 1 decimal |
| `delta` | number \| null | `momentum_bucket` (temp) | Positive/negative |
| `direction` | enum | Derived from delta | 'up' \| 'down' \| 'flat' |

**Color Rules:**
- ≥7.5 → Cyan (window opening)
- ≥5.5 → Neutral
- ≥4.0 → Amber (cooling)
- <4.0 → Muted

**TODO:** Replace momentum_bucket with `investor_startup_signal.delta_7d`

### 3. GOD Column (Position)

| Field | Type | Source | Scale |
|-------|------|--------|-------|
| `god` | number | `startup_uploads.total_god_score` | 0-100 |

**CRITICAL RULES:**
- GOD is **STARTUP-LEVEL ONLY** - not per investor
- Injected once via `useStartupContext` → `context.god.total`
- Same value appears on **every row**
- If GOD=100 everywhere → **upstream bug** (see [diagnose-radar-data.ts](../scripts/diagnose-radar-data.ts))

**Known Bug Sources:**
- Default fallback = 100
- Percentile mapped as score
- MAX() aggregation leak
- Demo seed data bleeding in
- Join collapsing rows

### 4. YC++ Column (Perception)

| Field | Type | Source | Scale |
|-------|------|--------|-------|
| `ycPlusPlus` | number | Derived (temp) | 0-100 |

**Current Logic (Temporary):**
```
base = signal_score × 10
adjustment = fit_bucket adjustment (+12 high, +5 good, -8 early)
result = clamp(base + adjustment, 40, 95)
```

**Color Rules:**
- ≥80 → Green (excellent)
- ≥60 → Neutral
- <60 → Muted

**TODO:** Replace with `investor_perception_score.yc_plus_plus` when available

### 5. Δ Column (Surface Tension)

| Field | Type | Source |
|-------|------|--------|
| `delta` | number \| null | Same as signal delta (temp) |

**Display:**
- Positive → Green with "+"
- Negative → Red
- Null → "—"
- One decimal precision

**TODO:** Replace with `investor_startup_signal.composite_delta`

### 6. FIT Column (Intuitive Summary)

| Field | Type | Source |
|-------|------|--------|
| `tier` | 1-5 | Derived from `fit_bucket` |
| `bars` | 1-5 | Same as tier |

**Mapping:**
| fit_bucket | Tier | Bars |
|------------|------|------|
| high | 5 | █████ |
| good | 4 | ████░ |
| (default) | 3 | ███░░ |
| early | 2 | ██░░░ |

**Color Rules:**
- ≥4 bars → Green
- 3 bars → Neutral
- ≤2 bars → Muted

**TODO:** Replace with `investor_startup_fit.tier` when available

### 7. STATUS Column

| Value | Condition |
|-------|-----------|
| `LOCKED` | `is_locked === true` |
| `READY` | `is_locked === false` |
| `LIVE` | Reserved for future real-time indicator |

**Rule:** STATUS is **never cosmetic** - deterministic from unlock state

### 8. ACTION Column

| Value | Condition |
|-------|-----------|
| `Unlock` | Locked row |
| `View` | Unlocked row |

**Glow:** Only ACTION column glows orange when locked (never whole row)

---

## Glow System

| Condition | Row Glow | Action Glow |
|-----------|----------|-------------|
| High signal (≥7.5) | Cyan | - |
| High fit (≥4) + unlocked | Green | - |
| Locked | - | Orange |
| Default | None | None |

**Hover:** Same color family, increased intensity

---

## Validation Rules

The view model includes `validateRadarViewModel()` which checks:

1. **GOD ≠ 100** - If exactly 100, likely aggregation/fallback bug
2. **GOD consistency** - Same value across all rows
3. **Signal range** - Must be 0-10
4. **YC++ range** - Must be 0-100

Run validation in dev mode or via diagnostic script.

---

## Diagnostic Script

```bash
# Check all GOD scores
npx tsx scripts/diagnose-radar-data.ts

# Check specific startup
npx tsx scripts/diagnose-radar-data.ts <startup-uuid>
```

---

## Files

| File | Purpose |
|------|---------|
| [src/lib/radar-view-model.ts](../src/lib/radar-view-model.ts) | Canonical types + mapping functions |
| [src/hooks/useRadarViewModel.ts](../src/hooks/useRadarViewModel.ts) | Hook to build view model |
| [src/components/pythh/LiveMatchTableV2.tsx](../src/components/pythh/LiveMatchTableV2.tsx) | Pure render component (no computations) |
| [scripts/diagnose-radar-data.ts](../scripts/diagnose-radar-data.ts) | Data contract validation script |

---

## Migration Notes

### From Old LiveMatchTable

The original `LiveMatchTable.tsx` computed scores inline:
- `deriveInvestorSignal()` - Now in view model
- `deriveYCPlusScore()` - Now in view model  
- `deriveFitScore()` - Now in view model

The new `LiveMatchTableV2.tsx` receives pre-computed `RadarRowViewModel[]` and only renders.

### Legacy Adapter

During migration, use `useLegacyRadarAdapter()` to convert old `MatchRow[]` format to new view model format.

---

## Next Steps (Phase 2)

Once wiring is validated:

1. **Diagnose GOD=100** - Trace upstream to RPC or database issue
2. **Add investor_startup_signal table** - Real delta_7d values
3. **Add investor_perception_score table** - Real YC++ values
4. **Add investor_startup_fit table** - Real tier values
5. **Validate polling freshness** - Ensure live indicator is accurate

---

*Last Updated: January 30, 2026*
