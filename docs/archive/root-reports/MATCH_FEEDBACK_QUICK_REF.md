# Match Feedback System - Quick Reference

## For Founders

### Using the Action Buttons

When browsing investor matches, you'll see two action buttons below each match:

1. **Request Intro** (cyan button with paper plane icon)
   - Click when you want an introduction to this investor
   - Match status updates to "Intro requested"
   - Hot Match team will facilitate the connection

2. **Not Interested** (gray button with thumbs down icon)
   - Click when this investor isn't a fit for your startup
   - Match status updates to "Marked not interested"
   - Match won't appear in your active list

### What Happens Behind the Scenes

Every time you click a button:
- ✅ Your preference is saved to the database
- ✅ The ML system logs your choice for learning
- ✅ Future matches get smarter based on your preferences

---

## For Admins

### Checking Feedback Data

View match feedback in the database:

```sql
-- See all match feedback events
SELECT * FROM ai_logs 
WHERE type = 'match_feedback' 
ORDER BY created_at DESC 
LIMIT 50;

-- Count by action type
SELECT 
  action,
  COUNT(*) as count
FROM ai_logs
WHERE type = 'match_feedback'
GROUP BY action;
```

### Match Status Distribution

```sql
-- See status breakdown
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(match_score), 1) as avg_match_score
FROM startup_investor_matches
GROUP BY status
ORDER BY count DESC;
```

### Expected Timeline

| Week | Expected Data | What to Monitor |
|------|---------------|-----------------|
| 1-2 | 10-20 events | Founders discovering the feature |
| 3-4 | 30-50 events | Usage patterns emerging |
| 5-6 | 50-100 events | Enough data for ML recommendations |
| 7+ | Ongoing | ML agent generating insights |

---

## For Developers

### Database Schema

**startup_investor_matches.status** values:
- `suggested` - Default state, no user action yet
- `intro_requested` - Founder wants intro (HIGH positive signal)
- `declined` - Founder not interested (negative signal)
- `viewed` - Founder saw but didn't act (neutral signal)
- `meeting_scheduled` - Meeting booked (future)
- `funded` - Investment closed (future)

### Adding New Actions

To add a new feedback action (e.g., "Save for Later"):

1. **Add button to DiscoveryResultsPage.tsx**:
```typescript
<button
  onClick={() => updateMatchStatus(m, 'saved')}
  disabled={isActioning}
  className="..."
>
  <Bookmark className="w-3 h-3" />
  Save for Later
</button>
```

2. **Add status indicator**:
```typescript
{matchStatus === 'saved' && (
  <div className="mt-5 pt-5 border-t border-white/5 flex items-center gap-2">
    <Bookmark className="w-4 h-4 text-amber-400" />
    <span className="text-sm text-amber-400">Saved for later</span>
  </div>
)}
```

3. **Update ML training** (already handled by existing `updateMatchStatus` function)

### Querying Feedback Events

```typescript
import { supabase } from './lib/supabase';

// Get all feedback for a startup
const { data } = await supabase
  .from('ai_logs')
  .select('*')
  .eq('type', 'match_feedback')
  .contains('output', { startup_id: startupId });

// Get conversion rate (intro requests / total matches)
const { data: matches } = await supabase
  .from('startup_investor_matches')
  .select('status')
  .eq('startup_id', startupId);

const introRequests = matches.filter(m => m.status === 'intro_requested').length;
const conversionRate = (introRequests / matches.length) * 100;
```

---

## ML Agent Learning Process

### Phase 1: Data Collection (4-6 weeks)
- System collects 50-100 match outcomes
- No changes to GOD scoring yet
- Just observing patterns

### Phase 2: Analysis (Automatic)
ML agent identifies patterns like:
- "Startups with traction_score >= 3 get 85% intro request rate"
- "High GOD scores (80+) in fintech get declined often → sector mismatch"
- "team_score < 2 never gets intro requests → increase weight"

### Phase 3: Recommendations (Daily at 3 AM)
ML agent generates proposals:
```json
{
  "type": "ml_recommendation",
  "action": "adjust_weight",
  "output": {
    "component": "traction_score",
    "current_weight": 12.1,
    "proposed_weight": 18.5,
    "reason": "High correlation with intro requests (r=0.78)",
    "confidence": 0.85,
    "sample_size": 73
  }
}
```

### Phase 4: Human Review & Apply
1. Admin reviews recommendations in dashboard
2. Decides which to apply
3. Updates `GOD_SCORE_CONFIG` in `startupScoringService.ts`
4. Runs `npx tsx scripts/recalculate-scores.ts`
5. Monitors impact

---

## Troubleshooting

### Buttons not appearing
- Check that match has `match_score > 0`
- Verify match status is `'suggested'` (not already actioned)
- Confirm `loading` state is false

### Status not updating
- Check browser console for errors
- Verify `startup_investor_matches` table has `status` column
- Check Supabase RLS policies allow updates

### ai_logs not recording
- Confirm `ai_logs` table exists in Supabase
- Check for TypeScript errors (should have `@ts-ignore` comment)
- Verify Supabase RLS policies allow inserts

### ML agent not generating recommendations
- Need 50+ feedback events first (check count in `ai_logs`)
- Verify PM2 process running: `pm2 status ml-trainer`
- Check logs: `pm2 logs ml-trainer`

---

## Performance Considerations

### Database Indexes
Recommended indexes for performance:

```sql
-- Speed up match status queries
CREATE INDEX idx_match_status ON startup_investor_matches(status);

-- Speed up ML feedback queries
CREATE INDEX idx_ai_logs_type ON ai_logs(type, created_at);

-- Speed up startup-specific queries
CREATE INDEX idx_match_startup ON startup_investor_matches(startup_id, status);
```

### Caching Strategy
- Match statuses update in real-time (no cache)
- ML recommendations cached for 24 hours
- GOD scores recalculated on-demand (not real-time)

---

## Related Files

- [src/pages/DiscoveryResultsPage.tsx](src/pages/DiscoveryResultsPage.tsx) - Main UI implementation
- [server/services/mlTrainingService.ts](server/services/mlTrainingService.ts) - ML agent
- [ecosystem.config.js](ecosystem.config.js) - PM2 scheduler
- [PLAN_A_COMPLETE.md](PLAN_A_COMPLETE.md) - Full implementation details
- [ML_AGENT_STATUS_REPORT.md](ML_AGENT_STATUS_REPORT.md) - ML agent analysis

---

**Last Updated**: January 22, 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0.0
