# 🏛️ TEMPO v3.2 — COURT-PROVEN (FROZEN)

**Freeze Date:** January 18, 2026  
**Status:** Production-Ready, Constitutional Invariants Enforced

---

## Version History

| Version | Milestone | Key Features |
|---------|-----------|--------------|
| v2.0 | Foundation | Tempo classes, signal types, 40 tempo profiles |
| v2.1 | Stability | Stability score, tempo alignment, agent crossover |
| v3.0 | Constitution | 10 invariant laws codified |
| v3.1 | Court-Tested | INV4 silence floor, sentiment polarity, credibility_crisis |
| **v3.2** | **Polarity Gate** | Hardened silence floor, explicit polarity gate |

---

## What v3.2 Adds

### 1. Polarity Gate (`enforce_polarity_gate()`)

Constitutional lockdown for `credibility_crisis` archetype:

```sql
-- Any startup in credibility_crisis:
-- ✗ Cannot be STRONG or BREAKOUT (ceiling = MONITOR)
-- ✗ Cannot have stability > 0
-- ✗ Requires positive proof recovery events to exit (not time)
```

**Purpose:** Prevents any future edge case from resurrecting scandals via noise.

### 2. Hardened Silence Floor (`compute_silence_floor()`)

Silence floor now conditional on no recent negative evidence:

```sql
-- Floor applies ONLY when:
-- 1. tempo_class IN (slow_cycle, regulated_long)
-- 2. silence_assessment IN (expected, normal)
-- 3. NO negative events in last 90 days
```

**Purpose:** Floor can't be exploited, won't "break" on benign events.

---

## Canonical Test Cases (Court-Validated)

| Case | Tempo Class | Expected Pattern | Final State |
|------|-------------|------------------|-------------|
| Quibi | fast_feedback | fast failure | MONITOR (polarity gate ceiling) |
| SpaceX | slow_cycle | breakthrough | STRONG (structural_lead) |
| Theranos | regulated_long | capital trap → crisis | MONITOR (polarity gate ceiling) |

### Key Validations

1. **Quibi (Nov 2020):** `credibility_crisis` → polarity gate active → stability=0, ceiling=MONITOR
2. **SpaceX (Oct 2008):** No crisis → polarity gate inactive → STRONG with stability=7.15
3. **Theranos (Jan 2016):** `credibility_crisis` → polarity gate active → stability=0, ceiling=MONITOR

---

## Database Functions (v3.2)

### Core Functions

| Function | Purpose |
|----------|---------|
| `explain_goldilocks_testcase(uuid, timestamptz)` | Full TEMPO evaluation for historical test cases |
| `enforce_polarity_gate(archetype, phase, stability, has_negative)` | Constitutional crisis lockdown |
| `compute_silence_floor(tempo_class, silence, phase, has_negative, window)` | Hardened INV4 floor |
| `replay_startup_timeline(slug, start, end, step)` | Historical replay engine |

### Supporting Infrastructure

| Table | Purpose |
|-------|---------|
| `historical_test_cases` | Canonical test case definitions |
| `historical_test_events` | Event streams with sentiment/severity |
| `historical_replay_results` | Checkpoint evaluations |
| `tempo_classes` | 4 tempo class definitions |
| `tempo_profiles` | 40 tempo×signal combinations |
| `signal_types` | 10 signal type definitions |

---

## Invariant Charter (v3.0)

All 10 invariants enforced:

| INV | Law | Status |
|-----|-----|--------|
| INV1 | Goldilocks can be negative | ✅ |
| INV2 | Phase from score ranges only | ✅ |
| INV3 | Stability can be zero | ✅ |
| INV4 | Silence interpreted by tempo | ✅ (hardened floor) |
| INV5 | Archetype from evidence pattern | ✅ |
| INV6 | Structural persists | ✅ |
| INV7 | Fresh signals within 60 days | ✅ |
| INV8 | Calibration under 3 signals | ✅ |
| INV9 | Signal breakdown matches total | ✅ |
| INV10 | Amendments visible | ✅ |

---

## JSON Contract (Investor Card Ready)

### Sample Output Structure

```json
{
  "test_case_name": "SpaceX (2002-2008)",
  "as_of": "2008-10-01T00:00:00+00:00",
  
  "tempo": {
    "class": "slow_cycle",
    "label": "Slow Cycle",
    "phase_state": "strong",
    "silence_days": 3,
    "silence_means": "Expected - silence is incubation",
    "silence_assessment": "active",
    "silence_floor_active": false
  },
  
  "dual_ledger": {
    "velocity_score": 1.328,
    "structural_score": 1.537,
    "goldilocks_v2_score": 2.87,
    "fresh_signals": 3,
    "total_signals": 9,
    "expectation_violation": 0
  },
  
  "stability": {
    "score": 7.15,
    "flap_risk": 0,
    "demotion_threshold": 1.22,
    "promotion_threshold": 0.64,
    "stability_shock": 0
  },
  
  "archetype": "structural_lead",
  
  "thesis": {
    "signal": "STRONG SIGNAL",
    "bullets": [
      "strong phase in Slow Cycle (active)",
      "structural_lead: Strong fundamentals driving score",
      "Tempo alignment: awaiting more data"
    ]
  },
  
  "negative_signals": {
    "proof_count": 0,
    "regulatory_count": 0,
    "max_severity": 0
  },
  
  "amendments": {
    "inv4_base_phase": "strong",
    "inv4_silence_floor": false,
    "sentiment_aware": true,
    "polarity_gate": {
      "phase": "strong",
      "stability": 7.15,
      "gate_active": false,
      "gate_reason": null
    }
  }
}
```

---

## What Changed in v3.2

### Before (v3.1)
- Silence floor applied when `silence_assessment IN (expected, normal)`
- Any new event could "break" the floor

### After (v3.2)
- Silence floor conditional on **no negative evidence in 90 days**
- Explicit polarity gate prevents crisis startups from gaming to STRONG
- Floor reason explicitly logged in `amendments.inv4_floor_detail`

---

## Migration Path

If upgrading from v3.1:

```sql
-- Functions auto-upgrade via CREATE OR REPLACE
-- New helper functions added:
-- - enforce_polarity_gate()
-- - compute_silence_floor()
-- No schema changes required
```

---

## Stall Taxonomy (Court-Derived)

| Stall Type | Characteristics | Investor Action |
|------------|-----------------|-----------------|
| **STALL (benign)** | Low velocity, acceptable silence, some structure | Watch for signal recovery |
| **STALL (terminal)** | `credibility_crisis`, stability=0, negative proof | Exit or avoid |

---

## Next: Investor Card MVP

The JSON contract above is ready for frontend rendering. Key fields for Investor Card:

### Required Display
| Field | Source | Render As |
|-------|--------|-----------|
| State | `tempo.phase_state` | Badge (MONITOR/STRONG/BREAKOUT/STALL) |
| Why Now | `thesis.bullets[0]` + `archetype` | Narrative copy |
| Confidence | `stability.score` | Gauge (0-10) |
| Risk | `amendments.polarity_gate.gate_active` | ⚠️ if true |

### "What Would Change Our Mind"
| Signal | Condition | Display |
|--------|-----------|---------|
| Confirming | Based on archetype | "Next: [expected signal type]" |
| Invalidating | Based on negative_signals | "Watch for: [risk signal type]" |

---

*TEMPO v3.2 is frozen. Any changes require constitutional amendment process.*
