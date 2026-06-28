# Capital Navigation Page Layout (Degraded Mode)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: Logo | New scan | Refresh | Notifications                   │
│ "Investor Signals Matching Your Startup"                            │
│ Scanning: automax.ai                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ [Convergence] [Signals]  ← Tabs                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️  Matching: Degraded                    code: match_query_failed │
│                                                                      │
│ Intent traces collected. Investor identity resolution is delayed.   │
│                                                                      │
│ Try again in ~60s.           [Retry resolution]                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ CAPITAL NAVIGATION                 [Confidence: MEDIUM] [Latest     │
│ Automax                             intent trace: 4 hours ago] ←pulse
│ automax.ai                                                          │
│                                                                      │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│ │ YOUR POSITION    │ │ CAPITAL FLOW (NOW)│ │ CAPITAL TRAJECTORY│  │
│ │            [Why?]│ │             [Why?]│ │            [Why?]│   │
│ │                  │ │                   │ │                  │   │
│ │ Position:        │ │ Flow:             │ │ Direction:       │   │
│ │ Emerging         │ │ Forming           │ │ Stable           │   │
│ │                  │ │                   │ │                  │   │
│ │ Observers (7d):  │ │ Active investors: │ │ Alignment: 52%   │   │
│ │ 0                │ │ — / —             │ │ ("Do I belong?") │   │
│ │                  │ │                   │ │                  │   │
│ │ ▓▓▓▓▓░░░░░ 42%   │ │ ▓▓▓▓░░░░░░ 38%    │ │    ╭─────╮      │   │
│ │                  │ │                   │ │   ╱   34  ╲     │   │
│ │ Where you are    │ │ What is happening │ │  │ Trajectory│   │   │
│ │ standing on ice  │ │ around you now    │ │   ╲       ╱     │   │
│ │                  │ │                   │ │    ╰─────╯      │   │
│ │                  │ │                   │ │ Where the puck   │   │
│ │                  │ │                   │ │ is going         │   │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ SCAN PLAYBACK                                           [2/4]       │
│ Scanning automax.ai                                                 │
│ Signals represent intent. Clusters reveal where capital is going.   │
│                                                                      │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
│ │ NORMALIZE │ │ INFER     │ │ COLLECT   │ │ RESOLVE           │  │
│ │ URL     ✓ │ │ PROFILE ✓ │ │ INTENT  ✓ │ │ IDENTITIES      ! │  │
│ │           │ │           │ │ TRACES    │ │                   │  │
│ │ Canonical │ │ Sector,   │ │ Signals + │ │ Matching engine   │  │
│ │ domain +  │ │ stage,    │ │ adjacency │ │ delayed (degraded)│  │
│ │ redirects │ │ velocity  │ │ candidates│ │                   │  │
│ └───────────┘ └───────────┘ └───────────┘ └───────────────────┘  │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ ACTIVITY                                                        │ │
│ │ • Detected adjacency candidates (3)                            │ │
│ │ • Computed phase-change readiness: 0.42 (Emerging)             │ │
│ │ • Signal quality: 0.52 (Medium confidence)                     │ │
│ │ • Latest intent trace: 4 hours ago                             │ │
│ │ • Identity resolution queue delayed — retry available          │ │
│ └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐ ┌───────────────────────────────┐
│ INTENT TRACE DENSITY    Last 7d │ │ ALIGNMENT BREAKDOWN  Align:52%│
│                                  │ │                                │
│ Capital flow in detectable      │ │ Signals = intent. Alignment =  │
│ patterns. Fresh traces = active │ │ do you belong in this movement?│
│ discovery.                       │ │                                │
│                                  │ │ Team Alignment         0.52    │
│   ▓                             │ │ ▓▓▓▓▓▓░░░░               52%   │
│   ▓ ▓   ▓                       │ │ Hiring + founder profile       │
│   ▓ ▓ ▓ ▓ ▓                     │ │ partially matches...           │
│ ─────────────                   │ │                                │
│ Mon Tue Wed Thu Fri Sat Sun     │ │ Market Alignment       0.48    │
│                                  │ │ ▓▓▓▓▓░░░░░               48%   │
│                                  │ │ Category is adjacent but       │
│                                  │ │ not yet in dense flow...       │
│                                  │ │                                │
│                                  │ │ Execution Alignment    0.50    │
│                                  │ │ ▓▓▓▓▓░░░░░               50%   │
│                                  │ │                                │
│                                  │ │ Portfolio Adjacency    0.56    │
│                                  │ │ ▓▓▓▓▓▓░░░░               56%   │
│                                  │ │                                │
│                                  │ │ Phase-Change Ready     0.42    │
│                                  │ │ ▓▓▓▓░░░░░░               42%   │
│                                  │ │                                │
│                                  │ │ ┌─────────────────────────┐   │
│                                  │ │ │ NEXT BEST MOVE          │   │
│                                  │ │ │                         │   │
│                                  │ │ │ Publish technical proof │   │
│                                  │ │ │ (benchmarks, case       │   │
│                                  │ │ │ studies) to deepen      │   │
│                                  │ │ │ alignment with incoming │   │
│                                  │ │ │ capital.                │   │
│                                  │ │ │                         │   │
│                                  │ │ │ Reposition to move      │   │
│                                  │ │ │ deeper into path of     │   │
│                                  │ │ │ capital.                │   │
│                                  │ │ └─────────────────────────┘   │
└─────────────────────────────────┘ └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ CAPITAL IS MOVING — IDENTITIES ARE RESOLVING                       │
│                                                 +184 more detected   │
│ While identity resolution is delayed, here's the convergence        │
│ profile forming around you.              [Unlock Full Signal Map]   │
│                                                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│ │US Seed│ │EU    │ │Enterp│ │Indust│ │Strate│                      │
│ │Operat│ │Infra │ │SaaS  │ │Robot │ │Corp  │                      │
│ │Fund  │ │Spec  │ │Seed  │ │      │ │      │                      │
│ │      │ │      │ │      │ │      │ │      │                      │
│ │  72  │ │  68  │ │  75  │ │  63  │ │  60  │                      │
│ │[Warm]│ │[Watch│ │[Warm]│ │[Watch│ │[Watch│                      │
│ │      │ │]     │ │]     │ │]     │ │]     │                      │
│ │• Port│ │• Infr│ │• Comp│ │• Weak│ │• Mark│                      │
│ │folijo│ │a adj │ │arable│ │ secto│ │et mon│                      │
│ │overla│ │acency│ │tier: │ │r fit │ │itorin│                      │
│ │p (2) │ │cand  │ │emerg │ │today │ │g beh │                      │
│ │• Earl│ │• Mark│ │• Exec│ │• Some│ │• Low │                      │
│ │y-stag│ │et sig│ │align │ │adjac │ │densit│                      │
│ │e fit │ │nals  │ │improv│ │ency  │ │y sig │                      │
│ │• Fres│ │• Conf│ │• Phas│ │• Need│ │• Incr│                      │
│ │h trac│ │idenc │ │e-chan│ │repos │ │ease  │                      │
│ │es    │ │e Med │ │ge up │ │proo  │ │visib │                      │
│ │      │ │      │ │      │ │      │ │      │                      │
│ │Identi│ │Identi│ │Identi│ │Identi│ │Identi│                      │
│ │ty loc│ │ty loc│ │ty loc│ │ty loc│ │ty loc│                      │
│ │ked...│ │ked...│ │ked...│ │ked...│ │ked...│                      │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                      │
└─────────────────────────────────────────────────────────────────────┘

