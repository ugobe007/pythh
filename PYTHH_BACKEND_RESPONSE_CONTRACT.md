# PYTHH_BACKEND_RESPONSE_CONTRACT v1.0

**One response. One ritual. No drift.**

---

## Endpoint

```
GET /api/results?url={startup_url}
```
(or `POST /api/results` with `{ url }` — same payload)

---

## Response Shape (JSON)

```json
{
  "contract_version": "pythh_results_v1",
  "generated_at": "2026-01-21T00:00:00Z",

  "startup": {
    "name": "Rovi Health",
    "domain": "rovi.health",
    "url": "https://rovi.health"
  },

  "oracle_revelation": {
    "headline": "We found 5 investors that match your signals.",
    "subheadline": "50+ more are forming.",
    "top_matches_count": 5,
    "more_forming_count": 53
  },

  "top5": [
    {
      "rank": 1,
      "investor_id": "inv_123",
      "name": "US Seed Operator Fund",
      "signal_score": 72,
      "state": "warming",
      "why_line": "Portfolio adjacency + operator bias",
      "align_line": "Publish benchmark → flips infra recognition",
      "detail": {
        "why_bullets": [
          "Portfolio adjacency detected",
          "Operator pattern match",
          "Category momentum forming"
        ],
        "leverage_actions": [
          "Publish a single benchmark/case study",
          "Add one named pilot logo",
          "Tighten category positioning headline"
        ]
      }
    }
  ],

  "capital_meaning": {
    "signals_definition_line": "Signals are the measurement of capital — where it is now and where it is going.",
    "journey_line": "Fundraising isn't a moment. It's a journey. We show you who recognizes you now — and who will recognize you next."
  },

  "temporal_magic": {
    "warming_count": 17,
    "newly_aligned_count": 6,
    "cooled_off_count": 3,
    "blurred_aligned_preview": [
      {
        "rank": 6,
        "blur_label": "[blurred]",
        "signal_score": 64,
        "why_partial": "Market adjacency forming"
      }
    ]
  },

  "signal_mirror": {
    "orientation_statements": [
      "You're being read as infrastructure, not application.",
      "Your proof is inferred, not explicit.",
      "Your category is legible to operators, less legible to thesis funds."
    ],
    "synthesis_sentence": "This is why some investors are warming — and others are not yet."
  },

  "next_unlocks": {
    "actions": [
      {
        "action": "Publish one technical benchmark",
        "effect_line": "→ unlocks infra-thesis recognition",
        "why_it_moves_capital": "Triggers pattern match for infra funds"
      },
      {
        "action": "Add one named pilot",
        "effect_line": "→ converts inferred proof into explicit proof",
        "why_it_moves_capital": "Flips 'belief' from assumed to confirmed"
      },
      {
        "action": "Tighten narrative positioning",
        "effect_line": "→ flips generalist recognition",
        "why_it_moves_capital": "Reduces category ambiguity in fast scans"
      }
    ]
  },

  "desire_surface": {
    "more_aligned_count": 53,
    "warming_up_count": 17,
    "new_matches_this_week": 6,
    "blurred_more": [
      {
        "rank": 9,
        "blur_label": "[blurred]",
        "signal_score": 61,
        "why_partial": "Execution cadence improving"
      }
    ],
    "gate": {
      "label": "Unlock your full investor map",
      "requires_auth": true
    }
  },

  "misalignment": [
    {
      "investor_id": "inv_999",
      "name": "Late Stage Growth Capital",
      "fit_score": 28,
      "why_not_line": "Stage mismatch — proof is early, thesis expects scaling signal"
    }
  ],

  "diagnostics": {
    "available": true,
    "default_hidden": true,
    "toggle_label": "Why we matched you this way",
    "payload": {
      "convergence": {},
      "intent_velocity": {},
      "phase_change": {},
      "sources": []
    }
  },

  "ui_weights": {
    "top5_readout": 0.60,
    "signal_mirror": 0.15,
    "next_unlocks": 0.10,
    "desire_surface": 0.10,
    "misalignment": 0.05,
    "diagnostics": 0.00
  }
}
```

---

## Required Invariants (Non-Negotiable)

### A) No waiting / no "be patient" states

Backend **must always return something fast**:

- If full scan isn't ready, return **staged results** (cached / partial) that still populate:
  - `oracle_revelation`
  - `top5` (even if provisional)
  - `temporal_magic` counts (estimated allowed)
  - `signal_mirror` (inferred allowed)
  - `next_unlocks` (inferred allowed)

**Never return a payload that forces the UI into "loading screen first."**

---

### B) Top 5 is always present (Moment 1–2)

- `top5.length` must be **exactly 5**
- Each `top5` item must include:
  - `name`
  - `signal_score` (0–100 integer)
  - `state` in `{ "cold", "adjacent", "forming", "warming", "aligned" }`
  - `why_line` (<= 80 chars, causal)
  - `align_line` (<= 90 chars, lever)

