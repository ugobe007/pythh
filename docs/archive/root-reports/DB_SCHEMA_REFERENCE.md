# Pythh Database Schema Reference
## Generated: January 16, 2026

This document provides exact column names/types for implementing intelligence features.

---

## 1. startup_uploads (5,304 rows)
Primary startup data table.

### Core Identity
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Company name |
| `website` | text | Company URL |
| `canonical_key` | text | Normalized URL for deduplication |

### Narrative Fields (Dimension 1: Narrative Coherence)
| Column | Type | Description |
|--------|------|-------------|
| `tagline` | text | One-line pitch |
| `description` | text | Longer description |
| `pitch` | text | Pitch content |
| `extracted_data` | jsonb | Contains `one_liner`, `fivePoints[]`, etc. |

### Extracted Data JSONB Structure
```json
{
  "one_liner": "string",
  "fivePoints": ["problem", "solution", "market", "traction", "team"],
  "summary": "string",
  "revenue": "string",
  "team": "array",
  "signals": ["array"]
}
```

### Evidence Fields (Dimension 3: Conviction-Evidence Ratio)
| Column | Type | Description |
|--------|------|-------------|
| `has_revenue` | boolean | Revenue indicator |
| `has_customers` | boolean | Customer indicator |
| `is_launched` | boolean | Product launched |
| `mrr` | numeric | Monthly recurring revenue |
| `arr` | numeric | Annual recurring revenue |
| `growth_rate_monthly` | numeric | Monthly growth % |
| `team_size` | integer | Team headcount |
| `stage` | text | Funding stage |
| `customer_count` | integer | Customer count |
| `cac` | numeric | Customer acquisition cost |
| `ltv` | numeric | Lifetime value |
| `ltv_cac_ratio` | numeric | LTV/CAC ratio |
| `nrr` | numeric | Net revenue retention |

### GOD Scores (Truth Source: scripts/recalculate-scores.ts)
| Column | Type | Range | Description |
|--------|------|-------|-------------|
| `total_god_score` | numeric | 40-100 | Overall score (trigger prevents <40) |
| `team_score` | numeric | 0-100 | Team quality score |
| `traction_score` | numeric | 0-100 | Traction/revenue score |
| `market_score` | numeric | 0-100 | Market opportunity score |
| `product_score` | numeric | 0-100 | Product quality score |
| `vision_score` | numeric | 0-100 | Vision/narrative score |

### Additional Scores
| Column | Type | Description |
|--------|------|-------------|
| `grit_score` | numeric | Founder grit signals |
| `ecosystem_score` | numeric | Ecosystem fit |
| `pythia_score` | numeric | Legacy scoring |
| `smell_test_score` | numeric | Paul Graham smell test |
| `benchmark_score` | numeric | Industry benchmark |
| `social_score` | numeric | Social presence |
| `industry_god_score` | numeric | Industry-adjusted score |

### Timestamps (Dimension 2: Obsession Density)
| Column | Type | Description |
|--------|------|-------------|
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `reviewed_at` | timestamptz | Admin review time |

### Workflow
| Column | Type | Values |
|--------|------|--------|
| `status` | text | pending, approved, published |
| `submitted_by` | text | Submitter identifier |
| `submitted_email` | text | Submitter email |
| `admin_notes` | text | Review notes |

---

## 2. investors (3,181 rows)
Investor profiles and preferences.

### Core Identity
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Investor name |
| `firm` | text | Firm name |
| `type` | text | VC, Angel, etc. |
| `is_individual` | boolean | Individual vs firm |

### Investment Criteria
| Column | Type | Description |
|--------|------|-------------|
| `sectors` | text[] | Target sectors |
| `stage` | text | Target stages |
| `check_size_min` | numeric | Min check ($) |
| `check_size_max` | numeric | Max check ($) |
| `geography_focus` | text | Geographic focus |
| `investment_thesis` | text | Thesis statement |
| `firm_description_normalized` | text | Normalized firm description |
| `focus_areas` | text | Specific focus areas |

### Behavior Signals
| Column | Type | Description |
|--------|------|-------------|
| `avg_response_time_days` | integer | Average response time |
| `decision_speed` | text | Decision velocity |
| `leads_rounds` | boolean | Leads rounds |
| `follows_rounds` | boolean | Follows rounds |
| `typical_ownership_pct` | numeric | Target ownership % |
| `investment_pace_per_year` | integer | Annual deal volume |
| `last_investment_date` | date | Most recent investment |

### Portfolio
| Column | Type | Description |
|--------|------|-------------|
| `notable_investments` | text[] | Notable companies |
| `portfolio_companies` | text | Portfolio list |
| `total_investments` | integer | Total investment count |
| `successful_exits` | integer | Exit count |
| `portfolio_performance` | jsonb | Performance data |

### Scoring
| Column | Type | Description |
|--------|------|-------------|
| `investor_score` | numeric | Quality score |
| `investor_tier` | text | Tier ranking |
| `score_breakdown` | jsonb | Score components |
| `score_signals` | jsonb | Scoring signals |

### ML
| Column | Type | Description |
|--------|------|-------------|
| `embedding` | vector | OpenAI embedding |

---

## 3. startup_investor_matches (399,043 rows)
Precomputed matches between startups and investors.

### Core
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `startup_id` | uuid | FK to startup_uploads |
| `investor_id` | uuid | FK to investors |
| `match_score` | numeric | 0-100 match score |
| `confidence_level` | text | Confidence indicator |
| `algorithm_version` | text | Algorithm used |

