# PYTHH CROSS-LINK MAP — ALLOWED MOTION ONLY

**Status:** LOCKED  
**Last reviewed:** January 31, 2026  
**Purpose:** Prevent "one more link" entropy. Only these transitions exist.

---

## Canonical Surfaces

```
/              Home (market exists)
/trends        Market scoreboard
/signals       Market meaning (relative to me)
/matches       Execution prioritization
/investor/:id  Timing justification
```

---

## Allowed Transitions (ONLY THESE)

### From `/trends`

| Action | Destination | Notes |
|--------|-------------|-------|
| Startup row click | `/signals` | If founder's own startup |
| Startup row click | `/app/startup/:id` | If logged in, viewing competitor |
| Score click | VC model explanation | Overlay or page, not inline |
| Lens click | Re-order only | **No navigation** |

🚫 **No direct jump to `/matches`**

---

### From `/signals`

| Action | Destination | Notes |
|--------|-------------|-------|
| "Compare against market" | `/trends` | Pre-filtered to sector |
| Investor name click | `/investor/:id` | Direct drill-down |
| Bottom CTA | `/matches` | Natural progression |

---

### From `/matches`

| Action | Destination | Notes |
|--------|-------------|-------|
| Investor row click | `/investor/:id` | Primary action |
| "Why now?" | `/signals` | Back to timing context |

---

### From `/investor/:id`

| Action | Destination | Notes |
|--------|-------------|-------|
| Back | `/matches` | Return to list |
| Reference | `/signals` | Timing context |

---

## Forbidden Transitions

| From | To | Why |
|------|----|----|
| Home | Matches | Skips understanding |
| Trends | Matches | Skips signals context |
| Investor | Outreach (v1) | Too early |
| Signals | Outreach (v1) | Too early |

**These shortcuts destroy discipline.**

---

## Visual Flow

```
                         ┌──────────┐
                         │   HOME   │
                         └────┬─────┘
                              │
                              ▼
                        ┌──────────┐
              ┌────────►│  TRENDS  │◄────────┐
              │         └────┬─────┘         │
              │              │               │
              │   (startup)  │  (compare)    │
              │              ▼               │
              │         ┌──────────┐         │
              │         │ SIGNALS  │─────────┘
              │         └────┬─────┘
              │              │
              │              ▼
              │         ┌──────────┐
              │         │ MATCHES  │
              │         └────┬─────┘
              │              │
              │              ▼
              │      ┌───────────────┐
              └──────│   INVESTOR    │
                     │   PROFILE     │
                     └───────────────┘
```

**Founders progress through understanding, not click around an app.**

---

## Why This Matters

If navigation feels optional, trust evaporates.

The constraint is the feature.

---

## Implementation Checklist

- [ ] Trends: Startup row → `/signals` (own) or `/app/startup/:id` (other)
- [ ] Trends: Score click → VC model overlay (future)
- [ ] Signals: "Compare against market" → `/trends?sector={sector}`
- [ ] Signals: Investor name → `/investor/:id`
- [ ] Matches: Row click → `/investor/:id`
- [ ] Matches: "Why now?" → `/signals?investor={id}`
- [ ] Investor: Back → `/matches`
- [ ] Investor: Reference → `/signals`
