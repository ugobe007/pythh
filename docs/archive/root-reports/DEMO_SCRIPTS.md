# DEMO SCRIPTS - Capital Intelligence Pitch
## 3 Loom Videos for Investor/Accelerator Outreach

**Purpose**: Show behavioral physics moat in 5-7 minutes per demo

---

## DEMO 1: Founder Magic Moment (6 minutes)
### Target: YC application, founder marketing, accelerator pitch

**Script**:

### Opening (30 sec)
"I'm going to show you something that's never existed before: real-time capital convergence detection."

*[Screen: Hot Honey homepage]*

"This is not a matchmaking tool. This is timing intelligence for fundraising."

---

### The Core Flow (3 min)

**Step 1: Paste URL** (20 sec)
*[Type in startup URL]*

"Paste any startup's website. We're going to use [Golden Startup Name] - a seed-stage AI company."

*[Submit, show 3-stage loading]*

"Notice: we don't say 'matching' or 'searching'. We say 'detecting convergence'."

---

**Step 2: Status Bar** (45 sec)
*[Point to status bar]*

"Look at this top bar. Every metric here is REAL behavioral data:

- **Velocity Class**: Fast Feedback - this startup is moving quickly
- **Signal Strength**: 7.6 out of 10 - strong market signal
- **FOMO State**: 🌡 Warming - investor interest building
- **Observers**: **23 investors** watched this startup in the last 7 days

That last one is the key. 23 investors have shown discovery behavior around this startup - before any outreach happened."

---

**Step 3: Investor Cards** (90 sec)
*[Scroll to visible investors]*

"Here are 5 investors where we detected convergence signals. But notice - these aren't just 'the top 5 matches'."

*[Click first investor card]*

"Look at the 'Why This Investor Appears' section:

- ✅ 'Viewed 3 similar startups in last 72h'
- ✅ 'Portfolio adjacency detected (72% overlap)'
- ✅ 'Acceleration in discovery behavior (+8 signals 24h)'

These are REAL behavioral events we observed. This investor has been actively browsing companies in this space."

*[Point to signal state badge]*

"This investor is in 'Surge' state - meaning their discovery activity accelerated in the last 24 hours. That's a timing signal."

---

**Step 4: Blurred Layer** (30 sec)
*[Scroll to hidden investors]*

"Below the 5 visible investors, we show there are 50 more investors with signals - but blurred until you unlock."

*[Point to count]*

"This creates two psychological moments:
1. **Validation**: 'I'm interesting to 55 investors'
2. **FOMO**: 'I need to see who they are'"

---

**Step 5: Comparable Startups** (45 sec)
*[Scroll to comparable section]*

"This is social proof calibration. We show similar startups at comparable stages with similar signals.

Notice each has:
- Their GOD score (market strength)
- Their FOMO state (momentum)
- How many investors matched them

This helps founders calibrate: 'People like me are succeeding.'"

---

### The Moat (90 sec)

*[Switch to whiteboard or diagram]*

"Here's why this is defensible:

**What everyone else builds:**
- 'You match investor criteria' → static score
- No timing intelligence
- No behavioral signals

**What we built:**
- Observer tracking → who's watching before they reach out
- FOMO acceleration → 24h/7d momentum detection
- Evidence-based convergence → concrete behavioral proof

**The compounding loop:**
More discovery events → Better timing signals → More founders use platform → More discovery events

This data can't be replicated. It's months or years of behavioral gravity."

---

### Closing (30 sec)
*[Back to founder view]*

"This isn't matchmaking. This is the first capital early warning system.

Founders don't need another CRM. They need to know:
- **Who's watching them**
- **When investor interest is accelerating**
- **Why specific investors are converging**

That's timing intelligence. That's Hot Honey."

---

## DEMO 2: Behavioral Physics Deep Dive (5 minutes)
### Target: Technical investors, data-focused VCs, platform engineers

**Script**:

### Opening (20 sec)
"I'm going to show you the data architecture underneath Hot Honey - why this is a category-defining intelligence platform, not a product feature."

*[Screen: Supabase dashboard or SQL editor]*

---

### The Observer Table (60 sec)

*[Show `investor_startup_observers` table]*

```sql
SELECT * FROM investor_startup_observers 
ORDER BY occurred_at DESC 
LIMIT 10;
```

"This is the most important table in the system. Every row represents a discovery event:

- `investor_id` + `startup_id` - who observed what
- `source` - how they discovered it (browse_similar, portfolio_overlap, search, news)
- `weight` - signal strength (partner_view = 2.0, news = 0.6)
- `occurred_at` - timestamp

Right now we're tracking 6 source types. We'll expand to 15+."

---

### FOMO Triggers (90 sec)

*[Show `investor_startup_fomo_triggers` view]*

```sql
SELECT 
  startup_id, 
  signal_24h, 
  signal_7d, 
  fomo_state 
FROM investor_startup_fomo_triggers 
WHERE fomo_state IN ('breakout', 'surge')
ORDER BY signal_24h DESC 
LIMIT 10;
```

"We classify investor interest into 4 states:

- 🚀 **Breakout**: 10+ signals in 24h, 60%+ acceleration
- 🔥 **Surge**: 5+ signals in 24h, 30%+ acceleration
- 🌡 **Warming**: 3+ signals in 7d
- 👀 **Watch**: Background signal

This is real behavioral physics. We're detecting phase changes in capital attention."

---

### Convergence Candidates (90 sec)

*[Show `convergence_candidates` view definition]*

"This view is the money query. It joins:
- Observer events (FOMO signals)
- Portfolio adjacency (similarity scores)
- Behavior summary (recent views)
- Startup intelligence (GOD scores)
- Match scores (precomputed)

