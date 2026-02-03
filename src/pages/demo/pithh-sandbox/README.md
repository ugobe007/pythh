# 🎯 PYTHH SIGNAL RADAR

## What is Pythh?

Pythh is the **live capital intelligence surface** that demonstrates Pythh's core magic: showing founders what investors see about them in real-time.

Instead of describing signals, Pythh **shows signals moving**—18 channels of capital indicators, real-time alignment arcs, live fundraising windows, and a causal feed of what's moving their odds.

## File Structure

```
src/pithh/
├── types.ts                 # Complete type system (modes, API shapes)
├── fakeEngine.ts            # Fake data generation + motion rules
├── SignalRadarPage.tsx      # Root component + mode machine
├── components/
│   ├── TopBar.tsx          # Header + status badge
│   ├── ChannelStack.tsx    # Left column (18 channels with deltas)
│   ├── RadarField.tsx      # Center column (SVG sweep + blips)
│   ├── RightRail.tsx       # Right column (panels + feed)
│   └── ActionBar.tsx       # Bottom action bar (URL input + CTA)
├── pithh.css               # Design system + animations
├── WIRING_GUIDE.md         # How to integrate real APIs
└── README.md               # This file
```

## Live URL

```
http://localhost:5173/signals-radar
```

## States (Mode Machine)

### STATE 0: Global Observatory
- **Status badge**: `LIVE`
- **Channels**: Always moving (baseline drift + occasional events)
- **Radar**: Continuous sweep (1.0x speed)
- **Right rail**: "What's happening" feed + empty panels
- **Action**: URL input ready

### STATE 1: Injecting (1–2s after submit)
- **Status badge**: `INJECTING`
- **Channels**: Frozen ~300ms, then resume with jitter
- **Radar**: Sweep accelerates (1.8x speed), YOU blip flickers in
- **Right rail**: Status messages ("Parsing signals…", "Computing GOD deltas…")
- **Action**: Input disabled

### STATE 2: Reveal (dominant moment)
- **Status badge**: `REVEAL`
- **Channels**: Resume normal deltas
- **Radar**: Sweep normal speed, YOU halo at max intensity
- **Right rail**: Panels appear (Identity, Window, Alignment, Power, Next Moves)
- **Action**: CTA morphs to "Track my signals"

### STATE 3: Tracking (live loop)
- **Status badge**: `TRACKING YOU`
- **Channels**: Live deltas from backend
- **Radar**: Arcs on alignment changes, rings on phase changes
- **Right rail**: "What moved your odds" feed (stacked, decays)
- **Action**: Email capture appears inline (after 4–8s)

## How Motion Rules Work

### Channel Bars (Left Column)

1. **Baseline drift**: Every heartbeat (~1.8s), deltas decay toward 0 (multiplied by 0.6)
2. **Micro jitter**: Visual wobble based on `pulseSeq` (0–2px)
3. **Delta spike**: On semantic event (e.g., "Senior hire"), delta jumps +6
4. **Direction glyph**: ↑ (up), ↓ (down), → (flat)

**Code**: `ChannelStack.tsx` applies `transform: translateX()` based on pulse, `barFill` width tracks value.

### Radar Field (Center Column)

1. **Sweep**: Rotates continuously, speed controlled by `sweepSpeed`
   - Global: 1.0x (3.2s rotation)
   - Injecting: 1.8x (1.78s rotation, feels urgent)
   - Reveal/Tracking: 1.0x

2. **YOU blip**: Center particle with initials
   - Position: Drifts ±7px horizontal, ±9px vertical (sin/cos of pulseSeq)
   - Intensity: 0.6 baseline, 0.95 at halo pulse (T=0.62s after resolve)

3. **Arcs**: Appear on alignment deltas ≥2
   - Staggered radii, fade opacity based on strength
   - Max 8 concurrent arcs

4. **Phase ring**: Rare pulse animation
   - Expands outward, opacity fades (0.8s ease-out)

### Feed (Right Column)

1. **Stacking**: New items prepended, max 30 in state
2. **Time ago**: "12s ago", "3m ago", "1h ago"
3. **Decay**: Only newest items fully opaque, older items muted
4. **Impacts**: Each feed item shows which channels it affected

