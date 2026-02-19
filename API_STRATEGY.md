# 🔌 PYTH API STRATEGY
**GOD Score as a Service**

*Last Updated: February 17, 2026*

---

## 🎯 API VALUE PROPOSITION

**"Embed PYTH's GOD scoring into any platform"**

Target customers:
1. **Pitch Deck Tools** (Docsend, Slidebean) - "Your deck scores 67/100"
2. **VC CRMs** (Affinity, Harmonic) - Enrich deal flow automatically
3. **Accelerators** (YC, Techstars) - Screen applicants at scale
4. **Data Providers** (Crunchbase, PitchBook) - Add scoring layer
5. **Cap Table Tools** (Carta, Pulley) - Track startup quality over time

---

## 📋 API ENDPOINTS (v1.0)

### **1. Get GOD Score**
```http
GET /api/v1/score/:startup_id

Response:
{
  "startup_id": "abc123",
  "name": "Acme Robotics",
  "total_god_score": 67,
  "enhanced_god_score": 71,
  "scored_at": "2026-02-17T10:30:00Z",
  "components": {
    "team_score": 48,
    "traction_score": 65,
    "market_score": 72,
    "product_score": 88,
    "vision_score": 62
  },
  "signals": {
    "momentum_score": 2.8,
    "ap_bonus": 1.5,
    "elite_boost": 0,
    "spiky_hot_bonus": 1.2,
    "psychological_bonus": 0.8
  },
  "tier": "Bachelor",
  "percentile": 78,
  "confidence": 0.85
}
```

### **2. Real-Time Scoring**
```http
POST /api/v1/score/analyze

Request Body:
{
  "name": "New Startup Inc",
  "problem": "Solving X problem...",
  "solution": "Our product does Y...",
  "team": "Founded by ex-Google engineers...",
  "traction": {
    "revenue": 50000,
    "customers": 120,
    "growth_rate": 0.25
  },
  "funding": {
    "stage": "Seed",
    "amount_raised": 2000000,
    "investors": ["Sequoia", "a16z"]
  }
}

Response:
{
  "total_god_score": 72,
  "enhanced_god_score": 76,
  "breakdown": { ... },
  "recommendations": [
    "Strong product-market fit signals",
    "Consider adding technical co-founder",
    "Revenue trajectory is promising"
  ]
}
```

### **3. Investor Matching**
```http
GET /api/v1/matches/:investor_id?limit=20&min_score=60

Response:
{
  "investor_id": "inv456",
  "matches": [
    {
      "startup_id": "abc123",
      "name": "Acme Robotics",
      "god_score": 72,
      "match_score": 0.89,
      "reasons": [
        "Sector alignment: Robotics/AI",
        "Stage fit: Seed",
        "GOD score in target range (65-85)"
      ]
    }
  ],
  "total_results": 156
}
```

### **4. Leaderboards**
```http
GET /api/v1/leaderboard?sector=ai&stage=seed&limit=100

Response:
{
  "sector": "ai",
  "stage": "seed",
  "startups": [
    {
      "rank": 1,
      "startup_id": "xyz789",
      "name": "AI Startup Co",
      "god_score": 85,
      "key_strengths": ["product", "team"]
    }
  ],
  "metadata": {
    "total_in_category": 847,
    "average_score": 58,
    "top_10_percent_threshold": 72
  }
}
```

### **5. Score History**
```http
GET /api/v1/score/:startup_id/history?days=90

Response:
{
  "startup_id": "abc123",
  "name": "Acme Robotics",
  "history": [
    {
      "date": "2026-01-15",
      "god_score": 65,
      "reason": "Initial scoring"
    },
    {
      "date": "2026-02-10",
      "god_score": 72,
      "reason": "Revenue milestone reached"
    }
  ],
  "trend": "improving",
  "velocity": "+7 points in 30 days"
}
```

### **6. Bulk Scoring**
```http
POST /api/v1/score/batch

Request Body:
{
  "startups": [
    {"startup_id": "abc123"},
    {"startup_id": "def456"},
    {"startup_id": "ghi789"}
  ]
}

Response:
{
  "results": [
    {"startup_id": "abc123", "god_score": 67, "status": "success"},
    {"startup_id": "def456", "god_score": 73, "status": "success"},
    {"startup_id": "ghi789", "error": "Not found", "status": "error"}
  ],
  "summary": {
    "success": 2,
    "failed": 1
  }
}
```

---

## 🔐 AUTHENTICATION

### **API Key System**
```http
Headers:
Authorization: Bearer pyth_live_sk_abc123xyz...
```

**Key Types**:
- `pyth_test_*` - Sandbox environment (fake data)
- `pyth_live_*` - Production environment
- Rate limits apply per key

