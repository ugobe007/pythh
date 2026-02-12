# Oracle Retention & Engagement Strategy

**Version:** 1.0  
**Date:** February 12, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

**Problem:** Oracle has a "complete and forget" problem. Users finish the wizard, get insights, then never return.

**Solution:** Transform Oracle from a one-time assessment into a **continuous coaching platform** that delivers weekly value.

**Expected Impact:**
- **7-day retention:** 15% → 60% (+300%)
- **30-day retention:** 5% → 35% (+600%)  
- **Weekly active users:** New metric, target 40% of Oracle users
- **Action completion rate:** 20% → 65% (+225%)

---

## Core Retention Loops

### Loop 1: Weekly Insight Refresh (Primary Driver)

**Flow:**
```
Complete Wizard → Get Initial Insights
    ↓
  (Wait 7 days)
    ↓
Fresh Market Data + User Progress → Generate New Insights
    ↓
Email Digest (Monday 9am) → In-app Notification
    ↓
User Returns → Views Updated Dashboard → Takes Actions
    ↓
  (Repeat weekly)
```

**Content Formula:**
```javascript
weeklyInsights = {
  personalProgress: {
    scoreChange: "+8 points this week",
    actionsCompleted: "3/7 tasks done",
    rank: "Top 23% of seed-stage founders"
  },
  
  marketIntel: {
    trendingInvestors: "3 new VCs actively seeking fintech startups",
    competitorActivity: "Acme Inc raised $5M - here's their strategy",
    industryBenchmarks: "Avg seed round in your space: $2.1M (+15%)"
  },
  
  actionableGuidance: {
    thisWeekFocus: "Complete 2 high-impact tasks to reach 70+ score",
    quickWins: ["Update pitch deck metrics", "Add press mentions to website"],
    urgentItems: ["Schedule investor call (due Friday)"
  }
};
```

**Trigger Conditions:**
- User completed wizard at least 7 days ago
- User has < 100% action completion
- User has active session (not abandoned)

### Loop 2: Progressive Action System

**Gamification Mechanics:**

1. **Task Hierarchy**
   - **This Week** (5-7 tasks, short deadlines)
   - **This Month** (3-5 tasks, bigger impact)
   - **This Quarter** (1-3 strategic initiatives)

2. **Impact Scoring**
   - Each task shows **predicted score improvement**
   - Example: "Complete this → +5 points to fundraising score"

3. **Streaks & Momentum**
   ```
   🔥 7-day streak!
   You've checked in every day this week.
   Keep going to unlock "Investor Intro Request"
   ```

4. **Social Proof**
   ```
   ⚡ You're outpacing 73% of founders
   Founders who complete 5+ tasks/week get funded 2.3x faster
   ```

**Notification Triggers:**
- Task due in 48h → Email reminder
- Task due in 24h → Push notification
- Task completed → Celebration + next task suggestion
- Task overdue → Gentle nudge with context

### Loop 3: Score Evolution & Benchmarking

**Visualization:**
```
Your Fundraising Readiness Score

   ┌────────────────────────────────┐
75 │                            ╱───│ (Your trajectory)
   │                       ╱────    │
60 │                  ╱────         │
   │             ╱────              │
45 │        ╱────                   │
   │   ╱────                        │
30 │───                             │ (Industry avg)
   └────────────────────────────────┘
   Week 1    2    3    4    5    6

Breakdown:
- Team:      █████████░ 85/100 (+12 vs last week)
- Traction:  ██████░░░░ 60/100 (+5)
- Market:    ███████░░░ 72/100 (+3)
- Product:   ██████░░░░ 68/100 (no change)
- Execution: ████████░░ 75/100 (+7)

🎯 You're 7 points from "Fundable" tier (70+)
💡 Focus on Traction & Product to level up fastest
```

**Comparative Insights:**
- "You're in the **top 15% of seed-stage founders**"
- "Your growth rate (**+8 pts/week**) is **2x the average**"
- "Founders at your level typically raise within **6-8 weeks**"

### Loop 4: Market Intelligence Feed

**Weekly Market Updates:**

1. **Investor Activity**
   ```
   🎯 Hot This Week:
   - Sequoia announced new $500M seed fund
   - 3 VCs actively seeking fintech (match: 87%)
   - Average check size up 15% in your segment
   ```

2. **Competitor Tracking**
   ```
   📊 Your Space:
   - 5 fintech startups raised this week ($23M total)
   - "Acme Inc" got $5M from a16z - deck teardown →
   - Industry funding velocity: +23% vs last quarter
   ```

