# Vote System Quick Reference

## ⚡ Usage Examples

### Save a Vote
```typescript
import { saveVote } from '@/lib/voteService';

// User votes YES on startup "0"
const result = await saveVote('0', 'yes');
if (result.success) {
  console.log('✅ Vote saved');
}
```

### Check if User Voted
```typescript
import { hasVoted } from '@/lib/voteService';

const voteType = hasVoted('0');  // Returns 'yes', 'no', or null
if (voteType) {
  console.log(`You voted: ${voteType}`);
}
```

### Get All YES Votes (Local)
```typescript
import { getYesVotes } from '@/lib/voteService';

const startupIds = getYesVotes();  // ['0', '5', '12']
```

### Get Vote Counts (Supabase)
```typescript
import { getVoteCounts } from '@/lib/voteService';

const { yes, no } = await getVoteCounts('0');
console.log(`Startup 0: ${yes} yes, ${no} no`);
```

### Get Trending Startups
```typescript
import { getTrendingStartups } from '@/utils/voteAnalytics';

const trending = await getTrendingStartups(10);
trending.forEach(({ startup, stats }) => {
  console.log(`${startup.name}: trend=${stats.trendingScore}`);
});
```

---

## 🗂️ File Structure

```
src/
├── lib/
│   ├── voteService.ts        ← Core voting logic
│   ├── supabase.ts           ← Supabase client
│   └── activityLogger.ts     ← Log votes to activities table
├── utils/
│   └── voteAnalytics.ts      ← Trending, vote stats
└── hooks/
    └── useVotes.ts           ← React hook (if needed)
```

---

## 🔑 Key Concepts

### Startup ID
- Local ID from `startupData` (0, 1, 2, etc.)
- Stored in `votes.metadata.startup_local_id`
- String type for flexibility

### Anonymous User
- Stable UUID generated once per browser
- Stored in `localStorage:anon_user_id`
- Used as `votes.user_id`

### Vote Storage
- **Fast layer:** localStorage (immediate, offline-capable)
- **Durable layer:** Supabase (persistent, queryable)
- Syncs best-effort (works even if one fails)

---

## 📊 Trending Score Formula

```
Score = (velocity × 0.7) + (total × 0.2) + (recency × 0.1)

Where:
  velocity = recent YES votes (24h) × 10
  total    = log₁₀(totalYesVotes + 1) × 20
  recency  = max(0, 100 - hoursSinceLastVote)
```

Example: Startup with 5 recent YES votes, 50 total, voted 2 hours ago
```
velocity = 5 × 10 = 50
total    = log₁₀(51) × 20 ≈ 34
recency  = max(0, 98) = 98
score    = (50 × 0.7) + (34 × 0.2) + (98 × 0.1) = 47.8
```

---

## 🔍 Debugging

### View Local Votes
```javascript
// In browser console
JSON.parse(localStorage.getItem('user_votes'))
```

### View Anonymous User ID
```javascript
localStorage.getItem('anon_user_id')
```

### Check Supabase Votes Table
```sql
SELECT id, user_id, vote, metadata, created_at 
FROM votes 
ORDER BY created_at DESC 
LIMIT 10;
```

### Count Votes for Startup 0
```sql
SELECT vote, COUNT(*) 
FROM votes 
WHERE metadata->>'startup_local_id' = '0'
GROUP BY vote;
```

---

## ⚙️ Configuration

### Anonymous User Storage Key
```typescript
const ANON_USER_KEY = 'anon_user_id';
```
(in `src/lib/voteService.ts`)

### Vote Cache Key
```typescript
const LOCAL_VOTES_KEY = 'user_votes';
```
(in `src/lib/voteService.ts`)

### Trending Score Weights
```typescript
velocityWeight = 0.7;  // Recent votes matter most
totalWeight = 0.2;     // Overall popularity
recencyWeight = 0.1;   // Recency bonus
```
(in `src/utils/voteAnalytics.ts`)

---

## ✅ Testing Votes

### Manual Test
1. Go to startup detail page
2. Click "Vote Yes"
3. Verify vote appears in trending
4. Refresh page → vote persists
5. Check Supabase: `SELECT * FROM votes WHERE metadata->>'startup_local_id' = '0'`

### Check Vote Sync
```typescript
import { syncVotesFromSupabase, getLocalVotes } from '@/lib/voteService';

const userId = localStorage.getItem('anon_user_id');
await syncVotesFromSupabase(userId);
console.log('Local votes:', getLocalVotes());
```

---

## 🚀 Deployment

**Current status:** ✅ Ready

```bash
# Build
npm run build              # ✅ Succeeds

# Dev
npm run dev               # ✅ Runs on 5175

# Prod
npm run build && npm run preview
```

**No migrations needed** - uses existing `votes` table

---

## 🔮 Future Enhancements

1. **Uniqueness Constraint**
   - Add index: `(user_id, metadata->>'startup_local_id')`
   - Change insert → upsert

2. **Real-Time**
   - Enable Supabase Realtime
   - Auto-refresh vote counts in UI

3. **Auth Integration**
   - Replace anonymous UUID with real user.id
   - Store votes per authenticated user
   - Enable cross-device sync

4. **Analytics**
   - Track vote trends over time
   - Identify gaming/bot votes
   - Visualize voting patterns

---

## 📝 Notes

- Votes are **not unique per user** (can vote multiple times for same startup)
- To fix: See "Uniqueness Constraint" section above
- **No validation** between vote type and UI state
- localStorage votes **not cleared** on logout (for anonymous users)
- Supabase inserts are **best-effort** (tolerates failures)

---

Last updated: Jan 26, 2026
