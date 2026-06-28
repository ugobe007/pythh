# PYTHH — DB VIEW / PIPELINE OUTPUT CONTRACT v1.0

**From raw signals → destiny script (no leaks, no drift)**

This defines exactly which internal views feed which ritual moment, and forbids engineers from "optimizing" the wrong layer into the surface.

---

## PRINCIPLE 1 — ONE VIEW PER MOMENT

Each experiential moment maps to **exactly one** internal output view.

- No view can feed multiple moments.
- No moment can be fed by multiple views.

This enforces causal clarity.

---

## MOMENT → VIEW MAPPING

### MOMENT 1–2: ORACLE REVELATION + TOP 5
**(Power + Legitimacy)**

**View:** `public.startup_investor_matches_ranked`

**Purpose:** This is the canonical investor matching truth table.

**Schema:**
```sql
startup_id UUID
investor_id UUID
investor_name TEXT
signal_score INT
state TEXT -- { cold, adjacent, forming, warming, aligned }
why_line TEXT -- <= 80 chars
align_line TEXT -- <= 90 chars
rank INT -- 1..N
generated_at TIMESTAMP
```

**Rules:**
- **Exactly 5 rows with `rank <= 5` must always exist.**
- `why_line` and `align_line` must be **generated here, not in UI.**
- Ranking is **stable for 24h** unless a material signal changes.

**Feeds:**
- `top5[]`
- `oracle_revelation.top_matches_count`
- Investor rows in Moment 1–2

---

### MOMENT 3: CAPITAL MEANING
**(Curiosity)**

**View:** `public.startup_capital_posture`

**Purpose:** This defines the global narrative framing.

**Schema:**
```sql
startup_id UUID
signals_definition_line TEXT
journey_line TEXT
posture_label TEXT -- { forming, prime, cooling }
confidence_label TEXT -- { low, medium, high }
generated_at TIMESTAMP
```

**Rules:**
- These two lines are **static templates, not ML hallucinations.**
- Only `posture_label` + `confidence_label` are dynamic.

**Feeds:**
- `capital_meaning`
- Identity header posture / confidence

---

### MOMENT 4: TEMPORAL MAGIC
**(Wonderment)**

**View:** `public.startup_investor_momentum`

**Purpose:** This is the "alive" layer.

**Schema:**
```sql
startup_id UUID
warming_count INT
newly_aligned_count INT
cooled_off_count INT
generated_at TIMESTAMP
```

**View:** `public.startup_blurred_aligned_preview`

**Purpose:** Preview of future matches.

**Schema:**
```sql
startup_id UUID
rank INT
signal_score INT
why_partial TEXT
```

**Rules:**
- Counts can be **estimated.**
- Must **always return non-zero integers.**
- Preview list must return **at least 3 rows.**

**Feeds:**
- `temporal_magic`
- Blurred rows in Moment 4

---

### MOMENT 5: SIGNAL MIRROR
**(Ownership)**

**View:** `public.startup_signal_mirror`

**Purpose:** Identity orientation, not judgment.

**Schema:**
```sql
startup_id UUID
statement_1 TEXT
statement_2 TEXT
statement_3 TEXT
synthesis_sentence TEXT
generated_at TIMESTAMP
```

**Rules:**
- **Exactly 3 statements.**
- **Observational tone only.**
- **No readiness language.**
- **No shame language.**
- Must regenerate only when core signals materially shift.

**Feeds:**
- `signal_mirror`

---

### MOMENT 6: NEXT UNLOCKS
**(Agency)**

**View:** `public.startup_leverage_actions`

**Purpose:** The cause–effect engine.

**Schema:**
```sql
startup_id UUID
action TEXT
effect_line TEXT
why_it_moves_capital TEXT
priority_rank INT -- 1..3
generated_at TIMESTAMP
```

**Rules:**
- **Exactly 3 rows per startup.**
- Priority is **stable for 7 days** unless posture changes.
- Must be **causally linked to missing or weak signals.**

**Feeds:**
- `next_unlocks`

---

### MOMENT 7: SCALE + DESIRE
**(Addiction + Inevitability)**

**View:** `public.startup_desire_surface`

**Purpose:** Future inevitability layer.

**Schema:**
```sql
startup_id UUID
more_aligned_count INT
warming_up_count INT
new_matches_this_week INT
generated_at TIMESTAMP
```

**View:** `public.startup_blurred_more`

**Purpose:** Blurred future doors.

**Schema:**
```sql
startup_id UUID
rank INT
signal_score INT
why_partial TEXT
```

**Rules:**
- Must **always return non-zero counts.**
- Must **always return at least 5 blurred rows.**

**Feeds:**
- `desire_surface`

---

### MOMENT 8: MISALIGNMENT
**(Trust + Honesty)**