3. **Trend Alerts**
   ```
   🚨 Trending:
   - "AI-powered finance" mentions up 340% in investor blogs
   - Your positioning matches 3 trending investor theses
   - Time to strike: Spring fundraising season peaks in March
   ```

### Loop 5: Milestone Celebrations

**Achievement System:**

```javascript
const milestones = [
  { 
    id: "wizard_complete",
    title: "Oracle Initiated",
    reward: "Unlocked: Weekly Insights",
    nextMilestone: "Complete 3 actions"
  },
  {
    id: "first_3_actions",
    title: "Action Taker",
    reward: "Unlocked: Investor Matching (Beta)",
    nextMilestone: "Reach 60+ score"
  },
  {
    id: "score_60",
    title: "Fundable Founder",
    reward: "Unlocked: Premium Insights",
    celebrationModal: true
  },
  {
    id: "7_day_streak",
    title: "Committed",
    reward: "Priority support access",
    badge: "🔥"
  },
  {
    id: "score_80",
    title: "Investor Ready",
    reward: "VIP Intro to 3 matching investors",
    celebrationModal: true,
    confetti: true
  }
];
```

**Celebration UX:**
- Modal overlay with animation
- Confetti effect for major milestones
- "Share" button → LinkedIn post template
- Show next milestone (breadcrumb trail)

---

## Email Drip Campaign

### Post-Wizard Sequence

**Day 0: Welcome**
```
Subject: 🎯 Your Oracle Dashboard is Ready

Hi [Name],

You've completed the Oracle wizard! Here's what you unlocked:

📊 Your Score: 54/100 (Seed-stage avg: 48)
💡 Insights: 7 personalized recommendations
✅ Actions: 5 high-impact tasks (start with these 2)

Your top priority this week:
1. Add traction metrics to pitch deck → +6 points
2. Highlight founder credentials → +4 points

[View Dashboard →]

- The Oracle
```

**Day 3: Quick Win Nudge**
```
Subject: ⚡ Quick win: 10 minutes to +5 points

[Name], founders who take early action see 2x better outcomes.

You're 73% of the way through your first action item.
Finish it now → unlock your next insight.

[Complete Action →]

P.S. You're already ahead of 58% of founders 🚀
```

**Day 7: First Weekly Digest**
```
Subject: 📈 Your Week in Review + 3 new insights

Your Progress:
- Score: 54 → 59 (+5) 🔥
- Actions: 2/5 completed
- Rank: Top 42% → Top 31% ⬆️

Fresh This Week:
🎯 3 VCs seeking fintech startups (87% match)
💡 New insight: Your pricing model needs validation
⚡ Quick win: Add customer testimonial (+3 points)

[View Full Dashboard →]
```

**Day 14: Momentum Check**
```
Subject: 🔥 You're on fire - keep it going

2 weeks in and you're crushing it:

✅ 4/7 actions completed
📈 +12 points (2x the average)
🎯 Unlocked: Investor matching

Founders at your pace typically:
- Raise within 6-8 weeks
- Get 2-3x more investor meetings
- Close at higher valuations

Your next milestone: Reach 70+ score
[2 tasks away →]
```

**Day 21: Social Proof**
```
Subject: What 80+ score founders do differently

[Name], you're at 66/100.

Here's what founders above 70 have in common:

1. They complete 5+ actions/week (you: 3)
2. They check their dashboard 3x/week (you: 1.5x)
3. They leverage our investor intros (you: not yet!)

The gap is small. Here's how to close it:
[3-Step Action Plan →]
```

**Day 30: Transformation Story**
```
Subject: 📊 Your 30-day Oracle journey

Look how far you've come:

             Week 1  →  Week 4
Score:         54   →    71    (+17) 🎉
Actions:       0/7  →    6/7   
Rank:         Top 58% → Top 12% 🚀

Your next chapter:
- [ ] Schedule 3 investor calls
- [ ] Join our next founder cohort (March 15)
- [ ] Request warm intro to [matched VC]

You're investor-ready. Let's make it happen.
[Book Strategy Call →]
```

---

## Technical Implementation

### Phase 1: Foundation (Week 1-2)

**1.1 Database Schema**
- ✅ Run migration `012_oracle_engagement_system.sql`
- Tables: notifications, score_history, digest_schedule, engagement_events, milestones

