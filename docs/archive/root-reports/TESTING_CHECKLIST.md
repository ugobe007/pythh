# Match Search Testing Checklist ✅

## Pre-Testing Setup

### 1. Verify Environment Variables
```bash
# Check .env file has:
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
VITE_API_URL=http://localhost:3002  # or your API URL
```

### 2. Start the Backend Server
```bash
cd /Users/leguplabs/Desktop/hot-honey
npm run dev
# OR
node server/index.js
```

The server should start on port 3002 (or PORT from env).

### 3. Start the Frontend
```bash
# In another terminal
npm run dev
# Frontend should start on port 5173 (or Vite default)
```

---

## Test Cases

### Test 1: Get Test Data ✅

**Goal:** Find a startup and investor with matches to test with.

**Steps:**
1. Go to `/admin/edit-startups`
2. Find an approved startup with matches
3. Note the startup ID
4. Go to `/investors`
5. Find an investor
6. Note the investor ID

**Expected Result:**
- You have at least one startup ID and one investor ID
- Both have matches in the database

---

### Test 2: Startup Match Search Page ✅

**URL:** `/startup/{startupId}/matches`

**Test Cases:**

#### 2.1 Basic Page Load
- [ ] Page loads without errors
- [ ] Loading spinner shows initially
- [ ] Stats cards display correctly
- [ ] Match cards render (if matches exist)

#### 2.2 Smart Filtering
- [ ] Smart filtering notice appears (if applicable)
- [ ] Shows "top 25% or 60+" message
- [ ] "Show all matches" button works
- [ ] Filtered count vs total count is accurate

#### 2.3 Search Functionality
- [ ] Search bar filters matches by investor name
- [ ] Search bar filters matches by firm name
- [ ] Search bar filters matches by sector
- [ ] Search is case-insensitive
- [ ] Search updates in real-time

#### 2.4 Filter Panel
- [ ] Filter button toggles filter panel
- [ ] Min Score filter works
- [ ] Confidence Level filter works
- [ ] Investor Tier filter works
- [ ] Leads Rounds checkbox works
- [ ] Active Investor checkbox works
- [ ] Filters combine correctly (AND logic)

#### 2.5 Match Cards
- [ ] Match score displays correctly
- [ ] Confidence level badge shows correct color
- [ ] Investor name displays
- [ ] Investor firm displays
- [ ] Investor tier badge shows (if available)
- [ ] Sectors display
- [ ] Check size displays (if available)
- [ ] "Leads Rounds" indicator shows (if applicable)
- [ ] Reasoning preview shows
- [ ] Cards are clickable

#### 2.6 Match Details Modal
- [ ] Clicking a match card opens modal
- [ ] Modal shows full match score
- [ ] Modal shows investor details
- [ ] Modal shows reasoning
- [ ] "View LinkedIn" button works (if LinkedIn URL exists)
- [ ] "View Full Profile" button navigates correctly
- [ ] Close button (X) works

#### 2.7 Stats Dashboard
- [ ] Total Matches count is accurate
- [ ] High Confidence count is accurate
- [ ] Average Score is accurate
- [ ] Top Sector displays correctly
- [ ] Stats cards are clickable (if links exist)

#### 2.8 Export Functionality
- [ ] Export button is visible
- [ ] Clicking export downloads CSV file
- [ ] CSV file contains match data
- [ ] CSV file is properly formatted

#### 2.9 Error Handling
- [ ] Invalid startup ID shows error message
- [ ] Network error shows error message
- [ ] Error message has retry button
- [ ] Retry button works

#### 2.10 Empty States
- [ ] No matches shows helpful message
- [ ] Empty state suggests adjusting filters
- [ ] Empty state is visually clear

---

### Test 3: Investor Match Search Page ✅

**URL:** `/investor/{investorId}/matches`

**Test Cases:**

#### 3.1 Basic Page Load
- [ ] Page loads without errors
- [ ] Loading spinner shows initially
- [ ] Stats cards display correctly
- [ ] Match cards render (if matches exist)

#### 3.2 Search Functionality
- [ ] Search bar filters matches by startup name
- [ ] Search bar filters matches by sector
- [ ] Search bar filters matches by description
- [ ] Search is case-insensitive

#### 3.3 Filter Panel
- [ ] Filter button toggles filter panel
- [ ] Min Match Score filter works
- [ ] GOD Score Range filter works
- [ ] Confidence Level filter works
- [ ] Min MRR filter works
- [ ] Min Growth Rate filter works
- [ ] Has Revenue checkbox works
- [ ] Filters combine correctly

#### 3.4 Match Cards
- [ ] Match score displays correctly
- [ ] GOD score displays (if available)
- [ ] Startup name displays
- [ ] Startup tagline displays (if available)
- [ ] Stage displays correctly
- [ ] Sectors display
- [ ] Location displays (if available)
- [ ] MRR displays (if available)
- [ ] Growth rate displays (if available)
- [ ] Customer count displays (if available)
- [ ] Cards are clickable

