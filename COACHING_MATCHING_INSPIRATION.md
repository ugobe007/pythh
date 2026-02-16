# Coaching Matching Service Inspiration (Exponent → Pythh)

## Overview
Analyzed [tryexponent.com/coaching](https://www.tryexponent.com/coaching) to learn how they match job seekers with career coaches. **Pythh could use similar UX patterns to match startups with advisors/coaches.**

---

## Exponent's Matching Model

### **What They Do:**
- Match **job candidates** → **career coaches** for:
  - Mock interviews (behavioral, technical, system design)
  - Resume reviews
  - Negotiation coaching
  - Career strategy sessions

### **Key Features:**

#### **1. Browse & Filter System**
```
Role: [Product Manager] [Software Engineer] [Data Scientist] ▼
Company: [Meta] [Google] [Amazon] ▼
Skill: [Product Design] [System Design] [Leadership] ▼
Industry: [FinTech] [Healthcare] [AI/ML] ▼
Service: 💬 Interviewing | 💼 Career | 💸 Negotiation | 📝 Resume
```

#### **2. Rich Coach Profiles**
- **Photo + Name** (builds trust)
- **Current Role + Company** (credibility)
  - e.g., "Senior Product Manager | Meta (ex-Google, Amazon)"
- **Rating + Sessions** (social proof)
  - e.g., "4.8 ⭐ (127 sessions)"
- **Years of Experience** (authority)
  - e.g., "15+ years in FAANG companies"
- **Skills Tags** (searchability)
  - AWS, System Design, Leadership, Go-to-Market, etc.
- **Availability** → "Book now" CTA

#### **3. Pricing Model**
- **5-Session Package** (discounted)
- **Buy first, match later**: "Buy sessions now and get matched with the right coach after purchase"
- **Schedule flexibility**: "Use at any time and schedule at your convenience"

#### **4. Quality Signals**
- Total reviews: "4.8 rating from over 2,400 reviews"
- Session count per coach (volume = trust)
- Company pedigree (ex-FAANG = premium)
- Specific expertise areas (ML, TPM, Recruiting, etc.)

---

## How This Translates to Pythh Advisory Matching

### **Instead of:**
- Job Candidates → Career Coaches

### **Pythh Does:**
- **Startups → Technical/Growth Advisors**

---

## Pythh Advisory Matching Features

### **1. Browse & Filter Directory**
```
Stage:      [Pre-Seed] [Seed] [Series A] [Series B+] ▼
Challenge:  [Product] [Fundraising] [Hiring] [GTM] [Operations] ▼
Industry:   [AI/ML] [FinTech] [HealthTech] [SaaS] [Hardware] ▼
Domain:     [Engineering] [Growth] [Sales] [Design] [Finance] ▼
```

### **2. Advisor Profiles (Similar to Coach Profiles)**
```
┌─────────────────────────────────────────────────────────┐
│ [Photo] John Smith                                      │
│ CTO & Co-Founder | Databricks (ex-Meta, Google)        │
│                                                         │
│ ⭐ 4.9 rating (23 advisory sessions)                    │
│ 🏢 15+ years scaling infrastructure at FAANG            │
│                                                         │
│ 💡 Specialties:                                         │
│ [System Design] [ML Infrastructure] [Team Building]    │
│ [Cloud Architecture] [Hiring Engineers]                │
│                                                         │
│ 🎯 Best for:                                            │
│ Series A-B startups scaling technical teams            │
│                                                         │
│ [Request Intro] 🔗                                      │
└─────────────────────────────────────────────────────────┘
```

### **3. Match Score Calculation**
Similar to Exponent's "get matched after purchase", pythh could calculate match scores based on:

**Startup Factors:**
- Current stage (seed, Series A, etc.)
- Challenges (product, fundraising, hiring, scaling)
- Industry/vertical (fintech, AI, healthcare)
- Team gaps (need CTO, need growth hacker)
- Technology stack (Python, React, AWS)

**Advisor Factors:**
- Functional expertise (engineering, growth, fundraising)
- Company pedigree (ex-unicorn CTO, VC partner)
- Stage experience (scaled seed → Series B)
- Industry knowledge (built fintech startups)
- Availability (hours/month, response time)

**Match Algorithm:**
```typescript
matchScore = (
  challengeFit × 40% +      // Startup needs = Advisor strengths
  stageFit × 25% +           // Advisor scaled similar stage
  industryFit × 20% +        // Domain expertise alignment
  availabilityFit × 10% +    // Timezone, hours/month
  reputationScore × 5%       // Session rating, reviews
)
```

### **4. Pricing/Session Model**
- **Advisory Package**: 5 hours ($X,XXX)
- **Buy package → Get matched** (like Exponent)
- **Schedule sessions flexibly** over 3-6 months
- **Track session outcomes** (KPIs improved, goals met)

### **5. Quality Signals to Display**
| Metric | Example |
|--------|---------|
| Rating | ⭐ 4.9 (23 sessions) |
| Exits | 2 exits (1 IPO, 1 acquisition) |
| Companies Built | Founded 3 startups, VP at 2 unicorns |
| Funds Raised | Helped advisees raise $50M+ total |
| Specialization | AI infrastructure, Series A scaling |
| Availability | 10 hrs/month, responds in 24h |

---

## Key UX Patterns to Borrow

### **From Exponent:**
1. ✅ **Browse-first, match-second** flow
   - Let startups explore profiles before commitment
2. ✅ **Rich profile pages** with social proof
   - Photos, bios, credentials, ratings, tags
3. ✅ **Session-based pricing** (not monthly retainers)
   - Lower commitment barrier
4. ✅ **Post-purchase matching optimization**
   - Algorithm suggests best fit after payment
5. ✅ **Search + Filter + Tags** for discovery
   - Searchable skills, companies, roles

### **Pythh Enhancements:**
1. 🚀 **Automated matching suggestions** on dashboard
   - "3 advisors match your fundraising challenge" alert
2. 🚀 **Session outcome tracking**
   - Rate sessions, log action items, track KPIs
3. 🚀 **Warm intros via network**
   - Show mutual connections to advisors
4. 🚀 **Advisor availability calendar**
   - Book sessions directly (like Calendly)
5. 🚀 **Challenge-specific matching**
   - "Need help with Series A deck?" → Show 5 advisors who've done this

---

## Database Schema (Advisory Matching)

```sql
-- Add to Supabase schema
CREATE TABLE advisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  current_role TEXT,
  current_company TEXT,
  bio TEXT,
  photo_url TEXT,
  linkedin_url TEXT,
  years_experience INT,
  
  -- Expertise
  specialties TEXT[], -- ['System Design', 'ML', 'Fundraising']
  industries TEXT[],  -- ['FinTech', 'AI', 'SaaS']
  stage_experience TEXT[], -- ['Seed', 'Series A', 'Series B']
  
  -- Availability
  hours_per_month INT,
  hourly_rate_usd INT,
  timezone TEXT,
  
  -- Reputation
  avg_rating DECIMAL(3,2),
  total_sessions INT,
  total_advisees INT,
  
  -- Outcomes
  exits INT, -- How many advisees had exits
  funds_raised_total BIGINT, -- Total $ raised by advisees
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE advisory_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID REFERENCES startup_uploads(id),
  advisor_id UUID REFERENCES advisors(id),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  status TEXT, -- 'scheduled', 'completed', 'cancelled'
  
  -- Session notes
  goals TEXT[],
  outcomes TEXT,
  action_items TEXT[],
  
  -- Feedback
  startup_rating INT, -- 1-5 stars
  startup_feedback TEXT,
  advisor_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE advisor_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID REFERENCES startup_uploads(id),
  advisor_id UUID REFERENCES advisors(id),
  match_score INT, -- 0-100 (pythh score style!)
  
  -- Score components
  challenge_fit_score INT,
  stage_fit_score INT,
  industry_fit_score INT,
  availability_score INT,
  reputation_score INT,
  
  -- Why matched
  match_reasons TEXT[], -- ['Strong fintech exp', 'Scaled Series A', 'Available 10h/mo']
  
  -- Status
  status TEXT, -- 'suggested', 'contacted', 'booked', 'completed'
  introduced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Roadmap

### **Phase 1: MVP Advisory Directory (2-3 weeks)**
- [ ] Build `advisors` table in Supabase
- [ ] Create advisor profile pages (similar to coach profiles)
- [ ] Add browse/filter UI for startups
- [ ] Manual matching: Admin suggests advisors to startups

### **Phase 2: Automated Matching (3-4 weeks)**
- [ ] Build `advisor_matches` table
- [ ] Implement match scoring algorithm
- [ ] Dashboard: Show "Top 5 Matches" for each startup
- [ ] Email notifications: "New advisor matches your challenge"

### **Phase 3: Session Booking & Tracking (2-3 weeks)**
- [ ] Build `advisory_sessions` table
- [ ] Integrate calendar booking (Calendly API or custom)
- [ ] Session feedback forms (rate sessions, log outcomes)
- [ ] Track KPIs: funds raised, hires made, product launches

### **Phase 4: Network Effects & Warm Intros (4-5 weeks)**
- [ ] Connect LinkedIn/Twitter for mutual connections
- [ ] Show "3 mutual connections" on advisor profiles
- [ ] Request warm intro flow (via mutual connection)
- [ ] Advisor referral rewards (get paid for successful matches)

---

## Competitive Advantage vs. Exponent

| Feature | Exponent (Coaching) | Pythh (Advisory) |
|---------|---------------------|------------------|
| **Target** | Job seekers | Startups |
| **Service** | Mock interviews, resume | Fundraising, product, growth |
| **Matching** | Manual browse + post-purchase | **AI-powered GOD score + automated suggestions** |
| **Outcome Tracking** | Job offers | **Funds raised, exits, KPIs** |
| **Network** | No warm intros | **Warm intros via VC/startup network** |
| **Pricing** | $500-1500 for 5 sessions | Premium ($2k-5k for expert advisors) |

---

## Marketing Angles

### **For Startups:**
- "Get matched with the advisor who's solved your exact challenge"
- "We've analyzed 10,000+ startup-advisor pairs to find your perfect fit"
- "Your personal board of advisors—on demand"

### **For Advisors:**
- "Help 10 startups per quarter, earn $X,000+"
- "Give back to the ecosystem on your schedule"
- "Only get matched with startups you can truly help"

---

## Next Steps

1. **User Research**: Interview 10-15 startups about advisory needs
   - What challenges need advisors? (fundraising, product, hiring)
   - What makes a good advisor match? (domain, stage, time commitment)
   - Pricing sensitivity? ($1k/session? $5k/month retainer?)

2. **Advisor Recruitment**: 
   - Reach out to 50 ex-founders, VPs at unicorns
   - Offer: "We'll send you pre-qualified startups that match your expertise"

3. **Prototype**: Build simple advisor directory this month
   - 10-20 advisor profiles manually added
   - Basic filter/search (stage, challenge, industry)
   - "Request intro" form → Manual matching

4. **Beta Test**: Match 5 startups with advisors
   - Track session outcomes
   - Measure satisfaction (NPS)
   - Validate pricing model

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Advisors onboarded | 100 |
| Startups using advisory | 50 |
| Sessions per month | 150 |
| Avg match score satisfaction | >4.5/5 |
| Successful outcomes (funds raised, hires, exits) | 20+ |
| Revenue from advisory services | $50k MRR |

---

## Conclusion

Exponent's coaching marketplace validates that **AI-powered matching + session-based advisory** works. Pythh can differentiate by:
1. **Automated GOD score matching** (not just manual browse)
2. **Outcome tracking** (funds raised, exits, KPIs)
3. **Warm intros via investor network**
4. **Startup-specific challenges** (fundraising, product, scaling)

This could be a **premium revenue stream** ($2-5k per startup package) while strengthening the investor matchmaking core product (advisors introduce startups to VCs they've worked with).