**1.2 Background Jobs**
```javascript
// ecosystem.config.js
{
  name: 'oracle-weekly-refresh',
  script: 'server/jobs/oracle-weekly-refresh.js',
  cron_restart: '0 20 * * 0' // Sunday 8pm
}

{
  name: 'oracle-digest-sender',
  script: 'server/jobs/oracle-digest-sender.js',
  cron_restart: '0 9 * * 1' // Monday 9am
}

{
  name: 'oracle-notification-manager',
  script: 'server/jobs/oracle-notification-manager.js',
  cron_restart: '*/15 * * * *' // Every 15 min
}
```

**1.3 API Endpoints**
```javascript
// server/routes/oracle-engagement.js

GET   /api/oracle/notifications        // List user's notifications
POST  /api/oracle/notifications/read   // Mark as read
GET   /api/oracle/notifications/count  // Unread count (for badge)

GET   /api/oracle/score-history        // Historical scores
POST  /api/oracle/score-history        // Record new score

GET   /api/oracle/milestones           // User achievements
POST  /api/oracle/milestones/celebrate // Mark as celebrated

GET   /api/oracle/digest/preferences   // Email settings
PUT   /api/oracle/digest/preferences   // Update settings

POST  /api/oracle/events               // Track engagement
```

### Phase 2: Core Features (Week 3-4)