#### 3.5 Match Details Modal
- [ ] Clicking a match card opens modal
- [ ] Modal shows full match score
- [ ] Modal shows startup details
- [ ] Modal shows GOD score
- [ ] Modal shows reasoning
- [ ] "Visit Website" button works (if website exists)
- [ ] "View Full Profile" button navigates correctly
- [ ] Close button (X) works

#### 3.6 Stats Dashboard
- [ ] Total Matches count is accurate
- [ ] High Confidence count is accurate
- [ ] Average GOD Score is accurate
- [ ] Average Match Score is accurate
- [ ] Stats cards are clickable (if links exist)

#### 3.7 Export Functionality
- [ ] Export button is visible
- [ ] Clicking export downloads CSV file
- [ ] CSV file contains match data

#### 3.8 Error Handling
- [ ] Invalid investor ID shows error message
- [ ] Network error shows error message
- [ ] Error message has retry button
- [ ] Retry button works

---

### Test 4: API Endpoints ✅

**Test the backend API directly:**

#### 4.1 Startup Matches Endpoint
```bash
# Test basic search
curl "http://localhost:3002/api/matches/startup/{startupId}?limit=10"

# Test with filters
curl "http://localhost:3002/api/matches/startup/{startupId}?minScore=60&confidenceLevel=high"

# Test smart filtering
curl "http://localhost:3002/api/matches/startup/{startupId}?showAll=false"

# Test show all
curl "http://localhost:3002/api/matches/startup/{startupId}?showAll=true"
```

**Expected:**
- [ ] Returns JSON with `success: true`
- [ ] `data.matches` is an array
- [ ] `data.total` is a number
- [ ] `data.filtered_total` is a number
- [ ] `data.limit_applied` is a boolean
- [ ] Matches have correct structure

#### 4.2 Startup Stats Endpoint
```bash
curl "http://localhost:3002/api/matches/startup/{startupId}/stats"
```

**Expected:**
- [ ] Returns JSON with `success: true`
- [ ] `data.total` is a number
- [ ] `data.highConfidence` is a number
- [ ] `data.averageScore` is a number
- [ ] `data.topSectors` is an array

#### 4.3 Investor Matches Endpoint
```bash
curl "http://localhost:3002/api/matches/investor/{investorId}?limit=10"
```

**Expected:**
- [ ] Returns JSON with `success: true`
- [ ] `data.matches` is an array
- [ ] Matches have correct structure

#### 4.4 Investor Stats Endpoint
```bash
curl "http://localhost:3002/api/matches/investor/{investorId}/stats"
```

**Expected:**
- [ ] Returns JSON with `success: true`
- [ ] Stats are accurate

---

### Test 5: Edge Cases ✅

#### 5.1 No Matches
- [ ] Startup with no matches shows empty state
- [ ] Investor with no matches shows empty state
- [ ] Empty state message is helpful

#### 5.2 Invalid IDs
- [ ] Invalid startup ID shows error
- [ ] Invalid investor ID shows error
- [ ] Error message is user-friendly

#### 5.3 Network Issues
- [ ] Offline state shows error
- [ ] Slow network shows loading state
- [ ] Retry works after network recovery

#### 5.4 Large Result Sets
- [ ] 100+ matches load correctly
- [ ] Pagination works (if implemented)
- [ ] Performance is acceptable

#### 5.5 Special Characters
- [ ] Startup names with special chars work
- [ ] Investor names with special chars work
- [ ] Search handles special chars correctly

---

### Test 6: Mobile Responsiveness ✅

- [ ] Page is usable on mobile
- [ ] Cards stack correctly
- [ ] Filter panel is accessible
- [ ] Modal is full-screen on mobile
- [ ] Touch interactions work

---

## Common Issues & Fixes

### Issue: "API error: 404"
**Fix:** Check that:
- Backend server is running
- API_BASE URL is correct
- Route is registered in server/index.js

### Issue: "supabaseUrl is required"
**Fix:** Check that:
- .env file exists
- VITE_SUPABASE_URL is set
- Environment variables are loaded

### Issue: "No matches found" but matches exist
**Fix:** Check that:
- Startup/Investor ID is correct
- Matches exist in database
- Smart filtering isn't too restrictive
- Try `showAll=true` parameter

### Issue: "Cannot read property 'matches' of undefined"
**Fix:** Check that:
- API response has `data` property
- API response has `success: true`
- Error handling catches this

---

## Testing Script

Run this to get test IDs:

```bash
node test-match-api.js
```

This will:
1. Find a startup with matches
2. Find an investor with matches
3. Test the match search service
4. Provide test URLs

---

## Success Criteria

✅ All test cases pass
✅ No console errors
✅ No TypeScript errors
✅ API responses are correct
✅ UI is responsive
✅ Error handling works
✅ Loading states work
✅ Empty states are helpful

---

## Next Steps After Testing

1. Fix any bugs found
2. Improve error messages
3. Add missing features
4. Optimize performance
5. Add analytics tracking

---

Happy Testing! 🚀





