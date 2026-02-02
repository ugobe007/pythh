# Pythh Agent API v1

Private beta API for programmatic access to Pythh intelligence.

## Authentication

All authenticated endpoints require the `X-Pythh-Key` header:

```bash
curl -H "X-Pythh-Key: pk_live_xxxxx" https://api.pythh.ai/api/v1/market-slice
```

### Rate Limits

| Access Level | Limit |
|-------------|-------|
| Public (no key) | 30 req/min |
| API Key | 300 req/min |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Max requests per minute
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets

## Response Format

### Success

```json
{
  "ok": true,
  "generated_at": "2026-02-01T20:12:34Z",
  "summary": "Human-readable summary of the response.",
  "data": { ... }
}
```

### Error

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited|invalid_request|unauthorized|not_found|server_error",
    "message": "Human-readable error message"
  }
}
```

---

## Endpoints

### 1. Market Slice

Get top-ranked startups with optional filtering.

```
GET /api/v1/market-slice
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lens` | string | `god` | Scoring lens (god, yc, sequoia, a16z, greylock, foundersfund) |
| `window` | string | `24h` | Time window (24h, 48h, 7d) |
| `mode` | string | `all` | Filter mode (all, sector) |
| `sector` | string | - | Sector name (required if mode=sector) |
| `top` | number | 25 | Number of results (max 50, public max 25) |

**Response:**

```json
{
  "ok": true,
  "generated_at": "2026-02-01T20:12:34Z",
  "summary": "Top 50 in FinTech API under Sequoia (24h).",
  "data": {
    "lens_id": "sequoia",
    "window": "24h",
    "filters": { "mode": "sector", "sector": "FinTech API" },
    "top_n": 50,
    "rows": [
      {
        "rank": 1,
        "startup_name": "Acme AI",
        "score": 92.1,
        "rank_delta": 0,
        "timing_state": "warming",
        "velocity": "stable"
      }
    ]
  }
}
```

**Caching:** `max-age=60`

---

### 2. Movements Feed

Get recent activity and changes (Lifeform core).

```
GET /api/v1/movements
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `window` | string | `24h` | Time window (24h, 48h, 7d) |
| `limit` | number | 25 | Number of results (max 50) |

**Response:**

```json
{
  "ok": true,
  "generated_at": "2026-02-01T20:12:34Z",
  "summary": "14 shifts detected in the last 24h. Top: CarbonGrid updated.",
  "data": {
    "window": "24h",
    "count": 14,
    "items": [
      {
        "type": "startup_update",
        "label": "CarbonGrid updated (score: 85)",
        "timestamp": "2026-02-01T17:40:00Z",
        "recency": "2h ago",
        "entities": [
          { "entity_type": "startup", "name": "CarbonGrid", "id": "uuid" }
        ]
      }
    ]
  }
}
```

**Caching:** `max-age=30`

---

### 3. Startup Score Snapshot

Get detailed scoring breakdown for a specific startup.

```
GET /api/v1/startups/:startupId/score-snapshot
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lens` | string | `god` | Scoring lens |
| `window` | string | `24h` | Time window |

**Response:**

```json
{
  "ok": true,
  "generated_at": "2026-02-01T20:12:34Z",
  "summary": "Acme AI scores 84.1 under Sequoia (24h), rank #12, timing cooling. Drivers: Market 42%, Product 28%, Team 18%.",
  "data": {
    "startup_id": "uuid",
    "startup_name": "Acme AI",
    "lens_id": "sequoia",
    "window": "24h",
    "snapshot": {
      "score": 84.1,
      "rank": 12,
      "rank_delta": 0,
      "timing_state": "cooling",
      "top_drivers": [
        { "key": "market", "label": "Market", "pct": 42 },
        { "key": "product", "label": "Product", "pct": 28 },
        { "key": "team", "label": "Team", "pct": 18 }
      ],
      "breakdown": [
        { "factor": "market", "label": "Market signal strength", "contribution": 19.6 }
      ]
    },
    "evidence": [
      {
        "factor": "team",
        "items": [
          {
            "claim": "Strong team indicators detected",
            "source": "analysis",
            "confidence": "high",
            "timestamp": "2026-01-31T18:20:00Z",
            "recency": "1d ago",
            "visibility": "public"
          }
        ]
      }
    ]
  }
}
```

**Caching:** `max-age=120`

---

### 4. Investor Brief

Get behavioral intelligence for a specific investor.

```
GET /api/v1/investors/:investorId/brief
```

**Response:**

```json
{
  "ok": true,
  "generated_at": "2026-02-01T20:12:34Z",
  "summary": "Greylock is cooling in AI Infra; behavioral patterns under analysis.",
  "data": {
    "investor_id": "uuid",
    "investor_name": "Greylock",
    "focus": ["enterprise", "infra", "saas"],
    "stage": "seed_to_b",
    "observed_since": "2016-03",
    "timing_state": "cooling",
    "behavioral_pattern": [
      "Investment thesis description...",
      "Focus: enterprise, infrastructure"
    ],
    "recent_behavior": [
      { "text": "Active in AI Infra", "timestamp": "2026-01-30T10:00:00Z", "recency": "2d ago" }
    ],
    "signals_respond_to": [
      "Hiring acceleration",
      "Product velocity indicators",
      "Market category signals"
    ],
    "competitive_context": [],
    "redaction_level": "public"
  }
}
```

**Caching:** `max-age=300`

---

## Timing States

| State | Description |
|-------|-------------|
| `warming` | Active/increasing engagement (updated within 7 days) |
| `monitoring` | Moderate activity (7-30 days) |
| `cooling` | Decreasing activity (30-90 days) |
| `dormant` | Minimal recent activity (90+ days) |
| `stable` | Default state |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Invalid or missing API key |
| `rate_limited` | 429 | Rate limit exceeded |
| `not_found` | 404 | Resource not found |
| `invalid_request` | 400 | Bad request parameters |
| `server_error` | 500 | Internal server error |

---

## Examples

### Check top Climate Tech startups

```bash
curl -H "X-Pythh-Key: pk_live_xxx" \
  "https://api.pythh.ai/api/v1/market-slice?mode=sector&sector=Climate%20Tech&top=10"
```

### Get movements in the last 7 days

```bash
curl -H "X-Pythh-Key: pk_live_xxx" \
  "https://api.pythh.ai/api/v1/movements?window=7d&limit=20"
```

### Get startup score details

```bash
curl -H "X-Pythh-Key: pk_live_xxx" \
  "https://api.pythh.ai/api/v1/startups/uuid-here/score-snapshot?lens=yc"
```

---

*Last updated: February 1, 2026*
