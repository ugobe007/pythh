# VOTING SYSTEM CLARIFICATION

## ⚠️ IMPORTANT DISTINCTION

### 👍👎 Thumbs Up/Down = SOCIAL EXPRESSION
- **NOT a vote** that counts toward stage advancement
- Social engagement feature (like/dislike)
- Purely for community sentiment
- Does NOT affect startup progression
- Does NOT trigger notifications

### 🗳️ Stage Voting = ACTUAL VOTING
- **THIS counts** toward stage advancement
- 5 YES votes → startup advances to next stage
- Triggers notifications to YES voters
- Part of formal investment evaluation process
- Tracked in `votes` table with `vote_type` field

---

## 🏗️ SYSTEM ARCHITECTURE

### Social Expression (Thumbs)
**Purpose:** Quick sentiment indicator
**Location:** 
- StartupCard components
- Startup detail pages
- Portfolio views

**Database:**
- May use separate `reactions` or `likes` table
- OR use `social_vote` field in votes table
- Does NOT count toward `vote_counts` view

**UI Indicators:**
- 👍 = "I like this"
- 👎 = "Not interested"
- Can be toggled freely
- No impact on deal flow

---

### Official Stage Voting
**Purpose:** Investment decision process
**Location:**
- Vote page (main voting interface)
- Dashboard voting interface
- Stage advancement workflow

**Database:**
- `votes` table with `vote_type` = 'yes' or 'no'
- Counts in `vote_counts` view
- Triggers `check_and_advance_stage()` function

**Business Logic:**
- **Stage 1→2:** 5 YES votes required
- **Stage 2→3:** 5 YES votes required
- **Stage 3→4:** 5 YES votes required
- **Stage 4→Closed:** 1 YES vote required
- NO votes do not block advancement (just sentiment)

**UI Indicators:**
- ✅ YES = "I want to invest"
- ❌ NO = "I pass"
- Triggers notifications
- Affects deal progression

---

## 🔧 IMPLEMENTATION REQUIREMENTS

### Need to Separate:
1. **Social Reactions** (Thumbs) - Light engagement
2. **Stage Votes** (YES/NO) - Investment decisions

### Recommended Schema Update:
```sql
-- Option 1: Separate tables
CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  startup_id TEXT NOT NULL,
  reaction_type TEXT, -- 'thumbs_up', 'thumbs_down'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, startup_id)
);

-- votes table remains for official voting only
-- NO trigger on reactions table

-- Option 2: Add field to distinguish
ALTER TABLE votes ADD COLUMN is_official_vote BOOLEAN DEFAULT true;
-- Trigger only counts rows where is_official_vote = true
```

---

## 📊 UI/UX DISTINCTION

### StartupCard
```tsx
// Social Expression (quick reaction)
<div className="social-reactions">
  <button onClick={handleThumbsUp}>👍 {thumbsUpCount}</button>
  <button onClick={handleThumbsDown}>👎 {thumbsDownCount}</button>
</div>

// Official Voting (separate, more prominent)
<div className="official-voting">
  <button onClick={handleOfficialYesVote}>
    ✅ YES - I Want to Invest
  </button>
  <button onClick={handleOfficialNoVote}>
    ❌ NO - I Pass
  </button>
</div>
```

### Vote Page
- Should ONLY show official voting buttons
- No thumbs up/down here
- Clear "This vote counts toward advancement" messaging

### StartupDetail Page
- Can show BOTH:
  - Social reactions at top (thumbs)
  - Official voting section below (YES/NO)
- Make distinction visually clear

---

## 🚨 CURRENT ISSUE

The current implementation treats thumbs up/down as official votes:
- `StartupCard.tsx` uses `useVotes` hook
- `handleVote()` calls `castVote()` 
- This triggers stage advancement logic ❌

### Fix Required:
1. Create separate `useReactions` hook for social thumbs
2. Update `StartupCard` to use reactions, not votes
3. Reserve `useVotes` for official voting interface only
4. Update stage advancement trigger to ignore reactions

---

## 🎯 NEXT STEPS

1. ⚠️ **STOP** - Do NOT deploy current SQL schema yet
2. Create `reactions` table (separate from votes)
3. Create `useReactions` hook for social expressions
4. Update `StartupCard.tsx` to use reactions instead of votes
5. Keep official voting on Vote page and Dashboard only
6. THEN deploy stage advancement system

---

## 💡 USER JOURNEY

### Casual Browser
1. Sees StartupCard
2. Clicks 👍 (social reaction)
3. No commitment, just interest

### Serious Investor
1. Goes to Vote page
2. Reviews full details
3. Clicks ✅ YES (official vote)
4. Contributes to stage advancement
5. Gets notifications when deal advances

---

## ✅ CORRECT IMPLEMENTATION

```typescript
// Social Expression Hook
export function useReactions(startupId: string) {
  // Track thumbs up/down
  // NO stage advancement
  // NO notifications
}

// Official Voting Hook (existing)
export function useVotes(startupId: string) {
  // Track YES/NO votes
  // Triggers stage advancement
  // Sends notifications
}
```

This separates casual engagement from investment decisions.