**View:** `public.startup_misaligned_investors`

**Purpose:** Symmetry layer.

**Schema:**
```sql
startup_id UUID
investor_id UUID
investor_name TEXT
fit_score INT
why_not_line TEXT
generated_at TIMESTAMP
```

**Rules:**
- Must return **3–10 rows.**
- Must **not use "too early" or "not ready".**

**Feeds:**
- `misalignment`

---

### MOMENT 9: DIAGNOSTICS
**(Hidden Engine Room)**

**View:** `public.startup_diagnostics`

**Purpose:** Full machinery.

**Schema:**
```sql
startup_id UUID
payload JSONB
generated_at TIMESTAMP
```

**Rules:**
- Must **never be queried unless toggle opened.**
- Must **never feed any other moment.**

**Feeds:**
- `diagnostics.payload`

---

## PRINCIPLE 2 — NO CROSS-FEEDING

### These are forbidden forever:

❌ Top5 pulling from diagnostics  
❌ Mirror pulling from analytics views  
❌ Unlocks generated in UI  
❌ Counts inferred in frontend  
❌ Blurred previews computed client-side  
❌ Marketing copy computed in backend  
❌ Readiness scores leaking into any view  

**Each moment has exactly one data source.**

---

## PRINCIPLE 3 — STAGED FALLBACKS (NO DEAD AIR)

If a view fails or is empty:

| Moment | Fallback Source |
|--------|----------------|
| Top5 | Cached `startup_investor_matches_ranked` |
| Capital Meaning | Static template |
| Temporal Magic | Rolling 7d estimates |
| Signal Mirror | Inferred heuristics |
| Next Unlocks | Generic causal levers |
| Desire Surface | Momentum estimates |
| Misalignment | Empty list (allowed) |

**UI must never see a null moment.**

---

## PRINCIPLE 4 — REGENERATION CADENCE

This prevents thrash and flicker.

| View | Regeneration Trigger |
|------|---------------------|
| `startup_investor_matches_ranked` | New signal ingestion OR 24h |
| `startup_capital_posture` | Posture shift OR 24h |
| `startup_investor_momentum` | Rolling window every 15 min |
| `startup_blurred_aligned_preview` | Momentum shift |
| `startup_signal_mirror` | Core signal shift |
| `startup_leverage_actions` | Missing signal change OR posture shift |
| `startup_desire_surface` | Momentum shift OR daily |
| `startup_misaligned_investors` | Ranking shift |
| `startup_diagnostics` | Every ingestion |

---

## PRINCIPLE 5 — THE DATA-LAYER TRUTH LOCK

**No view is allowed to return data that breaks the onscreen script.**

Meaning:
- Top5 **must always exist**
- Counts **must always exist**
- Mirror **must always exist**
- Unlocks **must always exist**
- Desire **must always exist**

**Even if inferred.**

---

## WHY THIS PREVENTS DILUTION

Now:
- The UI can only render **six moments.**
- The backend can only produce **six moments.**
- The DB can only feed **six moments.**
- Diagnostics is **structurally isolated.**
- Copy is **structurally enforced.**
- Addiction loop is **structurally enforced.**

**This machine cannot become a dashboard.**

---

## IMPLEMENTATION CHECKLIST

Database layer must enforce:

- [ ] All 9 views exist in `public` schema
- [ ] `startup_investor_matches_ranked` always returns exactly 5 rows for top matches
- [ ] `startup_capital_posture` uses static templates for definition/journey lines
- [ ] `startup_investor_momentum` never returns zero counts (use estimates if needed)
- [ ] `startup_signal_mirror` always returns exactly 3 statements
- [ ] `startup_leverage_actions` always returns exactly 3 rows per startup
- [ ] `startup_desire_surface` never returns zero counts
- [ ] `startup_blurred_more` returns at least 5 rows
- [ ] `startup_misaligned_investors` uses neutral "why_not" language (no shame)
- [ ] `startup_diagnostics` is never joined with other views
- [ ] All views include `generated_at` for staleness detection
- [ ] Regeneration triggers are implemented (no manual refresh needed)
- [ ] Fallback logic exists for all critical views
- [ ] No view cross-feeds another moment

---

## RELATED CONTRACTS

- **PYTHH_BACKEND_RESPONSE_CONTRACT.md** — API layer (Layer 6)
- **PYTHH_ONSCREEN_SCRIPT.md** — Frontend execution (Layer 3)
- **PYTHH_RESULTS_SPATIAL_CONTRACT.md** — UI spatial layout (Layer 4)
- **pythh.contract.ts** — TypeScript bindings (Layer 5)

---

**This is Layer 7 — the data truth layer. It is now FROZEN.**

Any database schema change that breaks the view → moment mapping is a category drift.
