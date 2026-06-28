# 🎴 Investor Card UI Contract — TEMPO v3.2

**Version:** 1.0  
**Contract Date:** January 18, 2026  
**Backend Source:** `explain_goldilocks()` JSON output  
**Status:** Ready for Frontend Implementation

---

## The Conversion Secret

Traditional scoring: "Here's a number."  
Investor Card: "Here's a decision framework."

Every card must answer three questions:
1. **State** — Where is this startup right now?
2. **Why Now** — What got them here?
3. **What Would Change Our Mind** — What confirms or invalidates this thesis?

That third element is the conversion secret. It turns score into actionable intelligence.

---

## JSON Contract (Backend → Frontend)

### Field Mapping

| UI Element | JSON Path | Transform |
|------------|-----------|-----------|
| State Badge | `tempo.phase_state` | Capitalize, color-code |
| Tempo Class | `tempo.class` | Human label from `tempo.label` |
| Confidence | `stability.score` | Gauge 0-10, clamp to 2 decimals |
| Risk Flag | `amendments.polarity_gate.gate_active` | Show ⚠️ if `true` |
| Why Now | `thesis.bullets[]` | Join with bullet points |
| Archetype | `archetype` | Human-readable label |
| Silence Context | `tempo.silence_means` | Explanatory subtext |
| Fresh Signals | `dual_ledger.fresh_signals` | Count badge |

### "What Would Change Our Mind" Logic

| Archetype | Confirming Event | Invalidating Event |
|-----------|------------------|-------------------|
| `structural_lead` | "Next: Major partnership or revenue milestone" | "Watch for: Key hire departure or pivot" |
| `velocity_surge` | "Next: Sustained growth for 2+ months" | "Watch for: Growth stall or churn spike" |
| `market_tailwind` | "Next: Regulatory clarity or market expansion" | "Watch for: Regulatory reversal or competitor moat" |
| `credibility_crisis` | "Next: Independent validation or audit clearance" | "Watch for: Additional negative press or legal action" |
| `capital_trap` | "Next: Strategic pivot or profitable unit" | "Watch for: Another inside round or key departure" |
| `silent_execution` | "Next: Revenue announcement or customer logo" | "Watch for: Extended silence past 90 days" |

---

## 4 Canonical JSON Samples

### 1. MONITOR — Fast Feedback Tempo (Quibi-like)

```json
{
  "startup_id": "quibi-canonical",
  "as_of": "2020-11-01T00:00:00Z",
  
  "tempo": {
    "class": "fast_feedback",
    "label": "Fast Feedback",
    "phase_state": "monitor",
    "silence_days": 0,
    "silence_means": "Not applicable - active signal flow",
    "silence_assessment": "active",
    "silence_floor_active": false
  },
  
  "dual_ledger": {
    "velocity_score": -2.15,
    "structural_score": -1.80,
    "goldilocks_v2_score": -3.95,
    "fresh_signals": 5,
    "total_signals": 12,
    "expectation_violation": -3
  },
  
  "stability": {
    "score": 0,
    "flap_risk": 0,
    "demotion_threshold": 0.5,
    "promotion_threshold": 2.0,
    "stability_shock": 8.5
  },
  
  "archetype": "credibility_crisis",
  
  "thesis": {
    "signal": "TERMINAL SIGNAL",
    "bullets": [
      "monitor phase in Fast Feedback (crisis mode)",
      "credibility_crisis: Multiple negative proof signals, trust collapsed",
      "Polarity gate active: Cannot promote until recovery events",
      "Stability: 0 (maximum uncertainty)"
    ]
  },
  
  "negative_signals": {
    "proof_count": 3,
    "regulatory_count": 1,
    "max_severity": 5,
    "recent_negative_days": 7
  },
  
  "amendments": {
    "inv4_base_phase": "stall",
    "inv4_silence_floor": false,
    "sentiment_aware": true,
    "polarity_gate": {
      "phase": "monitor",
      "stability": 0,
      "gate_active": true,
      "gate_reason": "credibility_crisis ceiling enforced"
    }
  },
  
  "investor_card": {
    "state": "MONITOR",
    "state_color": "yellow",
    "confidence_gauge": 0,
    "risk_flag": true,
    "why_now": "Credibility crisis — multiple negative proof signals, trust collapsed. Polarity gate active.",
    "confirming_event": "Independent validation or audit clearance",
    "invalidating_event": "Additional negative press or legal action",
    "action_recommendation": "EXIT or AVOID"
  }
}
```

---

### 2. STRONG — Slow Cycle Tempo (SpaceX-like)