## Event Templates (Semantic Events)

Fake engine randomly triggers one every ~1.8s:

- **"Senior hire detected"** → Talent +6, Velocity +3, Determination +2
- **"Enterprise customer detected"** → Opportunity +9, Customers +8, Goldilocks +3
- **"Tier-1 press mention"** → Media +7, FOMO +4, Capital Flow +2
- **"Product launch detected"** → Product +6, Velocity +4, Determination +2
- **"Competitive launch"** → Competition +6, Pressure −4, Opportunity −2
- **"Investor attention spike"** → Alignment +3, FOMO +2

Events generate:
1. Feed items (displayed in right rail)
2. Radar events (stored for history)
3. Channel deltas (applied immediately)
4. Optional arc (if alignment delta ≥2)
5. Rare phase change (8% probability)

## 10-Second Choreography (T=0 is URL submit)

| T (ms) | State | What Happens |
|--------|-------|--------------|
| T=0 | injecting | Mode switches to injecting, feed shows status messages, channels freeze |
| T=420 | injecting | Startup identity resolved, YOU blip appears at 0.6 intensity |
| T=620 | injecting | Halo pulse (intensity → 0.95), first dopamine hit |
| T=1200 | reveal | Panels appear (identity, window, alignment, power), feed: "Scan complete" |
| T=2200 | tracking | Mode switches to tracking, live feed begins, email eligible |
| T=4000–8000 | tracking | Email capture visible + clickable |

Easing: Panels use staggered reveal (100–200ms offset), halo uses ease-in-out (1.4s cycle).

## Customizing

### Change channel list
Edit `CHANNELS` array in [fakeEngine.ts](fakeEngine.ts#L6)

### Change event templates
Edit `EVENT_TEMPLATES` in [fakeEngine.ts](fakeEngine.ts#L46)

### Change sweep speed
Edit `CHANNELS` radii/timing in [RadarField.tsx](components/RadarField.tsx#L20)

### Change color scheme
Edit CSS variables in [:root](pithh.css#L1) (--hot, --mint, --danger, etc.)

### Change heartbeat interval
Edit `window.setInterval` in [SignalRadarPage.tsx](SignalRadarPage.tsx#L30) (currently 1800ms)

## Testing

### Test global state
```bash
npm run dev
# Visit http://localhost:5173/signals-radar
# Watch channels move, radar sweep, feed populate
```

### Test injection flow
```bash
# In URL bar, type any domain (e.g., "autoops.ai")
# Click "Inject into radar"
# Watch choreography: freeze → resolve → halo → reveal → tracking
```

### Test tracking deltas
```bash
# After reveal, watch right panel and feed
# New events should appear every ~1.8s
# Channels should spike and decay
# Arcs should appear on alignment changes
```

## Wiring Real APIs

See [WIRING_GUIDE.md](WIRING_GUIDE.md) for step-by-step instructions to:
1. Implement backend endpoints
2. Replace fakeEngine calls with real API calls
3. Set up cursor-based incremental updates
4. Deploy to production

Quick summary:
- Replace `fakeResolveStartup()` → `POST /api/v1/startups/resolve`
- Replace scan polling → `GET /api/v1/scans/{id}`
- Replace tracking polling → `GET /api/v1/startups/{id}/tracking`
- Replace heartbeat events → Real backend deltas

## Performance Notes

- **Heartbeat interval**: 1.8s (adjust to match backend update frequency)
- **Max feed items**: 30 (memory limit)
- **Max radar events**: 50 (history for display)
- **Max arcs**: 8 concurrent (prevents clutter)
- **RAF loop**: Every frame (animation fluidity)
- **Polling overhead**: ~30KB per request (optimizable with cursor + delta-only payload)

## Next Steps

1. ✅ Fake engine working
2. ✅ Mode machine choreography locked
3. ✅ CSS + animations ready
4. ⏳ Implement backend endpoints
5. ⏳ Wire real APIs (see WIRING_GUIDE.md)
6. ⏳ Test end-to-end with real data
7. ⏳ Optimize for production (CDN, caching, SSE)

---

**Note**: This is a fully functional fake system. You can test the UI/UX flow without backend. The type system is locked, so once you implement the endpoints, wiring is straightforward.