### **OAuth 2.0** (Enterprise)
For white-label integrations:
```http
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

---

## 💰 PRICING TIERS

### **Free Tier**
- 100 API calls/month
- Basic GOD score only
- 1 request/second rate limit
- Attribution required ("Powered by PYTH")

### **Pro Tier** ($299/month)
- 10,000 API calls/month
- Full component breakdown
- Signal layer details
- 10 requests/second
- Email support

### **Scale Tier** ($999/month)
- 100,000 API calls/month
- Webhooks (score changes)
- Historical data access
- 50 requests/second
- Slack support

### **Enterprise** (Custom)
- Unlimited API calls
- White-label option
- Custom scoring models
- Dedicated account manager
- SLA guarantees

---

## 📊 USAGE METRICS

Track and display in dashboard:
```javascript
{
  "period": "2026-02",
  "calls": {
    "total": 8432,
    "by_endpoint": {
      "/score/:id": 6200,
      "/score/analyze": 1800,
      "/matches/:id": 432
    }
  },
  "quota": 10000,
  "remaining": 1568,
  "top_scored_startups": [
    {"name": "Acme", "requests": 45},
    {"name": "Beta Inc", "requests": 38}
  ]
}
```

---

## 🔔 WEBHOOKS (Scale+ Tiers)

Subscribe to events:

### **Score Change**
```json
{
  "event": "score.updated",
  "startup_id": "abc123",
  "old_score": 65,
  "new_score": 72,
  "change": +7,
  "reason": "traction_milestone",
  "timestamp": "2026-02-17T10:30:00Z"
}
```

### **New Match**
```json
{
  "event": "match.created",
  "investor_id": "inv456",
  "startup_id": "abc123",
  "match_score": 0.89,
  "timestamp": "2026-02-17T10:30:00Z"
}
```

### **Threshold Alert**
```json
{
  "event": "score.threshold_crossed",
  "startup_id": "abc123",
  "threshold": 70,
  "new_score": 72,
  "direction": "up",
  "timestamp": "2026-02-17T10:30:00Z"
}
```

---

## 🛠️ SDK LIBRARIES

### **JavaScript/TypeScript**
```javascript
import { PythClient } from '@pyth/sdk';

const pyth = new PythClient('pyth_live_sk_...');

// Get score
const score = await pyth.scores.get('abc123');
console.log(score.total_god_score); // 67

// Analyze new startup
const analysis = await pyth.scores.analyze({
  name: 'New Startup',
  problem: '...',
  solution: '...'
});

// Get matches
const matches = await pyth.matches.get('inv456', {
  minScore: 60,
  limit: 20
});
```

### **Python**
```python
from pyth import PythClient

pyth = PythClient("pyth_live_sk_...")

# Get score
score = pyth.scores.get("abc123")
print(score.total_god_score)  # 67

# Batch scoring
results = pyth.scores.batch([
    {"startup_id": "abc123"},
    {"startup_id": "def456"}
])
```

### **Ruby**
```ruby
require 'pyth'

pyth = Pyth::Client.new('pyth_live_sk_...')

