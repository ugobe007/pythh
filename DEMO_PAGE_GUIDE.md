# Demo Page - Production Guide

**Route**: `/demo`  
**Purpose**: Cinematic 60-second capital navigation reveal for fundraising  
**Audience**: Investors, accelerators, founders

---

## Quick Start

1. **Navigate to**: `http://localhost:5173/demo`
2. **Click preset chips**: `autoops.ai` | `vanta.com` | `ramp.com`
3. **Watch the magic**: 4-beat timeline → Triad → Convergence reveal

---

## The 4-Beat Timeline (Cinematic Reveal)

### Beat 1 (Instant): Orientation
```
✅ Capital Navigation initializing…
```

### Beat 2 (600ms): Heartbeat
```
Latest intent trace: 4 hours ago
```

### Beat 3 (900ms): Aha Number
```
35 observers (7d)
↑ count-up animation (mandatory)

These are investors leaving discovery traces 
around your startup — before outreach.
```

### Beat 4 (2400ms): Direction
```
Direction: Strongly Incoming
↑ 1-second fade-in

"Projected capital movement detected."
```

**Total reveal time**: ~3 seconds

---

## Demo Scenarios (Deterministic)

All scenarios are fully curated in `src/data/demoScenarios.ts`:

| Scenario | URL | Position | Flow | Direction | Observers | Hidden |
|----------|-----|----------|------|-----------|-----------|--------|
| **Breakout** | autoops.ai | Hot | Surging | Strongly Incoming | 35 | 184 |
| **Forming** | vanta.com | Aligned | Forming | Incoming | 18 | 64 |
| **Quiet** | example-startup.io | Emerging | Quiet | Stable | 7 | 21 |
| **Crowded** | ramp.com | Crowded | Saturated | Strongly Incoming | 52 | 304 |

**Recommendation**: Use **Breakout** for first-time demos (maximum impact).

---

## Capital Navigation Triad

Each column has a **"Why?" button** that opens a modal showing the top 3 drivers:

### Position Drivers (example)
- GOD Score: 77 (p92)
- Momentum: Breakout
- Flow Alignment: 0.71

### Flow Drivers (example)
- Accel ratio: 1.6x
- Signal 24h: p92
- Signal quality: 0.68

### Trajectory Drivers (example)
- Slope 24h: +18%
- Phase change: p96
- Decay: Stable

**Purpose**: Prevents viewers from thinking "this is vibes."

---

## Convergence Reveal Strip

**Left**: 5 visible investors with:
- Name/logo
- Match score (87, 82, 79...)
- State badge (surge, warming, breakout)
- Evidence bullet ("Viewed 3 portfolio-adjacent startups")
- Signal age ("4h ago")

**Right**: Blurred pool teaser
```
+184 more investors detected

[Unlock Full Signal Map]

Most founders never get to see this layer.
```

**This is your dopamine lever.**

---

## Next Best Move (Control + Addiction)

Shows single-sentence coaching tied to navigation:

```
Trajectory Alignment: High (71%)

Next Best Move: Publish technical proof to 
deepen alignment with incoming capital

Impact:
• Alignment +8-12%
• Direction confidence ↑
• Forecast window expands
```

**Rule**: Action must use navigation language ("alignment", "trajectory", "flow").

---

## Presenter Controls (Bottom Right)

Click **"Show Controls"** to reveal:

1. **Scenario dropdown**: Switch between Breakout/Forming/Quiet/Crowded
2. **Fast mode**: Skip animations (500ms scan instead of 2000ms)
3. **Debug overlay**: Show raw JSON payload in triad
4. **Replay Demo**: Re-trigger the 4-beat timeline

**Use case**: Live demos in investor meetings where you need control.

---

## The One-Liner Panel (Category Definition)

At bottom of page:

```
We don't match founders to investors — 
we detect when capital is already converging 
and show founders how to amplify that signal.

Signals = intent
Intent clusters = direction
Direction = timing advantage
```

**This is your axiom. This owns the category.**

---

## Recording the Loom