### Match Analysis
| Column | Type | Description |
|--------|------|-------------|
| `reasoning` | text[] | Array of match reasons |
| `why_you_match` | text | Match explanation |
| `fit_analysis` | text | Detailed fit analysis |
| `similarity_score` | numeric | Semantic similarity |
| `success_score` | numeric | Predicted success |

### Workflow
| Column | Type | Values |
|--------|------|--------|
| `status` | text | suggested, saved, contacted |
| `viewed_at` | timestamptz | View time |
| `intro_requested_at` | timestamptz | Intro request time |
| `contacted_at` | timestamptz | Contact time |
| `feedback_received` | text | Feedback notes |

### Outreach (Generated)
| Column | Type | Description |
|--------|------|-------------|
| `intro_email_subject` | text | Email subject |
| `intro_email_body` | text | Email body |

---

## 4. startup_fomo_triggers (Velocity Signals)
Real-time momentum tracking.

| Column | Type | Description |
|--------|------|-------------|
| `startup_id` | uuid | FK to startup_uploads |
| `fomo_state` | text | warming, surge, breakout |
| `events_24h` | integer | Events in last 24h |
| `events_prev_24h` | integer | Events in prior 24h |
| `signal_24h` | numeric | Signal strength 24h |
| `signal_prev_24h` | numeric | Prior 24h signal |
| `events_7d` | integer | Events in 7 days |
| `signal_7d` | numeric | 7-day signal |
| `avg_signal_per_day_7d` | numeric | Avg daily signal |
| `fomo_ratio` | numeric | FOMO ratio |
| `signal_delta_24h` | numeric | 24h signal change |
| `elite_signal_24h` | numeric | Elite-tier signals |
| `strong_signal_24h` | numeric | Strong signals |
| `solid_signal_24h` | numeric | Solid signals |
| `emerging_signal_24h` | numeric | Emerging signals |
| `has_elite_confirmation` | boolean | Elite confirmed |

---

## 5. startup_fomo_rolling (Rolling Averages)

| Column | Type | Description |
|--------|------|-------------|
| `startup_id` | uuid | FK to startup_uploads |
| `events_24h` | integer | Events 24h |
| `events_prev_24h` | integer | Prior 24h events |
| `signal_24h` | numeric | 24h signal |
| `signal_prev_24h` | numeric | Prior 24h signal |
| `events_7d` | integer | 7-day events |
| `signal_7d` | numeric | 7-day signal |
| `avg_signal_per_day_7d` | numeric | Daily average |
| `fomo_ratio` | numeric | FOMO ratio |
| `signal_delta_24h` | numeric | Signal delta |

---

## Key Relationships

```
startup_uploads (1) ──< (N) startup_investor_matches >── (1) investors
       │
       └──< (1) startup_fomo_triggers
       │
       └──< (1) startup_fomo_rolling
```

---

## Intelligence Query Templates

### Dimension 1: Narrative Coherence
```sql
SELECT
  id, name, website,
  COALESCE(tagline, '') AS tagline,
  COALESCE(description, '') AS description,
  COALESCE(extracted_data->>'one_liner', '') AS one_liner,
  COALESCE(extracted_data->'fivePoints'->>0, '') AS fivepoints_0,
  COALESCE(extracted_data->'fivePoints'->>1, '') AS fivepoints_1,
  COALESCE(extracted_data->'fivePoints'->>2, '') AS fivepoints_2
FROM startup_uploads
WHERE id = :startup_id;
```

### Dimension 2: Obsession Density
```sql
SELECT
  id, created_at, updated_at,
  (EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600)::INT AS hours_since_update
FROM startup_uploads
WHERE id = :startup_id;
```

### Dimension 3: Conviction-Evidence Ratio
```sql
SELECT
  id, has_revenue, has_customers, is_launched,
  mrr, arr, growth_rate_monthly, team_size, stage,
  total_god_score, team_score, traction_score,
  market_score, product_score, vision_score
FROM startup_uploads
WHERE id = :startup_id;
```

### Dimension 4: Fragility Index (from match reasoning)
```sql
SELECT investor_id, match_score, reasoning
FROM startup_investor_matches
WHERE startup_id = :startup_id
  AND status = 'suggested'
ORDER BY match_score DESC
LIMIT 50;
```

### Dimension 5: Trajectory Momentum
```sql
SELECT
  startup_id, fomo_state,
  events_24h, signal_24h,
  events_7d, signal_7d,
  signal_delta_24h, fomo_ratio
FROM startup_fomo_triggers
WHERE startup_id = :startup_id
ORDER BY created_at DESC
LIMIT 1;
```

### Investor Receptivity
```sql
SELECT
  id, name, firm, type,
  sectors, stage,
  check_size_min, check_size_max,
  geography_focus, notable_investments,
  investment_thesis, firm_description_normalized
FROM investors
WHERE id = :investor_id;
```

### Alignment Differential (Pair Query)
```sql
SELECT match_score, confidence_level, reasoning
FROM startup_investor_matches
WHERE startup_id = :startup_id
  AND investor_id = :investor_id
  AND status = 'suggested'
LIMIT 1;
```

---

## Table Counts (as of schema capture)

| Table | Count |
|-------|-------|
| startup_uploads | 5,304 |
| investors | 3,181 |
| startup_investor_matches | 399,043 |
