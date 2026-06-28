# Bulletproof Routing System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                 BULLETPROOF ROUTING SYSTEM                     │
│                    (Type-Safe • Refactor-Proof)                │
└────────────────────────────────────────────────────────────────┘
```

## Flow Diagram

### Frontend Layer
```
User enters URL: "example.com"
         ↓
routes.resultsByUrl() → /matches?url=example.com
         ↓
fetch('/api/resolve', { url: 'example.com' })
         ↓
┌──────────────────────────────────────────────────┐
│  ResolveStartupResponse                          │
│  - status: 'found' | 'pending' | 'created' | ... │
│  - startup_id: UUID                              │
│  - job_id: UUID (if created)                     │
└──────────────────────────────────────────────────┘
         ↓
if (status === 'found') {
  fetch('/api/matches/count?startup_id=...')
         ↓
  if (is_ready) {
    fetch('/api/matches/top?startup_id=...&page=1')
    → Display results
  } else {
    → Show "matching..." + poll
  }
}
```

### API Contract Layer
```
src/lib/api/contracts.ts (TypeScript types)

┌─────────────────────────────────────┐
│ ResolveStartupResponse              │
│ MatchCountResponse                  │
│ TopMatchesResponse                  │
│ SignalProfileResponse               │
│ GuidancePayload                     │
│ InvestorProfileResponse             │
└─────────────────────────────────────┘

Helpers:
- resolveStartup(url)
- diagnosePipeline(startupId)
- getMatchCount(startupId)
- getTopMatches(startupId, page, perPage)
- getSignalProfile(startupId)
- getGuidance(startupId)
- getInvestorProfile(investorId)
```

### Server Layer
```
server/routes/resolve.js
POST /api/resolve
         ↓
Call RPC: resolve_startup_by_url(p_url)
         ↓
Return: { status, startup_id, job_id, message }

─────────────────────────────────────────

server/routes/matches.js
GET /api/matches/count?startup_id=...
         ↓
Call RPC: count_matches(p_startup_id)
         ↓
Return: { total, active, is_ready, last_match_at }

─────────────────────────────────────────

GET /api/matches/top?startup_id=...&page=1&per_page=50
         ↓
Check: count_matches(startup_id) → is_ready?
         ↓
Query: startup_investor_matches
       JOIN investors
       ORDER BY match_score DESC
       LIMIT per_page OFFSET (page-1)*per_page
         ↓
Return: { matches: [...], total_count, total_pages }
```

### Database Layer
```
supabase/migrations/20260124_resolve_startup_rpc.sql

┌────────────────────────────────────────────────┐
│ resolve_startup_by_url(url text)               │
│   → Normalize URL                              │
│   → Check canonical_key (approved)             │
│   → Check website (approved)                   │
│   → Check pending/review startups              │
│   → Check existing discovery jobs              │
│   → Return status + IDs                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ count_matches(startup_id uuid)                 │
│   → Count total matches                        │
│   → Count active investor matches              │
│   → Compute is_ready (>= 1000)                 │
│   → Return counts + last_match_at              │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ diagnose_pipeline(startup_id uuid)             │
│   → Get queue status                           │
│   → Get match counts                           │
│   → Compute system_state                       │
│   → Return diagnosis                           │
└────────────────────────────────────────────────┘
```

## Bulletproof Guarantees

✅ Never show blank results page  
✅ Always show: ready | matching | needs_queue | error  
✅ Type-safe URLs (no typos)  
✅ Refactor-safe (rename once, update everywhere)  
✅ Fast count checks (no full data fetch)  
✅ Paginated results (never load all 1000 matches)  
✅ Graceful errors (fallback to safe states)  
✅ Works with existing code (backwards compatible)  

## Files Created

**Frontend:**
- `src/routes/index.ts` - Route builders + helpers
- `src/routes/README.md` - Usage guide
- `src/lib/api/contracts.ts` - TypeScript API types

**Backend:**
- `server/routes/resolve.js` - URL resolution endpoint
- `server/routes/matches.js` - Enhanced with `/count` and `/top`
- `supabase/migrations/20260124_resolve_startup_rpc.sql` - RPCs

**Documentation:**
- `BULLETPROOF_ROUTING_COMPLETE.md` - Full implementation guide
- `BULLETPROOF_ROUTING_DIAGRAM.md` - This file

## Next Steps

1. **Paste RPC migration** into Supabase SQL Editor
2. **Restart API server**: `pm2 restart api-server`
3. **Test endpoints** (see BULLETPROOF_ROUTING_COMPLETE.md)
4. **Build Phase 5 tabbed layout** (signals/:id/investors, etc.)
