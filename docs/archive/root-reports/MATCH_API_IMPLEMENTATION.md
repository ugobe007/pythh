# Match API Implementation Guide 🚀

## Smart Filtering for Startups

**Question:** Should startups see top 25% matches or all matches above a threshold?

**Answer:** **Hybrid Approach - Smart Default**

### Implementation

**Default Behavior:**
- Shows **top 25% of matches OR matches above 60** (whichever is more restrictive)
- Prevents overwhelming users with too many matches
- Ensures quality by focusing on best matches

**User Control:**
- Users can expand by setting `showAll=true` query parameter
- Users can set custom `minScore` to see more/fewer matches
- Users can adjust filters to refine results

### Example API Calls

```bash
# Default: Smart filtering (top 25% or 60+, whichever is higher)
GET /api/matches/startup/{startupId}

# Show all matches above threshold (bypass smart filtering)
GET /api/matches/startup/{startupId}?showAll=true

# Custom minimum score
GET /api/matches/startup/{startupId}?minScore=70

# Filtered search with smart default
GET /api/matches/startup/{startupId}?investorTier=elite&leadsRounds=true
```

### Response Format

```json
{
  "success": true,
  "data": {
    "matches": [...],
    "total": 200,           // Total matches before filtering
    "filtered_total": 50,   // Matches after smart filtering
    "limit_applied": true   // Whether smart limit was applied
  },
  "message": "Showing top 25% of matches or matches above 60 (whichever is higher). Use showAll=true to see all matches."
}
```

---

## API Endpoints

### Startup Match Routes

#### `GET /api/matches/startup/:startupId`
Search matches with filters

**Query Parameters:**
- `minScore` - Minimum match score (default: smart filter)
- `maxScore` - Maximum match score (default: 100)
- `confidenceLevel` - high | medium | low
- `investorTier` - elite | strong | emerging
- `leadsRounds` - true | false
- `activeInvestor` - true | false
- `sectors` - comma-separated list
- `stage` - comma-separated list
- `geography` - comma-separated list
- `minCheckSize` - Minimum check size in USD
- `maxCheckSize` - Maximum check size in USD
- `portfolioFit` - similar | complementary | gap | any
- `sortBy` - score | recent | investor_tier | check_size
- `sortOrder` - asc | desc
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)
- `showAll` - true to bypass smart filtering

#### `GET /api/matches/startup/:startupId/stats`
Get match statistics

#### `GET /api/matches/startup/:startupId/top`
Get top matches (simplified)

#### `GET /api/matches/startup/:startupId/insights`
Get AI-powered insights

#### `GET /api/matches/startup/:startupId/report`
Generate comprehensive report

### Investor Match Routes

#### `GET /api/matches/investor/:investorId`
Search matches with filters

**Query Parameters:**
- `minScore` - Minimum match score
- `minGODScore` - Minimum GOD score
- `godScoreRange` - elite | high | quality | good | any
- `hasRevenue` - true | false
- `minMRR` - Minimum MRR
- `minARR` - Minimum ARR
- `minGrowthRate` - Minimum growth rate %
- `minCustomers` - Minimum customer count
- `minTeamSize` - Minimum team size
- `sectors` - comma-separated list
- `stage` - comma-separated list
- `geography` - comma-separated list
- `sortBy` - score | recent | god_score | traction | stage
- `limit` - Number of results
- `offset` - Pagination offset

#### `GET /api/matches/investor/:investorId/stats`
Get match statistics

#### `GET /api/matches/investor/:investorId/top`
Get top matches

#### `GET /api/matches/investor/:investorId/insights`
Get AI-powered insights

#### `GET /api/matches/investor/:investorId/report`
Generate comprehensive report

### Investigation Routes

#### `GET /api/matches/:matchId/breakdown`
Get detailed score breakdown

#### `GET /api/matches/:matchId/fit`
Get comprehensive fit analysis

#### `GET /api/matches/portfolio/:investorId/:startupId`
Get portfolio analysis

### Trends & Reports

#### `GET /api/matches/:entityType/:entityId/trends?days=30`
Get match trends over time

#### `GET /api/matches/:entityType/:entityId/export`
Export matches to CSV

---

## Implementation Status

### ✅ Completed
- Smart filtering logic for startups
- API routes structure
- JavaScript wrapper for CommonJS compatibility
- Basic search and filtering

### 🚧 In Progress
- Full TypeScript service integration
- Frontend components
- Advanced filtering features

### 📋 TODO
- Complete JavaScript implementations for all services
- Add authentication/authorization
- Add rate limiting
- Add caching
- Frontend UI components

---

## Next Steps

1. **Complete Service Implementations**: Finish JavaScript versions or set up TypeScript compilation
2. **Frontend Components**: Create React components for match search/filtering
3. **Testing**: Add unit tests and integration tests
4. **Documentation**: Add API documentation (Swagger/OpenAPI)
5. **Authentication**: Add user authentication to routes

---

## Notes

- **TypeScript Services**: The full TypeScript services exist in `server/services/*.ts`
- **JavaScript Wrapper**: `server/services/matchServices.js` provides CommonJS compatibility
- **Production**: For production, compile TypeScript to JavaScript or use ts-node/tsx





