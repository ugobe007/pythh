# Route Inventory - Phase 5 Analysis

## Public Routes (Non-Admin)

### Landing & Core
- `/` → LandingPage
- `/home` → LandingPage (duplicate)
- `/get-matched` → GetMatchedPage
- `/checkout` → CheckoutPage
- `/get-matched/success` → SubscriptionSuccessPage

### Services & Tools
- `/services` → ServicesPage
- `/services/:slug` → ServiceDetailPage
- `/strategies` → StrategiesPage
- `/startup-tools` → StartupToolsPage
- `/investor-tools` → InvestorToolsPage

### Discovery & Matching
- `/trending` → TrendingPage
- `/discover` → TrendingPage (duplicate alias)
- `/matching-engine` → MatchingEngine
- `/matching` → MatchingEngine (duplicate)
- `/match` → MatchingEngine (duplicate)
- `/saved-matches` → SavedMatches
- `/startup/:startupId/matches` → StartupMatchSearch
- `/investor/:investorId/matches` → InvestorMatchSearch
- `/startup/:startupId/talent` → TalentMatchingPage
- `/talent-matching` → TalentMatchingHub
- `/market-intelligence` → MarketIntelligenceDashboard

### Voting (Legacy)
- `/vote-cards` → FrontPageNew
- `/vote` → VotePage
- `/vote-demo` → VoteDemo

### User Pages
- `/signup` → SignUpPage
- `/login` → Login
- `/profile` → ProfilePage
- `/feed` → Feed
- `/portfolio` → PortfolioPage
- `/settings` → Settings

### Startup Pages
- `/submit` → Submit
- `/upload` → UploadPage
- `/startup/:id` → StartupDetail
- `/deals` → Deals

### Investor Pages
- `/investors` → InvestorsPage
- `/investor/:id` → InvestorProfile
- `/investor/:id/edit` → EditInvestorPage
- `/invite-investor` → InviteInvestorPage

### Dashboard
- `/startups` → DashboardRouter (redirects)
- `/dashboard` → DashboardRouter (redirects)

### Analytics & Intelligence
- `/metrics` → MetricsDashboard
- `/analytics` → Analytics
- `/market-trends` → MarketTrends
- `/trends` → MarketTrends (duplicate alias)
- `/data-intelligence` → DataIntelligence
- `/demo` → LiveDemo

### Navigation
- `/navigation` → MasterNavigation
- `/sitemap` → MasterNavigation (duplicate alias)

### Static Pages
- `/about` → About
- `/privacy` → Privacy
- `/contact` → Contact

### Admin Shortcuts (Public)
- `/bulkupload` → BulkUpload (duplicate of /admin/bulk-upload)
- `/setup` → SetupPage (duplicate of /admin/setup)

## Admin Routes (`/admin/*`)

### Main Admin
- `/admin` → Redirects to `/admin/control`
- `/admin/control` → MasterControlCenter
- `/admin/review` → AdminReview
- `/admin/analytics` → AdminAnalytics
- `/admin/agent` → AgentDashboard
- `/admin/health` → SystemHealthDashboard
- `/admin/instructions` → AdminInstructions

### Data Management
- `/admin/discovered-startups` → DiscoveredStartups
- `/admin/discovered-investors` → DiscoveredInvestors
- `/admin/startups` → DiscoveredStartups (duplicate)
- `/admin/investors` → DiscoveredInvestors (duplicate)
- `/admin/edit-startups` → EditStartups
- `/admin/investors/add` → QuickAddInvestor
- `/admin/investor-enrichment` → InvestorEnrichmentPage

### Content Management
- `/admin/rss-manager` → RSSManager
- `/admin/bulk-upload` → BulkUpload
- `/admin/bulk-import` → BulkImport
- `/admin/document-upload` → DocumentUpload

### Scoring & Intelligence
- `/admin/god-scores` → GODScoresPage
- `/admin/ai-intelligence` → AIIntelligenceDashboard
- `/admin/ml-dashboard` → MLDashboard
- `/admin/ai-logs` → AILogsPage
- `/admin/talent-matching` → TalentMatchingHub

### Diagnostics
- `/admin/diagnostic` → DiagnosticPage
- `/admin/database-check` → DatabaseDiagnostic

### Legacy Redirects
- `/admin/operations` → Redirects to `/admin/control`
- `/admin/dashboard` → Redirects to `/admin/control`
- `/admin/command-center` → Redirects to `/admin/control`
- `/admin/legacy-dashboard` → AdminDashboard

### Migration Tools
- `/admin/setup` → SetupPage
- `/admin/sync` → SyncStartups
- `/admin/migrate` → MigrateLocalStorage
- `/admin/migrate-data` → MigrateStartupData

## Duplicate Routes Identified

### Exact Duplicates (Same Component)
1. `/home` = `/` (both → LandingPage)
2. `/discover` = `/trending` (both → TrendingPage)
3. `/matching` = `/matching-engine` = `/match` (all → MatchingEngine)
4. `/trends` = `/market-trends` (both → MarketTrends)
5. `/sitemap` = `/navigation` (both → MasterNavigation)
6. `/admin/startups` = `/admin/discovered-startups` (both → DiscoveredStartups)
7. `/admin/investors` = `/admin/discovered-investors` (both → DiscoveredInvestors)
8. `/bulkupload` = `/admin/bulk-upload` (both → BulkUpload)
9. `/setup` = `/admin/setup` (both → SetupPage)

## Recommendations

### Keep Canonical Paths
- `/` (not `/home`)
- `/trending` (not `/discover`)
- `/matching-engine` (not `/matching` or `/match`)
- `/market-trends` (not `/trends`)
- `/navigation` (not `/sitemap`)
- `/admin/discovered-startups` (not `/admin/startups`)
- `/admin/discovered-investors` (not `/admin/investors`)
- `/admin/bulk-upload` (not `/bulkupload`)
- `/admin/setup` (not `/setup`)

### Remove or Redirect
- Remove `/home` → redirect to `/`
- Remove `/discover` → redirect to `/trending`
- Remove `/matching` and `/match` → redirect to `/matching-engine`
- Remove `/trends` → redirect to `/market-trends`
- Remove `/sitemap` → redirect to `/navigation`
- Remove `/admin/startups` → redirect to `/admin/discovered-startups`
- Remove `/admin/investors` → redirect to `/admin/discovered-investors`
- Remove `/bulkupload` → redirect to `/admin/bulk-upload`
- Remove `/setup` → redirect to `/admin/setup`




