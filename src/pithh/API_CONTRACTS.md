# Pythh API Contracts

## Overview

Three core endpoints for the founder UI:
1. `get_live_match_table` → `/app/matches`
2. `get_investor_reveal` → `/app/investors/:id`
3. `get_startup_context` → `/app/startup`

Plus one action:
4. `perform_unlock` → Unlock button

Plus realtime:
5. `match_row_changes` table subscription

---

## 1. GET /app/matches

**RPC:** `get_live_match_table(startup_id, limit_unlocked=5, limit_locked=50)`

**Returns:** Array of `MatchRow`

```typescript
{
  rank: number,              // 1-indexed absolute position
  investor_id: string,       // UUID
  investor_name: string|null,// "Name · Firm" if unlocked, null if locked
  fit_bucket: "early"|"good"|"high",
  momentum_bucket: "cooling"|"neutral"|"emerging"|"strong"|"cold",
  signal_score: number,      // 0.0 - 10.0, 1 decimal
  why_summary: string,       // "AI infra + hiring surge"
  is_locked: boolean,
  actions_allowed: ["view"|"unlock"]
}[]
```

**UI Mapping:**
| Field | Column | Display |
|-------|--------|---------|
| rank | Rank | `1`, `2`, `3`... |
| investor_name | Investor | Name or `───────────────` |
| fit_bucket | Fit | `Early`, `Good`, `High` |
| momentum_bucket | Momentum | `▲ Strong`, `■ Neutral`, `▼ Cooling` |
| signal_score | Signals | `8.4` (gray text) |
| why_summary | (below row) | `Why: AI infra + hiring surge` |
| actions_allowed | Action | `View` or `Unlock` button |

---

## 2. GET /app/investors/:id

**RPC:** `get_investor_reveal(startup_id, investor_id)`

**Returns:** `InvestorReveal`

If **NOT unlocked:**
```json
{
  "unlock_required": true,
  "investor_id": "uuid"
}
```

If **unlocked:**
```json
{
  "unlock_required": false,
  "investor": {
    "id": "uuid",
    "name": "Sarah Chen",
    "firm": "Sequoia Capital",
    "title": "Partner",
    "email": "sarah@sequoia.com",
    "linkedin_url": "...",
    "twitter_url": "...",
    "photo_url": "...",
    "stage": ["seed", "series-a"],
    "sectors": ["ai", "infrastructure"],
    "geography_focus": ["us", "europe"],
    "check_size_min": 500000,
    "check_size_max": 5000000,
    "investment_thesis": "...",
    "bio": "...",
    "notable_investments": [...],
    "portfolio_companies": [...]
  },
  "match": {
    "score": 78.5,
    "reasoning": "Strong sector alignment...",
    "confidence": "high",
    "fit_analysis": {...}
  },
  "fit": {
    "bucket": "high",
    "score": 0.85
  }
}
```

---

## 3. GET /app/startup

**RPC:** `get_startup_context(startup_id)`

**Returns:** `StartupContext`

```json
{
  "god": {
    "total": 78.5,
    "team": 18.5,
    "traction": 15.2,
    "market": 14.1,
    "product": 12.0,
    "vision": 11.7
  },
  "signals": {
    "total": 6.5,
    "founder_language_shift": 1.2,
    "investor_receptivity": 1.8,
    "news_momentum": 0.9,
    "capital_convergence": 1.5,
    "execution_velocity": 1.1
  },
  "comparison": {
    "industry_avg": 62.1,
    "top_quartile": 74.0,
    "percentile": 78,
    "sectors": ["ai", "infrastructure"]
  },
  "entitlements": {
    "plan": "free",
    "daily_unlock_limit": 3,
    "unlocks_used_today": 1,
    "unlocks_remaining": 2
  }
}
```

---

## 4. POST Unlock

**RPC:** `perform_unlock(startup_id, investor_id, source='free_daily')`

**Returns:** `UnlockResponse`

**Success:**
```json
{
  "success": true,
  "unlocks_remaining": 2
}
```

**Already unlocked:**
```json
{
  "success": false,
  "error": "already_unlocked"
}
```

**Daily limit reached:**
```json
{
  "success": false,
  "error": "daily_limit_reached",
  "unlocks_remaining": 0,
  "resets_at": "2026-01-31T00:00:00Z"
}
```

---

## 5. Realtime Subscription

**Table:** `match_row_changes`
**Filter:** `startup_id=eq.{startupId}`

**Payload:**
```json
{
  "startup_id": "uuid",
  "investor_id": "uuid",
  "changed_fields": ["momentum", "rank"],
  "previous_bucket": "neutral",
  "new_bucket": "strong",
  "previous_rank": 5,
  "new_rank": 3,
  "rank_delta": 2,
  "changed_at": "2026-01-30T10:30:00Z"
}
```

**Frontend reaction rule:**
```typescript
// Only react if meaningful
if (payload.new_bucket !== payload.previous_bucket || payload.rank_delta !== 0) {
  // Apply 2px left-edge glow, fade over 800ms
  // Re-fetch row or update in place
}
// Ignore everything else
```

---

## UI Behavior Summary

| Event | Visual | Duration |
|-------|--------|----------|
| Row update | 2px left-edge glow | 800ms fade |
| Rank change | Instant reorder | No animation |
| Unlock | Row slides open | 200ms |
| Page load | No spinner | Table appears immediately |

**Copy:**
- Header: `Live · updates as signals move`
- Locked row: `Identity locked`
- Unlock tooltip: `Reveals investor identity and outreach context.`
- Daily limit: `Pythh throttles outreach to protect deliverability and signal quality.`

---

## Signal Weights Reference

| Dimension | Weight | Max Points |
|-----------|--------|------------|
| founder_language_shift | 0.20 | 2.0 |
| investor_receptivity | 0.25 | 2.5 |
| news_momentum | 0.15 | 1.5 |
| capital_convergence | 0.20 | 2.0 |
| execution_velocity | 0.20 | 2.0 |
| **Total** | 1.00 | **10.0** |

---

## Tables Added

| Table | Purpose |
|-------|---------|
| `investor_unlocks` | Who unlocked what |
| `signal_events` | Raw market evidence (SSOT L1) |
| `startup_signal_scores` | Cached 0-10 scores (SSOT L2) |
| `startup_investor_fit` | Goldilocks cache |
| `startup_entitlements` | Plan/limits |
| `outreach_intents` | Anti-spray tracking |
| `unlock_ledger` | Unlock accounting |
| `match_row_changes` | Realtime events |