```json
{
  "startup_id": "spacex-canonical",
  "as_of": "2008-10-01T00:00:00Z",
  
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
      "Technical moat + repeat founder credibility",
      "Tempo alignment: Awaiting next milestone (Falcon 1 success)"
    ]
  },
  
  "negative_signals": {
    "proof_count": 0,
    "regulatory_count": 0,
    "max_severity": 0,
    "recent_negative_days": null
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
  },
  
  "investor_card": {
    "state": "STRONG",
    "state_color": "green",
    "confidence_gauge": 7.15,
    "risk_flag": false,
    "why_now": "Structural lead — strong fundamentals, technical moat, repeat founder. Awaiting Falcon 1 success.",
    "confirming_event": "Successful launch or major contract win",
    "invalidating_event": "Third consecutive launch failure or NASA contract loss",
    "action_recommendation": "ACCUMULATE on execution"
  }
}
```

---

### 3. BREAKOUT — Sprint-and-Rest Tempo (Consumer Growth)

```json
{
  "startup_id": "consumer-growth-canonical",
  "as_of": "2025-06-15T00:00:00Z",
  
  "tempo": {
    "class": "sprint_and_rest",
    "label": "Sprint and Rest",
    "phase_state": "breakout",
    "silence_days": 0,
    "silence_means": "Sprint active - high velocity expected",
    "silence_assessment": "active",
    "silence_floor_active": false
  },
  
  "dual_ledger": {
    "velocity_score": 4.82,
    "structural_score": 2.15,
    "goldilocks_v2_score": 6.97,
    "fresh_signals": 8,
    "total_signals": 15,
    "expectation_violation": 2
  },
  
  "stability": {
    "score": 8.50,
    "flap_risk": 0,
    "demotion_threshold": 1.85,
    "promotion_threshold": null,
    "stability_shock": 0
  },
  
  "archetype": "velocity_surge",
  
  "thesis": {
    "signal": "BREAKOUT SIGNAL",
    "bullets": [
      "breakout phase in Sprint and Rest (sprint active)",
      "velocity_surge: Rapid momentum building, 8 fresh signals",
      "Viral coefficient > 1.5, organic growth dominant",
      "Exceeded velocity expectations by 2 standard deviations"
    ]
  },
  
  "negative_signals": {
    "proof_count": 0,
    "regulatory_count": 0,
    "max_severity": 0,
    "recent_negative_days": null
  },
  
  "amendments": {
    "inv4_base_phase": "breakout",
    "inv4_silence_floor": false,
    "sentiment_aware": true,
    "polarity_gate": {
      "phase": "breakout",
      "stability": 8.50,
      "gate_active": false,
      "gate_reason": null
    }
  },
  
  "investor_card": {
    "state": "BREAKOUT",
    "state_color": "purple",
    "confidence_gauge": 8.50,
    "risk_flag": false,
    "why_now": "Velocity surge — 8 fresh signals, viral coefficient > 1.5, exceeded velocity expectations.",
    "confirming_event": "Sustained growth for 2+ consecutive months",
    "invalidating_event": "Growth stall, churn spike, or CAC inflation",
    "action_recommendation": "AGGRESSIVE ACCUMULATE"
  }
}
```

---

### 4. STALL — Regulated Long Tempo (Theranos-like Terminal)

```json
{
  "startup_id": "theranos-canonical",
  "as_of": "2016-01-01T00:00:00Z",
  
  "tempo": {
    "class": "regulated_long",
    "label": "Regulated Long Cycle",
    "phase_state": "stall",
    "silence_days": 0,
    "silence_means": "Not applicable - active negative signals",
    "silence_assessment": "active",
    "silence_floor_active": false
  },
  
  "dual_ledger": {
    "velocity_score": -4.20,
    "structural_score": -3.85,
    "goldilocks_v2_score": -8.05,
    "fresh_signals": 6,
    "total_signals": 18,
    "expectation_violation": -5
  },
  
  "stability": {
    "score": 0,
    "flap_risk": 0,
    "demotion_threshold": 0.25,
    "promotion_threshold": 3.0,
    "stability_shock": 12.0
  },
  
  "archetype": "credibility_crisis",
  
  "thesis": {
    "signal": "TERMINAL SIGNAL",
    "bullets": [
      "stall phase in Regulated Long Cycle (crisis mode)",
      "credibility_crisis: Regulatory investigation active, clinical claims invalidated",
      "Capital trap converted to terminal: No recovery path visible",
      "Stability: 0 (maximum uncertainty, no floor)"
    ]
  },
  
  "negative_signals": {
    "proof_count": 4,
    "regulatory_count": 3,
    "max_severity": 5,
    "recent_negative_days": 3
  },
  
  "amendments": {
    "inv4_base_phase": "stall",
    "inv4_silence_floor": false,
    "sentiment_aware": true,
    "polarity_gate": {
      "phase": "stall",
      "stability": 0,
      "gate_active": true,
      "gate_reason": "credibility_crisis ceiling enforced, terminal state"
    }
  },
  
  "investor_card": {
    "state": "STALL",
    "state_color": "red",
    "confidence_gauge": 0,
    "risk_flag": true,
    "why_now": "Credibility crisis — regulatory investigation active, clinical claims invalidated. Terminal state.",
    "confirming_event": "Independent audit clearance or regulatory settlement with path forward",
    "invalidating_event": "Criminal charges or complete technology invalidation",
    "action_recommendation": "EXIT IMMEDIATELY"
  }
}
```