**If any of these are missing, the experience dies.**

---

### C) "Magic numbers" are always available (Moment 4/5)

These must **always exist**:
- `temporal_magic.warming_count`
- `temporal_magic.newly_aligned_count`
- `temporal_magic.cooled_off_count`
- `desire_surface.more_aligned_count`

**Even if estimated.**

This is what makes it feel alive.

---

### D) Signal mirror is identity, not judgment (Moment 5)

- **Exactly 3** `orientation_statements`
- Must be **neutral, observational** (no "too early")
- Must **avoid shame language**

---

### E) Next unlocks are levers (Moment 6)

- **Exactly 3** `actions`
- Each must include:
  - `action`
  - `effect_line`
  - `why_it_moves_capital` (causal)

---

### F) Diagnostics never contaminates the surface

- `diagnostics.default_hidden` must be `true`
- All diagnostics must be **behind toggle**
- UI must **ignore diagnostics** unless user opens it

---

## Error Handling Contract

If anything fails, response must still **preserve the ritual**:

```json
{
  "contract_version": "pythh_results_v1",
  "generated_at": "…",
  "startup": { "name": "Unknown", "domain": "rovi.health", "url": "…" },
  "oracle_revelation": {
    "headline": "We found 5 investors that match your signals.",
    "subheadline": "50+ more are forming.",
    "top_matches_count": 5,
    "more_forming_count": 50
  },
  "top5": [ ...fallback five... ],
  "capital_meaning": { ... },
  "temporal_magic": { ...estimated... },
  "signal_mirror": { ...inferred... },
  "next_unlocks": { ...generic levers... },
  "desire_surface": { ...blurred... },
  "misalignment": [],
  "diagnostics": { "available": false, "default_hidden": true, "toggle_label": "Why we matched you this way", "payload": null },
  "ui_weights": { ... }
}
```

**No "could not load results" dead end.**

---

## Why This Contract Prevents Dilution

1. **The backend must provide the six-moment arc data**
2. **The UI can only render what the ritual requires**
3. **Diagnostics cannot leak into the primary surface**
4. **Top5 + counts + mirror + unlocks can't be "optimized away"**

---

## State Vocabulary (FROZEN)

| State | Meaning |
|-------|---------|
| `cold` | Signal score < 40 |
| `adjacent` | Signal score 40–54 |
| `forming` | Signal score 55–64 |
| `warming` | Signal score 65–74 |
| `aligned` | Signal score 75+ |

---

## Field Length Constraints

| Field | Max Length | Purpose |
|-------|-----------|---------|
| `why_line` | 80 chars | Causal statement, must fit one line |
| `align_line` | 90 chars | Lever statement, must fit one line |
| `orientation_statements` | 120 chars each | Identity mirror, must be scannable |
| `why_it_moves_capital` | 100 chars | Causal link, must be direct |

---

## Data Freshness Requirements

| Field | Staleness Threshold | Fallback Behavior |
|-------|---------------------|-------------------|
| `top5` | Must be < 24h old | Return cached + warning flag |
| `temporal_magic` counts | Must be < 6h old | Return estimated counts |
| `signal_mirror` | Must be < 48h old | Return inferred statements |
| `next_unlocks` | Must be < 48h old | Return generic levers |

---

## Implementation Checklist

Backend must validate:

- [ ] Response always includes `contract_version: "pythh_results_v1"`
- [ ] `top5.length === 5` (always)
- [ ] Every `top5` item has `name`, `signal_score`, `state`, `why_line`, `align_line`
- [ ] `temporal_magic` has `warming_count`, `newly_aligned_count`, `cooled_off_count`
- [ ] `signal_mirror.orientation_statements.length === 3`
- [ ] `next_unlocks.actions.length === 3`
- [ ] Every `next_unlocks` action has `action`, `effect_line`, `why_it_moves_capital`
- [ ] `diagnostics.default_hidden === true`
- [ ] Error states still return valid ritual structure (no empty payloads)
- [ ] Response time < 2s (even if cached/partial)

---

## Related Contracts

- **PYTHH_CONSTITUTION.md** — Philosophy layer
- **PYTHH_DESTINY_ENGINE.md** — Addiction loop doctrine
- **PYTHH_FOUNDERS_OWNERSHIP_CONTRACT.md** — Emotional arc (6 moments)
- **PYTHH_ONSCREEN_SCRIPT.md** — Frontend execution script
- **PYTHH_RESULTS_SPATIAL_CONTRACT.md** — UI spatial layout
- **pythh.contract.ts** — TypeScript bindings (frontend)

---

**This contract is FROZEN. Any backend change that breaks the ritual structure is a category drift.**