```

---

## Key Visual Elements (What Makes It Work)

### 1. Degraded Banner (Amber)
- **Not an error** → "Delayed" not "Failed"
- **Retry hint** → "~60s" not "Try again later"
- **Action button** → "Retry resolution" (not passive)

### 2. Triad (Orientation)
- **Three columns** → Position / Flow / Trajectory
- **Progress bars** → Visual feedback (not just numbers)
- **Gauge arc** → Trajectory feels scientific
- **Heartbeat pulse** → "Latest intent trace: 4 hours ago" (proves liveness)
- **Confidence badge** → Truthful uncertainty (Medium = honest)

### 3. Scan Playback (Motion)
- **4-beat animation** → Shows system thinking
- **Step icons** → ✓ done, ! degraded (not ✗ failed)
- **Activity feed** → 5-6 bullets of what happened
- **Progress indicator** → [2/4] (shows where you are)

### 4. Intent Trace Chart (Evidence)
- **Always renders** → Even at zero (shows empty bars)
- **7-day window** → Mon/Tue/Wed/Thu/Fri/Sat/Sun
- **Max auto-scaling** → Makes small signals visible
- **Empty message** → "You're not in flow yet — but you can move there"

### 5. Alignment Bars (Coaching)
- **5 metrics** → Team, Market, Execution, Adjacency, Phase-Change
- **Progress bars** → Visual feedback (not spreadsheet)
- **"Why" explanations** → Small text beneath each bar
- **Next Best Move** → Single action tied to lowest score

### 6. Preview Cards (Anticipation)
- **Anonymous profiles** → "US Seed Operator Fund" not fake names
- **Fit scores** → 72, 68, 75, 63, 60 (feels calibrated)
- **Evidence bullets** → 3 per card (not lorem ipsum)
- **Locked messaging** → "Identity locked until resolution completes"
- **Badge** → "+184 more detected" (creates FOMO)

---

## What Founders Experience (Psychology)

### First 3 Seconds
1. See degraded banner → "Oh, it's delayed, not broken"
2. See triad → "I'm Emerging, capital is Forming, direction is Stable"
3. See heartbeat → "Latest trace: 4 hours ago" (proves liveness)

### Next 10 Seconds
4. See scan playback → "System is working, just identity step delayed"
5. See intent chart → "2 traces Thursday, 1 Friday" (feels real)
6. See alignment → "Team 52%, Market 48%" (I can improve this)

### Next 20 Seconds
7. See Next Best Move → "Publish technical proof" (I know what to do)
8. See 5 preview cards → "US Seed Fund fit: 72" (feels calibrated)
9. See "+184 more" → "Holy shit, they're there, I just can't see them yet"

### Result
- **Not frustrated** → "It's resolving, I can retry"
- **Not confused** → "I understand my position"
- **Not idle** → "I have a Next Best Move"
- **Not discouraged** → "184 investors detected, not zero"

**This is trust infrastructure.**

---

## Technical Notes

### Colors (Dark Theme)
- Background: `#0a0a0a` (Pythh dark)
- Cards: `bg-white/5` with `border-white/10`
- Text: white with opacity (90, 70, 60, 40)
- Accents: Emerald-500 (high conf), Amber-500 (medium), Rose-500 (low)

### Animations
- Heartbeat pulse: 1.6s interval (opacity 70 → 100)
- Scan playback: 700ms per step (auto-plays)
- Progress bars: Smooth width transitions

### Responsive
- Grid: 1 column mobile, 2 columns desktop (lg:grid-cols-2)
- Triad: Stacks vertically on mobile
- Preview cards: 1 column mobile, 5 columns desktop

---

**This is what the page looks like now. Even when matching fails, it still teaches navigation.**