---

## Stall Taxonomy (Visual Distinction)

| Stall Type | Visual Treatment | Investor Card Color |
|------------|------------------|---------------------|
| **STALL (benign)** | Yellow badge, caution icon | `#FFA500` (amber) |
| **STALL (terminal)** | Red badge, skull icon, polarity gate flag | `#DC3545` (danger red) |

### Distinguishing Logic:
```javascript
const isTerminalStall = (json) => {
  return json.tempo.phase_state === 'stall' && 
         json.amendments.polarity_gate.gate_active === true &&
         json.archetype === 'credibility_crisis';
};
```

---

## Investor Card Rendering Rules

### State Badge Colors
| State | Background | Text | Border |
|-------|------------|------|--------|
| MONITOR | `#FFF3CD` | `#856404` | `#FFEEBA` |
| STRONG | `#D4EDDA` | `#155724` | `#C3E6CB` |
| BREAKOUT | `#E2D5F8` | `#5A2D82` | `#D0B8E8` |
| STALL (benign) | `#FFF3CD` | `#856404` | `#FFEEBA` |
| STALL (terminal) | `#F8D7DA` | `#721C24` | `#F5C6CB` |

### Confidence Gauge
- Range: 0-10
- Visual: Horizontal progress bar or semi-circular gauge
- Color gradient: Red (0-3) → Yellow (3-6) → Green (6-10)
- Display: `{stability.score.toFixed(1)} / 10`

### Risk Flag
- Render: ⚠️ icon + "Polarity Gate Active" tooltip
- Condition: `amendments.polarity_gate.gate_active === true`
- Color: `#DC3545`

### "What Would Change Our Mind" Section
```jsx
<div className="decision-triggers">
  <div className="confirming">
    <span className="label">✓ Confirming:</span>
    <span className="event">{investor_card.confirming_event}</span>
  </div>
  <div className="invalidating">
    <span className="label">✗ Invalidating:</span>
    <span className="event">{investor_card.invalidating_event}</span>
  </div>
</div>
```

---

## Component Structure (React)

```tsx
interface InvestorCardProps {
  data: ExplainGoldilocksResponse;
}

const InvestorCard: React.FC<InvestorCardProps> = ({ data }) => {
  const { tempo, stability, archetype, thesis, amendments, investor_card } = data;
  
  return (
    <div className={`investor-card state-${tempo.phase_state}`}>
      {/* Header: State Badge + Tempo Class */}
      <header>
        <StateBadge state={tempo.phase_state} />
        <TempoLabel label={tempo.label} />
        {amendments.polarity_gate.gate_active && <RiskFlag />}
      </header>
      
      {/* Confidence Gauge */}
      <ConfidenceGauge score={stability.score} />
      
      {/* Why Now (Thesis) */}
      <section className="why-now">
        <h4>Why Now</h4>
        <ul>
          {thesis.bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      </section>
      
      {/* Decision Triggers */}
      <section className="decision-triggers">
        <h4>What Would Change Our Mind</h4>
        <div className="confirming">
          <CheckIcon /> {investor_card.confirming_event}
        </div>
        <div className="invalidating">
          <XIcon /> {investor_card.invalidating_event}
        </div>
      </section>
      
      {/* Action Recommendation */}
      <footer>
        <ActionBadge recommendation={investor_card.action_recommendation} />
      </footer>
    </div>
  );
};
```

---

## Backend Enhancement Required

Add `investor_card` computed field to `explain_goldilocks()`:

```sql
-- Add to explain_goldilocks() return object
investor_card := jsonb_build_object(
  'state', UPPER(phase_state),
  'state_color', CASE phase_state
    WHEN 'breakout' THEN 'purple'
    WHEN 'strong' THEN 'green'
    WHEN 'stall' THEN CASE WHEN polarity_gate_active THEN 'red' ELSE 'yellow' END
    ELSE 'yellow'
  END,
  'confidence_gauge', stability_score,
  'risk_flag', polarity_gate_active,
  'why_now', array_to_string(thesis_bullets, ' '),
  'confirming_event', get_confirming_event(archetype),
  'invalidating_event', get_invalidating_event(archetype),
  'action_recommendation', get_action_recommendation(phase_state, polarity_gate_active)
);
```

---

## Summary

This contract defines:
1. **4 canonical JSON samples** — One per tempo class
2. **Field mapping** — Backend JSON → Frontend UI
3. **Rendering rules** — Colors, badges, gauges
4. **Decision trigger logic** — Per-archetype confirming/invalidating events
5. **Component structure** — React reference implementation

**TEMPO v3.2 is frozen. This contract is ready for frontend implementation.**

---

*Contract Author: Hot Honey Engineering*  
*Last Updated: January 18, 2026*