### Setup (5 minutes)
1. Open `/demo` in browser
2. Select **Breakout** scenario (autoops.ai)
3. Open **Presenter Controls** → Enable **Fast mode**
4. Click **Replay Demo** to practice timing

### Recording (90 seconds)
Use **LOOM_1_FINAL_SCRIPT_NAVIGATION.md** as your script.

**Key moments**:
- **0:00-0:15**: Set context ("Fundraising usually feels like...")
- **0:15-0:30**: Click "Run Scan" → Wait for observer count-up
- **0:30-0:45**: **PAUSE 2 SECONDS** after "35 observers" (CRITICAL)
- **0:45-1:00**: Scroll through Convergence Reveal → hover over "Why?" buttons
- **1:00-1:15**: Show Next Best Move → scroll to blurred pool teaser
- **1:15-1:30**: Read One-Liner Panel verbatim (axiom)

**Tone**: Calm, slow, curious. No hype, no selling.

### Post-Recording
1. Embed Loom at top of Slide 1 in pitch deck
2. Send Loom link (no deck) to 5 accelerators
3. Use in cold investor outreach emails

---

## Technical Details

### Files Created
- `src/pages/Demo.tsx` - Main demo page
- `src/components/DemoRevealTimeline.tsx` - 4-beat cinematic reveal
- `src/data/demoScenarios.ts` - 4 curated scenarios with full payloads

### Route Added
```tsx
<Route path="/demo" element={<Demo />} />
```

### Key Features
- ✅ Deterministic (no network calls, no empty states)
- ✅ Count-up animation for observers (the "Aha" moment)
- ✅ Staggered fill (Position → Flow → Trajectory)
- ✅ "Why?" modals for driver transparency
- ✅ Presenter controls for scenario switching
- ✅ Fast mode for quick replays
- ✅ One-liner panel for category definition

---

## Success Criteria

### Immediate (First View)
- ✅ Viewer understands "Capital Navigation" metaphor < 10 seconds
- ✅ "35 observers" count-up creates dopamine spike
- ✅ "Strongly Incoming" direction feels predictive, not descriptive

### After Demo (Investor Feedback)
- ✅ Investor says: "This is not matching"
- ✅ Investor asks: "How do you detect convergence?"
- ✅ Investor requests: "Can I see this for my portfolio?"

### Category Ownership
- ✅ Founders start saying: "We're entering trajectory"
- ✅ Investors start asking: "Which sectors are strongly incoming?"
- ✅ The language propagates → You own the reference frame

---

## Troubleshooting

### Timeline doesn't animate
- Check browser console for errors
- Ensure `DemoRevealTimeline.tsx` imported correctly
- Verify `animate-fade-in` CSS class exists in App.css

### Scenarios not switching
- Check `demoScenarios.ts` exports
- Verify scenario IDs match: 'breakout', 'forming', 'quiet', 'crowded'
- Ensure state is updating (use React DevTools)

### "Why?" modals not opening
- Check DriverModal component is rendering
- Verify drivers array passed correctly from scenario
- Test click event not blocked by z-index issues

---

## Next Steps

1. **Test locally**: `npm run dev` → Navigate to `/demo`
2. **Practice timing**: Run through 4-beat timeline 3-5 times
3. **Record Loom**: Use LOOM_1_FINAL_SCRIPT_NAVIGATION.md
4. **Send to 5 accelerators**: YC, Techstars, a16z START, EF, etc.
5. **Iterate based on feedback**: Track which scenario gets most "oh shit" reactions

---

## The Strategic Point

This demo page is not a product tour.

It's a **category definition device**.

Every element reinforces:
- Capital moves first (not founders)
- Intent precedes outreach (behavioral physics)
- Navigation beats matching (coordinate system)

**If they leave saying "this is capital navigation", you won.**

That is exactly how generational platforms are born.

---

*Built for: Fundraising (Seed → Series A)*  
*Optimized for: 60-second "oh shit" moment*  
*Success metric: Investor says "this is not matching"*
