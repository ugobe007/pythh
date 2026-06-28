# 🔥 FIRE POINTS GAMIFICATION SYSTEM

## Overview
The Fire Points system is a comprehensive gamification framework designed to increase investor engagement through rewards, perks, and progression mechanics.

## Core Features

### 1. Fire Points Economy
Investors earn points through various actions:
- **Vote YES**: +10 points
- **Vote NO**: +5 points
- **Daily Login**: +20 points
- **Weekly Streak**: +50 points
- **Share Deal**: +15 points
- **Complete Profile**: +100 points
- **First Investment**: +200 points
- **Refer Investor**: +150 points
- **Early Discovery**: +30 points (voting within first 24h)
- **Write Note**: +5 points
- **Random Bonus Card**: +25 points (with multipliers 1.5x-3x)

### 2. Tier System
Progressive tiers unlock as investors accumulate points:
- **Bronze**: 0 points (Starting tier)
- **Silver**: 500 points
- **Gold**: 2,000 points
- **Platinum**: 5,000 points
- **Diamond**: 10,000 points

### 3. Unlockable Perks

#### ⚡ Early Access (100 points)
- See newest startups 24 hours before other investors
- Get first pick on hot deals
- Priority in investment queues

#### 📝 Team Notes (250 points)
- Leave private notes on deals
- Tag team members for review
- Collaborative due diligence
- Searchable note history

#### 🤖 AI Scout (500 points)
- Daily personalized deal recommendations
- Custom search criteria:
  - Industries of interest
  - Funding stage preferences
  - Geographic regions
  - Keyword matching
- AI-powered matching algorithm
- Morning digest of relevant deals

#### 💎 Priority Support (1,000 points)
- Direct messaging to founders
- Priority access to deal rooms
- Expedited investment processing
- Dedicated support channel

#### 📊 Advanced Analytics (1,500 points)
- Deep portfolio insights
- Market trend analysis
- Comparative metrics
- Performance tracking
- Export capabilities

#### 👥 Syndicate Lead (3,000 points)
- Create investment syndicates
- Invite co-investors
- Lead deal negotiations
- Syndicate management tools

## Engagement Mechanics

### Random Bonus Cards
- **Trigger**: 20% chance on dashboard visit
- **Timing**: Appears 2 seconds after page load
- **Rewards**: 25 base points with multipliers (1.5x-3x)
- **Design**: Animated scratch-off style card
- **Effect**: Creates surprise & delight moments

### Daily Streaks
- Consecutive days of activity tracked
- Bonus points for maintaining streaks
- Visual streak counter on profile
- Resets if a day is missed

### Visual Feedback
- Toast notifications on point awards
- Animated celebrations for perk unlocks
- Progress bars to next tier
- Real-time point updates

## User Interface Components

### FirePointsWidget
Located on Dashboard, displays:
- Current total points
- Current tier with colored gradient
- Progress to next tier
- Daily streak counter
- Unlocked perks showcase
- Preview of locked perks

### BonusCard
Animated modal overlay featuring:
- Surprise reveal mechanic
- Point multiplier display
- Tier progression feedback
- Perk unlock notifications
- Falling emoji animations

### Toast Notifications
Bottom-right corner alerts for:
- Points earned per action
- Perk unlocks
- Tier upgrades
- Streak milestones

## Technical Implementation

### Storage
- `localStorage` key: `investorProfile`
- Persistent across sessions
- JSON serialized profile object
- Automatic initialization on first visit

### Profile Structure
```typescript
{
  userId: string,
  firePoints: {
    total: number,
    earnedToday: number,
    streak: number,
    lastActivity: ISO date string
  },
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond',
  perks: Array<Perk>,
  achievements: Array<Achievement>,
  teamNotes: Array<Note>,
  scoutPreferences?: ScoutConfig
}
```

### Integration Points
- **VotePage**: Awards points on each vote, shows toast
- **Dashboard**: Displays FirePointsWidget, triggers bonus cards
- **Profile Page**: Full gamification management (to be built)
- **AI Scout**: Daily recommendations based on preferences (to be built)

## Future Enhancements

### Achievements System
- "First Vote" badge
- "Early Bird" - vote on 10 startups in first 24h
- "Deal Maker" - 100 YES votes
- "Portfolio Builder" - invest in 5 startups
- "Streak Master" - 30 day streak
- "Social Butterfly" - refer 10 investors

### Leaderboards
- Weekly top point earners
- All-time rankings
- Industry-specific boards
- Syndicate performance

### Social Features
- Share achievements
- Challenge friends
- Team competitions
- Referral bonuses

### AI Scout Features
- Machine learning deal matching
- Sentiment analysis on startups
- Market trend predictions
- Risk assessment scores
- Automated due diligence summaries

### Team Notes Features
- @mentions for team members
- Note threading and discussions
- File attachments
- Deal room integration
- Activity feeds

## Engagement Strategy

### Psychology
- **Variable rewards**: Random bonus cards create anticipation
- **Progress visibility**: Clear tiers and progress bars
- **Social proof**: Leaderboards and achievements
- **Loss aversion**: Daily streaks encourage return visits
- **Competence**: Skill-based progression system
- **Autonomy**: Customizable AI scout preferences

### Metrics to Track
- Daily active users (DAU)
- Average points per user
- Perk unlock rates
- Streak retention
- Voting frequency
- Time on platform
- Return visit rate

### Optimization
- A/B test point values
- Monitor perk usage
- Adjust unlock thresholds
- Analyze engagement patterns
- Iterate on bonus card frequency

## Implementation Checklist

✅ Core gamification types
✅ Fire points manager utility
✅ Bonus card component
✅ Fire points widget component
✅ VotePage integration (point awards)
✅ Dashboard integration (widget + bonus cards)
✅ Toast notifications
⬜ Profile page with full gamification view
⬜ AI Scout functionality
⬜ Team Notes system
⬜ Achievements system
⬜ Leaderboards
⬜ Early access filtering
⬜ Admin analytics dashboard

## Navigation
- Dashboard button now clickable → returns to home page
- All pages maintain hamburger menu + page button pattern
