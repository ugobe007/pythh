# Signals Dashboard Redesign

## New Architecture

The Signals page now follows a **live command center** design with minimal panels and maximum data density.

### Page Flow (Top to Bottom)

```
┌─────────────────────────────────────────────────────────┐
│ SearchBarTop                                            │
│ "Are you ready to signal?" [Thin URL input]             │
│ Data sources: SEC · Portfolio · Thesis                  │
│ [? How Signals Work] (modal link)                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ThreeColumnGrid (canonical layout)                      │
│ ├─ Left: SignalGuideLeft (definitions + filters)        │
│ ├─ Center: SignalTapeCenter (signal cards + feed)       │
│ └─ Right: OutcomeRailRight (outcomes)                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ LiveMatchCarousel ← PROOF OF MATCHING                   │
│ ⚡ LIVE MATCHING NOW | 1,240 matches this minute        │
│                                                         │
│ [Startup Name] ↔ [Investor Name]                        │
│ [Stage/Sector]    [Focus/Strategy]                      │
│                   [Match Score]                         │
│                                                         │
│ (Rotates every 5s, batch refreshes every 60s)           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SignalsDashboardWidgets (live metrics)                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ 342 Signals  │ │ 1,240 Matches│ │ Market Pulse │     │
│ │ In Motion    │ │ This Minute  │ │ (4 sectors)  │     │
│ │ +23% (24h)   │ │ ⚡ Live      │ │              │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ HowSignalsWorkModal (dismissible, one-time)             │
│ Shows workflow: Scrapers → GOD → Matching → Signals     │
│ Lists signal types with descriptions                    │
└─────────────────────────────────────────────────────────┘
```

## New Components

### `SearchBarTop.tsx`
- **Purpose**: Thin, clean URL injection
- **Features**:
  - Single-line search input
  - "Are you ready to signal?" micro-copy
  - Data sources as text links (SEC · Portfolio · Thesis)
  - Cyan accent on focus
  - Minimal visual footprint

### `LiveMatchCarousel.tsx`
- **Purpose**: Show live founder-investor matching in real-time
- **Features**:
  - Fetches from `/api/v1/matches` endpoint (real data)
  - Rotates startup ↔ investor pairs every 5 seconds
  - Batch refreshes every 60 seconds with new matches
  - Cyan glow effect on card
  - Shows match score percentage
  - Progress indicator (dot tracking)
  - Fallback demo data if API unavailable

### `SignalsDashboardWidgets.tsx`
- **Purpose**: Live metrics dashboard
- **Widgets**:
  1. **Signals in Motion** (342) — channels with delta > 5
  2. **Live Matches** (1,240) — fresh matches this minute
  3. **Signal Market Pulse** — top 4 sectors with delta
- **Features**:
  - Auto-updates every 10 seconds
  - Cyan accent on hover (group effect)
  - Clean 3-column grid layout
  - Minimal borders (cyan-500/20)

### `HowSignalsWorkModal.tsx`
- **Purpose**: Educational popup showing signal system
- **Features**:
  - Workflow diagram: Scrapers → GOD Scoring → Matching → Signals
  - Four signal types with descriptions:
    - Capital Movement
    - Capital Saturation
    - Velocity
    - Signal Conversion
  - Dismissible (×)
  - Session-persisted dismissal (only shown once per session)
  - Backdrop blur + transparency

## Color Scheme

- **Background**: Black (`bg-black`)
- **Accents**: Cyan (`text-cyan-400`, `border-cyan-500/20`)
- **Glows**: `bg-gradient-to-r from-cyan-500/5 to-transparent` (subtle)
- **Text**: White/white-transparency for hierarchy
- **Borders**: `border-cyan-500/20` (minimal)

## Key Design Principles

1. **Minimal Panels**: No unnecessary containers; text links instead of buttons where appropriate
2. **Motion = Credibility**: Live matching carousel proves the system is working
3. **Data Density**: Every pixel counts; no wasted space
4. **Cyan Accents**: Subtle but deliberate cyan hints throughout
5. **One-Time Education**: Modal shown once; founders see it, understand the system, then never see it again
6. **Live Feel**: Auto-updating metrics + rotating matches = fresh, alive platform

## Integration Points

- **SearchBarTop** calls `handleSubmitURL` → triggers URL injection flow
- **LiveMatchCarousel** polls `/api/v1/matches` every 60s
- **SignalsDashboardWidgets** calculates from `channels` prop and polls match count
- **HowSignalsWorkModal** managed via `showHowItWorks` state (can link from TopBar "?")

## Next Steps

1. Wire "?" button in TopBar to show HowSignalsWorkModal
2. Add real match API endpoint if not exists
3. Test live matching carousel with real data
4. A/B test carousel auto-play vs pause-on-hover
