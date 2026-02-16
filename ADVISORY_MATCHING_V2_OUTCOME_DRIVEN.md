# Advisory Matching v2.0 - Outcome-Driven Model
*Based on tryexponent.com/coaching + Pythh's unique value prop*

## 🚀 Core Concept: **Advisors Who Deliver Transactional Value**

### Traditional Advisory Model ❌
- Give general advice
- "Let me know if you need help"
- No measurable outcomes
- Typical advisor: Ex-founder who occasionally takes calls

### **Pythh Advisory Model** ✅
- **Facilitate actual deals & partnerships**
- **Make warm introductions** to customers, investors, partners
- **Track measurable outcomes** (funds raised, revenue from intro'd customers, partnerships closed)
- **Example**: Advisor helped Mistral.ai:
  - Connect with Disney for animation AI partnership
  - Intro to Panasonic for next-gen product integration
  - Result: $50M rev pipeline + Series B funding unlock

---

## 💡 Why This Model Wins

### Problem with Current Advisory Platforms:
1. **Clarity.fm, GLG**: Pay-per-call, no outcome tracking
2. **OnDeck, South Park Commons**: Community access, no match algorithm
3. **Traditional advisors**: Informal, no accountability

### **Pythh's Differentiation:**
```
Advisor Value = (Expertise × Network Access × Incentive Alignment)

Network Access = Companies they can introduce you to:
  - Portfolio companies (if VC/angel)
  - Former employers (Nike, Disney, Panasonic, Tesla)
  - Board seats (enterprise customers, strategic partners)
  - Co-investors (warm intro to other VCs)

Incentive Alignment = Success-based compensation:
  - Equity stake (0.25-1.0% advisor shares)
  - Success fee (2-5% of intro'd revenue or funding)
  - Retainer + upside (base $5k/mo + success fee)
```

---

## 🎯 Advisory Matching Algorithm (Enhanced GOD Score)

### Startup Input Factors:
```typescript
interface StartupProfile {
  god_score: number;           // 0-100 (baseline quality)
  stage: 'pre-seed' | 'seed' | 'series_a' | 'series_b+';
  challenges: string[];        // ['fundraising', 'product', 'gtm', 'hiring']
  target_customers: string[];  // ['Fortune 500', 'SMBs', 'Consumers']
  technology_stack: string[];  // ['React', 'Python', 'AWS', 'ML']
  location: string;
  team_gaps: string[];         // ['need_cto', 'need_sales_leader']
}
```

### Advisor Profile:
```typescript
interface AdvisorProfile {
  id: UUID;
  name: string;
  current_role: string;        // "VP Product at Disney"
  company_pedigree: string[];  // ["Disney", "Pixar", "Meta"]
  exits: number;               // Successful exits (IPO, acquisition)
  
  // CRITICAL: Network Access
  can_introduce_to: {
    customers: string[];       // ["Disney", "Panasonic", "Nike"]
    investors: string[];       // ["Sequoia", "a16z", "Founders Fund"]
    partners: string[];        // ["AWS", "Salesforce", "Stripe"]
    talent: string[];          // ["Can recruit from FAANG"]
  };
  
  // Expertise
  domains: string[];           // ["AI/ML", "Growth", "Product"]
  stages_scaled: string[];     // ["seed → Series A", "Series A → B"]
  industries: string[];        // ["Entertainment", "Media", "Consumer"]
  
  // Track Record
  outcomes: {
    funds_raised_for_advisees: number;     // Total $ raised
    revenue_introd: number;                 // Revenue from intros
    partnerships_closed: number;            // Strategic deals
    exits_advisory_role: number;            // Advisee exits
  };
  
  // Availability
  hours_per_month: number;     // 5-20 hrs
  hourly_rate: number;         // $500-2000/hr
  equity_preference: boolean;  // Prefers equity over cash?
  avg_rating: number;          // 4.8/5.0
  total_sessions: number;      // Session count
}
```

### **Match Score Formula** (0-100):
```typescript
function calculateAdvisoryMatchScore(startup: StartupProfile, advisor: AdvisorProfile): number {
  // PRIORITY 1: Customer & Partnership Intros (50%)
  // Foundation building for investors - they need to see traction
  const networkScore = calculateNetworkFit(
    startup.target_customers,
    startup.target_partners,
    advisor.can_introduce_to.customers,
    advisor.can_introduce_to.partners
  );
  
  // PRIORITY 2: Investor Intros (20%)
  // After customer traction is demonstrated
  const investorScore = calculateInvestorFit(
    startup.stage,
    startup.fundraising_status,
    advisor.can_introduce_to.investors
  );
  
  // 3. Challenge-Expertise Fit (15%) - Do their skills match startup's needs?
  const expertiseScore = calculateExpertiseFit(
    startup.challenges,
    advisor.domains,
    advisor.stages_scaled
  );
  
  // 4. Industry Alignment (10%) - Same vertical experience?
  const industryScore = calculateIndustryFit(
    startup.sector,
    advisor.industries
  );
  
  // 5. Track Record (5%) - Proven outcomes for similar startups?
  const outcomeScore = calculateOutcomeScore(
    advisor.outcomes,
    startup.stage
  );
  
  return (
    networkScore * 0.50 +      // Customer/partner intros (PRIORITY 1)
    investorScore * 0.20 +     // Investor intros (PRIORITY 2)
    expertiseScore * 0.15 +
    industryScore * 0.10 +
    outcomeScore * 0.05
  );
}
```

### **Network Fit Calculation** (Customer & Partnership Focus):
```typescript
function calculateNetworkFit(
  startupCustomers: string[],
  startupPartners: string[],
  advisorCustomers: string[],
  advisorPartners: string[]
): number {
  let score = 0;
  
  // 🥇 GOLD: Can intro to target customer (60 pts)
  // "I need to sell to Disney" + Advisor worked at Disney = PERFECT MATCH
  const customerOverlap = startupCustomers.filter(t => 
    advisorCustomers.some(c => c.toLowerCase().includes(t.toLowerCase()))
  );
  if (customerOverlap.length > 0) {
    score += 60;
  }
  
  // 🥈 SILVER: Can intro to strategic partner (30 pts)
  // "I need AWS partnership" + Advisor is AWS alumni = GREAT MATCH
  const partnerOverlap = startupPartners.filter(t =>
    advisorPartners.some(p => p.toLowerCase().includes(t.toLowerCase()))
  );
  if (partnerOverlap.length > 0) {
    score += 30;
  }
  
  // 🥉 BRONZE: General network strength (10 pts)
  // Large rolodex even without specific overlap
  if (advisorCustomers.length + advisorPartners.length > 10) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

function calculateInvestorFit(
  startupStage: string,
  fundraisingStatus: string,
  advisorInvestors: string[]
): number {
  // Only valuable if startup is actively fundraising
  if (fundraisingStatus !== 'fundraising' && fundraisingStatus !== 'planning_raise') {
    return 0;
  }
  
  // PLATINUM: Can intro to tier-1 investor (100 pts)
  const tier1 = ['sequoia', 'a16z', 'founders fund', 'benchmark', 'accel'];
  if (advisorInvestors.some(inv => tier1.some(t1 => inv.toLowerCase().includes(t1)))) {
    return 100;
  }
  
  // GOLD: Can intro to any VC (70 pts)
  if (advisorInvestors.length > 0) {
    return 70;
  }
  
  return 0;
}
```

---

## 📊 Outcome Tracking System

### Session Outcomes Table:
```sql
CREATE TABLE advisory_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES advisory_sessions(id),
  startup_id UUID REFERENCES startup_uploads(id),
  advisor_id UUID REFERENCES advisors(id),
  
  -- What happened as a result of this advisory relationship?
  outcome_type TEXT NOT NULL, -- 'funding', 'customer_intro', 'partnership', 'hire', 'strategic_deal'
  
  -- Funding outcomes
  funds_raised_amount BIGINT,      -- Amount raised (if advisor helped)
  investor_name TEXT,               -- VC/angel introduced by advisor
  
  -- Customer/revenue outcomes
  customer_introduced TEXT,         -- Company name advisor intro'd
  revenue_generated BIGINT,         -- Revenue from that customer
  deal_size TEXT,                   -- "$500k ARR contract"
  
  -- Partnership outcomes
  partner_name TEXT,                -- Strategic partner
  partnership_value TEXT,           -- "$5M co-marketing deal"
  
  -- Hiring outcomes
  role_filled TEXT,                 -- "CTO", "Head of Sales"
  hired_from TEXT,                  -- "Ex-Meta engineer"
  
  -- Attribution
  advisor_contribution_desc TEXT,   -- "Made warm intro to Disney VP"
  success_fee_paid NUMERIC(10,2),   -- Success fee if applicable
  
  -- Verification
  verified BOOLEAN DEFAULT false,   -- Startup confirmed outcome
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example rows:
INSERT INTO advisory_outcomes VALUES
(
  uuid_generate_v4(),
  '...session-uuid...',
  '...mistral-startup-uuid...',
  '...advisor-uuid...',
  'customer_intro',
  NULL, -- no funding
  NULL,
  'Disney Animation Studios',          -- customer introduced
  50000000,                            -- $50M pipeline
  '$50M multi-year licensing deal',
  NULL, NULL, NULL, NULL,
  'Advisor (ex-Disney VP) made warm intro to CTO, led to pilot project that became $50M contract',
  2500000,  -- 5% success fee = $2.5M
  true, NOW(), NOW()
),
(
  uuid_generate_v4(),
  '...session-uuid...',
  '...mistral-startup-uuid...',
  '...advisor-uuid...',
  'funding',
  150000000,  -- $150M Series B
  'Sequoia Capital',
  NULL, NULL, NULL,  -- no customer intro
  'Sequoia Capital',
  NULL,
  NULL, NULL,
  'Advisor (Sequoia LP) made warm intro to partner, led to term sheet',
  0,  -- Equity-only advisor, no cash fee
  true, NOW(), NOW()
);
```

---

## 🏆 Advisor Leaderboard (Reputation System)

### Public Metrics (visible to startups):
```
Advisor: Sarah Chen
Current: VP Product, Disney
Former: Head of Growth @ Airbnb, PM @ Meta

💼 PROVEN OUTCOMES:
  • 12 advisees total
  • $450M funds raised for advisees
  • $120M revenue from customer intros
  • 8 partnerships closed (avg $15M value)
  • 3 advisee exits (2 acquisitions, 1 IPO)

🌟 TOP INTRODUCTIONS:
  • Disney Animation (led to $50M contract)
  • Panasonic (strategic partnership)
  • Sequoia Capital (3 successful funding intros)
  • Ex-Airbnb talent (hired 5 executives)

⭐ RATING: 4.9/5.0 (23 sessions)

📈 BEST FOR:
  • Series A startups in consumer/media/AI
  • Need Fortune 500 customer intros
  • Scaling product teams

💰 COMPENSATION:
  • 0.5% equity OR $10k/mo + 3% success fee
  • Typical engagement: 10 hrs/month, 6 months
```

---

## 💸 Pricing Models (YC-Inspired Flat Fee + Equity)

**CRITICAL INSIGHT**: VCs don't like percentage-based success fees (creates misaligned incentives). Instead, use **flat fee + equity kicker** like Y Combinator's early model.

### For Startups:
1. **Quarterly Retainer + Equity**:
   - **$5k/quarter + 0.25% equity** (3-month engagement)
   - Advisor provides: 10 hours/month, warm intros, strategic guidance
   - Outcome tracking: Measure intros made, deals facilitated
   
2. **Equity-Only** (for high-value advisors):
   - **0.5-1.0% advisor shares** vesting over 2 years
   - Best for: Ex-founders with exits, F500 VPs with golden rolodexes
   - Example: Disney VP who can intro to 10+ Fortune 500 customers
   
3. **Session Packages** (basic advisory):
   - **$2k for 5 hours** (no equity, one-time consulting)
   - Best for: Tactical advice without ongoing relationship

### Why Flat Fee + Equity Works:
✅ **Aligns incentives**: Advisor wants startup to succeed (equity upside)  
✅ **No VC friction**: VCs hate "someone taking 2-5% of our capital"  
✅ **YC-validated**: Same model that scaled 4,000+ companies  
✅ **Predictable costs**: Startups know exactly what they're paying

### Outcome Bonuses (Optional):
- **Customer intro bonus**: If advisor intro → $500k+ contract, startup pays $5k bonus
- **Funding milestone bonus**: If advisor intro → Series A close, startup pays $10k bonus
- **Partnership bonus**: If advisor intro → strategic deal, startup pays $5-10k bonus

**Note**: These are **gratitude bonuses**, not contractual success fees. Startups pay because they want to, not because they have to.

### For Advisors:
- **Pythh takes 15% platform fee** on cash comp only
- **No fee on equity** (advisor negotiates directly with startup)
- **Bonus split**: If startup pays outcome bonus, 80% advisor / 20% pythh

---

## 🔥 Key Features to Build

### Phase 1: MVP (4 weeks)
- [ ] Advisor profiles with network access fields
- [ ] Match score algorithm (network fit weighted 40%)
- [ ] "Top 5 Matches" on startup dashboard
- [ ] Request intro flow

### Phase 2: Outcome Tracking (3 weeks)
- [ ] `advisory_outcomes` table
- [ ] Session logging: "What did we accomplish today?"
- [ ] Outcome verification flow (startup confirms)
- [ ] Advisor leaderboard (sort by outcomes)

### Phase 3: Network Graph (4 weeks)
- [ ] LinkedIn integration: Extract network data
- [ ] "3 mutual connections" display
- [ ] Warm intro request path (ask mutual to intro)
- [ ] Investor network visualization

### Phase 4: Success Fee Automation (3 weeks)
- [ ] Track attribution: Which advisor made which intro?
- [ ] Revenue/funding verification hooks
- [ ] Automated success fee calculation
- [ ] Payment processing (Stripe Connect)

---

## 🎯 Go-to-Market Strategy

### Advisor Recruitment (Target: 100 advisors in 6 months):
**Who to recruit:**
- Ex-founders with exits (can intro to investors they know)
- VPs at F500 (Disney, Nike, Panasonic) → customer intros
- Active angels/VCs (intro to other investors)
- Recruiters (help with hiring)

**Pitch:**
> "Help 10 startups per year, earn $50-100k+ on your schedule. We match you with startups where you can **make actual intros** - not just give advice. Your value = your network."

### Startup Activation:
**Trigger points:**
- After startup gets GOD score → "3 advisors can help you fundraise"
- When adding challenge ("Need customers") → "2 advisors can intro you to Disney/Nike"
- Funding milestone → "Prep for Series A? 5 advisors have scaled seed→A"

---

## 📈 Success Metrics (6 months)

| Metric | Target |
|--------|--------|
| Advisors onboarded | 100 |
| Startups matched | 50 |
| Sessions completed | 300 |
| Funds raised (attributed) | $50M+ |
| Customer intros made | 200+ |
| Partnerships closed | 20+ |
| Success fees paid | $500k |
| Platform revenue | $100k MRR |

---

## 🚀 **Next Steps**

1. **THIS WEEK**: Build advisor profile schema + match algorithm
2. **NEXT WEEK**: Onboard 10 pilot advisors (ex-founders, VPs)
3. **WEEK 3**: Match 5 startups, run pilot sessions
4. **WEEK 4**: Launch advisory dashboard + outcome tracking

---

## 💭 Competitive Moats

| Platform | Advisory Model | Pythh Advantage |
|----------|----------------|-----------------|
| **Clarity** | Pay-per-call, no matching | No outcome tracking |
| **GLG** | Expert calls | No startup focus, expensive |
| **OnDeck** | Community | No match algorithm, no outcomes |
| **Traditional Advisory** | Ad-hoc | No accountability, hard to find |
| **Pythh** | **AI-matched advisors who facilitate deals** | **Track outcomes, network-first matching, GOD score integration** |

---

## 🎯 **The Pythh Promise**

> "We don't just connect you with advisors. We match you with people who can **introduce you to your next customer, investor, or partner** - and we track every outcome."

**Example Success Story (Future):**
> "Jane (Mistral.ai founder) matched with Mark (ex-Disney VP). Mark introduced Jane to Disney's CTO. Result: $50M licensing deal + Series B unlocked. Pythh earned $100k success fee (2%), Mark earned $2.4M (5%)."

---

## ✅ **Decisions Made (Feb 13, 2026)**

**Q1: Customer intros OR investor intros first?**  
✅ **CUSTOMER & PARTNERSHIP INTROS FIRST** (foundation building)
- Match algorithm: 50% customer/partner fit, 20% investor fit
- Rationale: Investors want to see traction before investing

**Q2: Equity compensation model - fair range?**  
✅ **0.25-1.0% ADVISOR SHARES** (YC-style model)
- Standard: $5k/quarter + 0.25% equity
- Premium: 0.5-1.0% equity only (for high-value advisors)

**Q3: Success fee model?**  
✅ **NO PERCENTAGE FEES** (VCs don't like them)
- Use flat fee + equity instead
- Optional gratitude bonuses ($5-10k) for major outcomes
- Rationale: Avoids VC friction, aligns incentives long-term

**Q4: Should advisors see startup GOD scores?**  
⏳ **TO BE DECIDED** (likely yes, helps advisors prioritize high-potential startups)

---

**Next Sprint Goals:**
1. ✅ Portfolio scraper deployment (YC running in background)
2. 📋 Build advisor profile database schema
3. 📋 Implement match scoring algorithm (customer-first)
4. 📋 Create advisor onboarding flow (10 pilot advisors)
5. 📋 Design outcome tracking dashboard