**2.1 Weekly Insight Refresh**
```javascript
// server/jobs/oracle-weekly-refresh.js

const refreshInsights = async () => {
  // Find users due for refresh (last insights > 7 days old)
  const users = await getEligibleUsers();
  
  for (const user of users) {
    const sessionData = oracleMemory.getSession(user.activeSessionId) ||
                        await loadFromDatabase(user.activeSessionId);
    
    // Generate fresh insights
    const insights = await generateFreshInsights({
      session: sessionData,
      marketData: await fetchMarketUpdates(user.industry),
      competitorActivity: await fetchCompetitorActivity(user.industry),
      userProgress: await calculateProgress(user.id)
    });
    
    // Save to database
    await saveInsights(insights);
    
    // Create notification
    await createNotification({
      userId: user.id,
      type: 'new_insight',
      title: '📈 Your weekly insights are ready',
      message: `${insights.length} new recommendations based on this week's market activity`
    });
  }
};
```

**2.2 Notification System**
```javascript
// Frontend: src/components/NotificationBell.tsx

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    // Poll every 30 seconds
    const interval = setInterval(async () => {
      const count = await oracleApi.getUnreadCount();
      setUnreadCount(count);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <button onClick={showNotifications}>
      <Bell />
      {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
    </button>
  );
};
```

**2.3 Score Tracking Chart**
```javascript
// src/components/ScoreProgressChart.tsx

const ScoreProgressChart = () => {
  const history = useQuery('scoreHistory', oracleApi.getScoreHistory);
  
  return (
    <LineChart data={history}>
      <Line dataKey="total_score" stroke="#10b981" />
      <ReferenceLine y={70} label="Fundable" stroke="#f59e0b" />
      <Tooltip content={<CustomTooltip />} />
    </LineChart>
  );
};
```

### Phase 3: Email System (Week 5-6)

**3.1 Digest Generator**
```javascript
// server/lib/digestGenerator.js

const generateWeeklyDigest = async (userId) => {
  const [scoreChange, insights, actions, marketUpdates] = await Promise.all([
    getScoreChange(userId, 'week'),
    getNewInsights(userId),
    getPendingActions(userId),
    getMarketUpdates(userId)
  ]);
  
  return renderTemplate('weekly-digest', {
    user: { name: user.name },
    summary: {
      scoreChange: scoreChange.delta,
      newInsights: insights.length,
      actionsCompleted: actions.completed.length,
      rank: await getUserRank(userId)
    },
    insights: insights.slice(0, 3),  // Top 3
    actions: actions.pending.slice(0, 2),  // Next 2
    marketUpdates: marketUpdates.slice(0, 2)
  });
};
```

**3.2 Send via Resend/SendGrid**
```javascript
// server/jobs/oracle-digest-sender.js

const sendDigests = async () => {
  const schedules = await getScheduledDigests();
  
  for (const schedule of schedules) {
    const html = await generateWeeklyDigest(schedule.user_id);
    
    await resend.emails.send({
      from: 'Oracle <oracle@pythai.ai>',
      to: schedule.user_email,
      subject: '📈 Your Week in Review + 3 new insights',
      html
    });
    
    await updateSchedule(schedule.id, {
      last_sent_at: new Date(),
      next_scheduled_at: addDays(new Date(), 7)
    });
  }
};
```

### Phase 4: Gamification (Week 7-8)

**4.1 Milestone Checker**
```javascript
// server/lib/milestoneChecker.js

const checkMilestones = async (userId, eventType) => {
  const achievements = {
    wizard_complete: () => hasCompletedWizard(userId),
    first_3_actions: () => getCompletedActions(userId) >= 3,
    score_60: () => getCurrentScore(userId) >= 60,
    score_70: () => getCurrentScore(userId) >= 70,
    score_80: () => getCurrentScore(userId) >= 80,
    '7_day_streak': () => getConsecutiveDays(userId) >= 7,
    '5_actions_week': () => getActionsThisWeek(userId) >= 5
  };
  
  for (const [type, checkFn] of Object.entries(achievements)) {
    if (await checkFn() && !await hasAchieved(userId, type)) {
      await recordMilestone(userId, type);
      await showCelebration(userId, type);
    }
  }
};
```

---

## Metrics & Success Criteria

### North Star Metric
**Weekly Active Oracle Users (WAOU)**
- Target: 40% of users who completed wizard

### Supporting Metrics

| Metric | Current | Target (3 months) | Measurement |
|--------|---------|-------------------|-------------|
| 7-day retention | 15% | 60% | % returning within 7 days |
| 30-day retention | 5% | 35% | % returning within 30 days |
| Action completion rate | 20% | 65% | % who complete 5+ actions |
| Email open rate | N/A | 45% | Weekly digest opens |
| Notification CTR | N/A | 25% | In-app notification clicks |
| Score improvement | N/A | +15 pts avg | 30-day score delta |
| Time to fundraise | N/A | Track | Days from Oracle → funded |

### Cohort Analysis

Track weekly cohorts:
```
Cohort: Feb 12-18, 2026
- Users: 47 completed wizard
- Week 1 return: 28 (60%)
- Week 2 return: 22 (47%)
- Week 3 return: 18 (38%)
- Week 4 return: 16 (34%)

Actions completed:
- 0 actions: 8 users (17%)
- 1-3 actions: 15 users (32%)
- 4-6 actions: 18 users (38%)
- 7+ actions: 6 users (13%) ← Best cohort
```

---

## Prioritized Roadmap

### MVP (Launch in 2-3 weeks)
1. ✅ Database schema (migration 012)
2. Weekly insight refresh job
3. Basic in-app notifications
4. Score history tracking
5. Simple email digest

### V2 (Month 2)
6. Action item reminders
7. Milestone celebrations
8. Market intelligence feed
9. Advanced email templates
10. Notification preferences

### V3 (Month 3)
11. Competitive benchmarking
12. Founder cohorts (social)
13. Streak mechanics
14. Push notifications (web/mobile)
15. Investor activity alerts

---

## Launch Checklist

**Week 1: Database & Jobs**
- [ ] Run migration 012 in Supabase
- [ ] Create oracle-weekly-refresh.js job
- [ ] Create oracle-digest-sender.js job
- [ ] Test on staging with dummy data

**Week 2: Frontend Integration**
- [ ] Build NotificationBell component
- [ ] Add score history chart to dashboard
- [ ] Create notification list page
- [ ] Test notification flows

**Week 3: Email System**
- [ ] Design digest email template
- [ ] Integrate Resend/SendGrid
- [ ] Build digest preferences page
- [ ] Send test digests to team

**Week 4: Launch & Monitor**
- [ ] Enable for 10% of users (beta)
- [ ] Monitor metrics daily
- [ ] Collect user feedback
- [ ] Full rollout if metrics hit targets

---

## Open Questions

1. **Frequency**: Weekly or bi-weekly digest? (Test both)
2. **Timing**: Monday 9am or Sunday evening? (A/B test)
3. **Tone**: Professional or casual? (User research needed)
4. **Monetization**: Premium insights behind paywall? (Future consideration)
5. **Social**: Founder leaderboard or keep private? (Privacy concerns)

---

## Success Stories (Projected)

**3 months post-launch:**

> "Oracle keeps me accountable. The weekly insights helped me spot gaps I didn't see. We raised $2M in 6 weeks."  
> — Sarah K., Fintech Founder

> "The action items are like having a co-founder who's raised money before. I went from 54 → 78 in a month."  
> — Michael R., B2B SaaS

> "I check Oracle every Monday. It's become part of my routine. The market updates alone are worth it."  
> — Jessica T., HealthTech Founder

---

**Next Step:** Run migration 012, then build weekly-refresh job. This will take Oracle from one-time tool to continuous platform. 🚀