One query gives us everything:
- Timing (signal_age_hours)
- Momentum (fomo_state)
- Fit (overlap_score)
- Behavior (recent_views)

We query this once, get 200 candidates, then smart-select the diverse 5."

---

### The Compounding Moat (60 sec)

*[Show event volume over time chart - can be mock]*

"Here's the strategic insight:

**Week 1**: 500 events → basic signals  
**Month 1**: 10,000 events → FOMO works  
**Month 6**: 100,000 events → timing predictions  
**Year 1**: 1M events → network effects  

Competitors starting today would need 6-12 months to replicate this behavioral dataset.

And every week that gap widens."

---

### Closing (30 sec)
"This isn't a matching algorithm. This is capital field dynamics.

We built:
- The first behavioral gravity system for investors
- Real-time FOMO detection
- A compounding intent dataset

That's defensible. That's the moat."

---

## DEMO 3: Category + Compounding Loop (4 minutes)
### Target: Accelerators, ecosystem partners, strategic investors

**Script**:

### Opening (20 sec)
"Most people think Hot Honey is 'LinkedIn for investors.' That's wrong.

We're building timing intelligence for capital formation - a category that doesn't exist yet."

*[Show diagram or whiteboard]*

---

### The Narrative (90 sec)

"Here's how founders raise capital today:

1. Send 100 cold emails
2. Get 5 meetings
3. Get 1 term sheet
4. Hope the timing was right

The problem: **No timing intelligence.**

Founders don't know:
- Which investors are watching them
- When investor interest is building
- Why specific VCs are converging

It's all guesswork.

---

**What we built:**

An early warning system that shows founders:
- **23 investors are watching you** (real observer count)
- **This investor is in 'surge' state** (acceleration detected)
- **They viewed 3 similar startups in 72h** (behavioral evidence)

That's not matching. That's timing intelligence."

---

### The Compounding Loop (90 sec)

*[Show flywheel diagram]*

```
Discovery Events → Observer Tracking → FOMO Detection
       ↓
Convergence Signals → Founders Use Platform
       ↓
More Discovery Events (REPEAT)
```

"This creates network effects:

**Phase 1**: We track public discovery signals (news, forums, searches)
**Phase 2**: Founders share with investors → more direct signals
**Phase 3**: Investors use our 'Observatory' view → full behavioral map

At scale, we become the Bloomberg Terminal for capital formation:
- **For founders**: Timing intelligence
- **For investors**: Market heatmaps (where capital is converging by sector)
- **For platforms**: Intelligence layer (YC, Techstars, etc.)

That's three products from one behavioral dataset."

---

### The Ask (60 sec)

"We're raising [$ amount] to:
1. Finish Day 2 (complete behavioral engine)
2. Onboard 100 seed-stage founders
3. Track 10,000+ discovery events/week
4. Build Investor Observatory

Within 6 months:
- 1,000 founders using timing intelligence
- 100,000 behavioral events tracked
- Defensible moat (behavioral data can't be replicated)

We're not building a feature. We're creating a category: **Timing Intelligence for Capital Formation.**

Who else wants to back the Bloomberg of fundraising?"

---

### Closing (20 sec)
"Questions I can answer:
- Technical architecture (how it works)
- Behavioral physics (why it's defensible)
- Go-to-market (how we scale)
- Unit economics (revenue model)

Let's talk."

---

## Recording Tips

### For All Demos:

1. **Screen Setup**:
   - Clean browser (no tabs/bookmarks visible)
   - Full screen app (hide taskbar)
   - Good lighting on face (if picture-in-picture)

2. **Audio**:
   - Use decent mic (not laptop)
   - Quiet room
   - Speak slowly, pause between sections

3. **Pacing**:
   - 30 seconds per major point
   - Pause after key insights
   - Don't rush - this is complex

4. **Visuals**:
   - Highlight cursor movements
   - Zoom in on key data
   - Use arrows/circles to emphasize

5. **Energy**:
   - Sound excited (but not manic)
   - Smile when appropriate
   - Convey confidence

---

## Sharing Strategy

### Demo 1 (Founder Magic)
**Where**: 
- YC application video section
- Founder-facing landing page
- Twitter/LinkedIn for founder marketing

**Thumbnail**: Screenshot of status bar showing "23 observers"

---

### Demo 2 (Technical Deep Dive)
**Where**:
- Technical investor 1-on-1s
- Engineering team recruiting
- Partnership discussions (APIs, integrations)

**Thumbnail**: Screenshot of `convergence_candidates` query

---

### Demo 3 (Category + Moat)
**Where**:
- Accelerator applications
- Investor pitch decks (embedded video)
- Strategic partnership intros

**Thumbnail**: Compounding loop diagram

---

## Follow-Up Assets

After recording demos, create:

1. **1-Pager PDF**:
   - "Timing Intelligence for Capital Formation"
   - 3 screenshots from demos
   - Moat diagram
   - Contact info

2. **Pitch Deck** (10 slides):
   - Problem (founders fundraise blind)
   - Solution (timing intelligence)
   - Demo (embed video)
   - Moat (behavioral data)
   - Traction (events tracked)
   - Team
   - Ask

3. **Email Template**:
   ```
   Subject: Timing Intelligence for Capital Formation [3min demo]
   
   Hi [Name],
   
   I built the first capital early warning system - real-time
   detection of investor convergence on startups.
   
   3-minute demo: [Loom link]
   
   Key insight: We track behavioral signals (who's watching
   which startups) and detect acceleration before anyone reaches out.
   
   This is defensible - behavioral data compounds.
   
   Would love 15 minutes to show you the technical architecture.
   
   [Your name]
   ```

---

**Status**: 📹 Demo scripts ready for recording

**Next**: Record all 3 demos → Share with 10 investors → Start conversations