score = pyth.scores.get('abc123')
puts score.total_god_score  # 67
```

---

## 📖 DEVELOPER PORTAL

Build at: `developers.pythh.com`

### **Features**:
- [ ] Interactive API explorer (try endpoints live)
- [ ] Code examples (cURL, JS, Python, Ruby)
- [ ] Rate limit dashboard
- [ ] Usage analytics
- [ ] Webhook configuration
- [ ] API key management
- [ ] Changelog (version updates)
- [ ] Status page (uptime)

### **Documentation Sections**:
1. **Quickstart** (5-minute integration)
2. **Authentication** (API keys, OAuth)
3. **Endpoints** (full reference)
4. **Webhooks** (event types)
5. **SDKs** (language libraries)
6. **Rate Limits** (fair use policy)
7. **Errors** (error codes, troubleshooting)
8. **Changelog** (version history)

---

## 🎯 INTEGRATION PARTNERS

### **Phase 1 Targets** (3 months):

**1. Docsend** (Pitch Deck Analytics)
```javascript
// Embed PYTH score in pitch analytics dashboard
{
  "pitch_stats": {
    "views": 234,
    "avg_time": "3:45",
    "pyth_score": 67  // ← Our integration
  }
}
```

**2. Harmonic** (VC CRM)
```javascript
// Enrich deal flow automatically
{
  "startup": "Acme Robotics",
  "stage": "Seed",
  "pyth_god_score": 72,  // ← Auto-enriched
  "pyth_match_score": 0.89
}
```

**3. AngelList** (Fundraising Platform)
```javascript
// Display score on startup profile
{
  "startup_name": "Acme Robotics",
  "valuation": "$10M",
  "pyth_score": 72,  // ← Public badge
  "pyth_tier": "Bachelor"
}
```

**4. Stripe Atlas** (Company Formation)
```
// Score new companies automatically
When founder incorporates → PYTH analyzes → Provides score
```

**5. Notion** (Workspace)
```
// Database integration
/pyth score [startup_name]
→ Returns: GOD score + breakdown
```

---

## 🔄 INTEGRATION FLOW

### **Typical Integration** (30 minutes):

**Step 1**: Sign up at developers.pythh.com
**Step 2**: Get API key
**Step 3**: Install SDK (`npm install @pyth/sdk`)
**Step 4**: Make first call:
```javascript
const score = await pyth.scores.get('startup_id');
```

### **Advanced Integration** (2-4 hours):

**Step 1**: Configure webhooks
**Step 2**: Set up batch scoring
**Step 3**: Build custom UI with GOD scores
**Step 4**: Add caching layer (Redis)

---

## 📈 SUCCESS METRICS

### **Month 1**:
- [ ] 50 API signups
- [ ] 10 active integrations
- [ ] 100K API calls total

### **Month 3**:
- [ ] 200 API customers
- [ ] 3 major partnerships (Docsend, Harmonic, AngelList)
- [ ] 1M API calls total
- [ ] $5K MRR from API

### **Month 6**:
- [ ] 1,000 API customers
- [ ] 10 major partnerships
- [ ] 10M API calls total
- [ ] $50K MRR from API

---

## 🚀 IMPLEMENTATION CHECKLIST

### **Backend** (Week 1-2):
- [ ] Create API routes in Express (`/api/v1/*`)
- [ ] Add API key generation (UUIDs)
- [ ] Implement rate limiting (Redis)
- [ ] Add authentication middleware
- [ ] Create API response schemas
- [ ] Add error handling (standardized)
- [ ] Set up monitoring (Datadog/Sentry)

### **Documentation** (Week 2-3):
- [ ] Build developer portal site
- [ ] Write endpoint documentation
- [ ] Create code examples (3 languages)
- [ ] Record video tutorials
- [ ] Build interactive API explorer
- [ ] Add changelog system

### **SDKs** (Week 3-4):
- [ ] Build JavaScript SDK
- [ ] Build Python SDK
- [ ] Build Ruby SDK (optional)
- [ ] Publish to npm/PyPI/RubyGems
- [ ] Write SDK documentation
- [ ] Add unit tests

### **Launch** (Week 4):
- [ ] Beta test with 10 partners
- [ ] Fix bugs from beta
- [ ] Public launch announcement
- [ ] Product Hunt launch
- [ ] Partnerships outreach

---

## 🎨 API MARKETING

### **Launch Post** (Product Hunt):
```markdown
🚀 Introducing PYTH API - GOD Score as a Service

Embed AI-powered startup scoring into your platform:
• Get GOD scores (0-100) for 7,641+ startups
• Real-time analysis of new companies
• Investor matching API
• Webhooks for score changes

Built by the team behind the viral PYTH scoring platform.

Try it free: developers.pythh.com

Built with: Node.js, Express, Supabase, Redis
```

### **Twitter Thread**:
```
1/ 🔌 We just launched the PYTH API

Developers can now embed our GOD scoring into any app.

Here's what you can build in 30 minutes: 🧵

2/ Pitch Deck Scoring ⚡️
// 4 lines of code
const score = await pyth.scores.analyze({
  name: 'Startup',
  problem: '...',
  solution: '...'
});
// Returns: GOD score 0-100

[continue with examples...]
```

---

## 🤝 SAMPLE PARTNERSHIP PITCH

**Email Template for Integration Partners**:

```
Subject: Partnership: Add PYTH's AI Scoring to [Their Product]

Hi [Name],

I'm [Your Name] from PYTH — we built the AI that scores startups 0-100 
(like FICO for credit).

We've analyzed 7,641 startups and our "GOD Algorithm" is becoming the 
industry standard for startup quality scoring.

I think [Their Product] + PYTH would be powerful because:

• Your users could see PYTH scores right in their workflow
• It would differentiate [Their Product] from competitors
• Our API is free for partners (normally $299/month)

Integration takes ~2 hours. We provide:
✓ RESTful API (docs: developers.pythh.com)
✓ SDKs (JavaScript, Python)
✓ Co-marketing support

Would you be open to a 15-minute call to explore?

Best,
[Your Name]

P.S. We're about to announce on Product Hunt — would love to include 
[Their Product] in our launch partners list.
```

---

## 🎯 CALL TO ACTION

**Build the API v1.0 this week?**

Implementation order:
1. **Day 1-2**: Create basic endpoints (`GET /score/:id`)
2. **Day 3-4**: Add authentication + rate limiting
3. **Day 5**: Build developer portal landing page
4. **Day 6-7**: Write documentation + code examples

Then we can launch API alongside the main platform!

Want me to start building the API routes in Express? 🚀
