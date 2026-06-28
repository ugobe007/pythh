# 🔧 Admin Tools Guide - Complete Reference

## Overview

The Admin Control Center (`/admin/control`) is organized into **9 main sections** focused on core platform activities. This guide explains what each tool does and how to use it.

---

## 📋 Table of Contents

1. [MEGA Scraper & Data Collection](#1-mega-scraper--data-collection)
2. [Database Tools](#2-database-tools)
3. [GOD Scoring System](#3-god-scoring-system)
4. [AI System & Activities](#4-ai-system--activities)
5. [Matching Engine](#5-matching-engine)
6. [ML Engine & Inferences](#6-ml-engine--inferences)
7. [Admin Edit Tools](#7-admin-edit-tools)
8. [User Access Control](#8-user-access-control)
9. [API & 3rd Party Services](#9-api--3rd-party-services)

---

## 1. MEGA Scraper & Data Collection

### Purpose
Automated discovery of startups and investors from RSS feeds, news sites, and web scraping.

### Tools

#### RSS Manager (`/admin/rss-manager`)
**What it does:**
- Manage RSS feed sources (TechCrunch, VentureBeat, etc.)
- Add/edit/delete RSS feeds
- Monitor scraping status

**How to use:**
1. Click "Add RSS Source"
2. Enter feed URL (e.g., `https://techcrunch.com/feed/`)
3. Save and enable
4. System automatically scrapes every 2 hours

**Recommended feeds:**
- TechCrunch: `https://techcrunch.com/feed/`
- VentureBeat: `https://venturebeat.com/feed/`
- Product Hunt: `https://www.producthunt.com/feed`

#### Discovered Startups (`/admin/discovered-startups`)
**What it does:**
- View startups found by RSS scraper
- Review and approve for import
- Bulk import to main database

**How to use:**
1. Review discovered startups
2. Select startups to import
3. Click "Import Selected"
4. Startups move to Review Queue

#### Discovered Investors (`/admin/discovered-investors`)
**What it does:**
- View investors found by web scraping
- Review investor profiles
- Import to investor directory

#### Automation Engine (`/admin/agent`)
**What it does:**
- Monitor all automated jobs (PM2, cron)
- View scraper status and logs
- Control automation schedules

---

## 2. Database Tools

### Purpose
Database management, health checks, and data quality monitoring.

### Tools

#### Database Setup (`/admin/setup`)
**What it does:**
- Initial database setup
- Seed data creation
- Duplicate management
- Table creation/verification

**When to use:**
- First-time setup
- After database migrations
- When tables are missing

#### Database Diagnostic (`/admin/diagnostic`)
**What it does:**
- System health check
- Table verification
- Connection testing
- Error diagnostics

**How to use:**
1. Click "Run Diagnostic"
2. Review results
3. Fix any errors shown

#### Data Quality Analytics (`/admin/analytics`)
**What it does:**
- Data gaps analysis
- Enrichment status
- Missing field tracking
- Quality metrics

**Key metrics:**
- Startups missing descriptions
- Startups missing sectors
- Investors missing data
- AI enrichment success rate

#### Data Sync (`/admin/sync`)
**What it does:**
- Sync data between tables
- Migrate data
- Update relationships

---

## 3. GOD Scoring System

### Purpose
Review and manage the proprietary GOD (GRIT + Opportunity + Determination) algorithm that scores startups 0-100.

### Tools

#### GOD Scores Dashboard (`/admin/god-scores`)
**What it does:**
- View all startup GOD scores
- See score rankings
- View score distribution
- Filter by score range

**Score Components:**
- **Team** (0-3): Technical co-founders, pedigree
- **Traction** (0-3): Revenue, growth, customers
- **Market** (0-2): Market size, problem importance
- **Product** (0-2): Demo, launch status
- **Vision** (0-2): Contrarian insights
- **Ecosystem** (0-1.5): Partners, advisors
- **Grit** (0-1.5): Pivots, iteration speed
- **Problem Validation** (0-2): Customer validation
- **Courage** (0-1.5): Risk-taking, bold decisions
- **Intelligence** (0-1.5): Strategic thinking

**Algorithm Location:**
- `/server/services/startupScoringService.ts`

#### GOD Algorithm Review
**What it does:**
- Review algorithm code
- See weight configurations
- Understand scoring logic

**How to review:**
1. Open `/server/services/startupScoringService.ts`
2. Review `calculateHotScore()` function
3. See how each component is scored
4. Adjust weights if needed

#### Score Breakdown Analysis
**What it does:**
- See how each component affects final score
- Compare startups side-by-side
- Identify scoring patterns

#### Recalculate Scores
**What it does:**
- Manually trigger score recalculation
- Update all startup scores
- Apply algorithm changes

**When to use:**
- After algorithm changes
- After bulk data import
- When scores seem outdated

---

## 4. AI System & Activities

### Purpose
Monitor AI operations, enrichment activities, and API usage.

### Tools

#### AI Intelligence Dashboard (`/admin/ai-intelligence`)
**What it does:**
- Overview of AI operations
- Success rates
- Token usage tracking
- Cost monitoring

**Key metrics:**
- Total AI operations
- Success rate
- Average tokens per operation
- Total costs

#### AI Activity Logs (`/admin/ai-logs`)
**What it does:**
- Detailed logs of all AI operations
- Enrichment history
- Extraction activities
- Error tracking

**What you'll see:**
- Startup enrichment operations
- Investor data extraction
- Document processing
- API call history

#### AI Agent Monitor (`/admin/agent`)
**What it does:**
- Monitor AI agent status
- Watchdog system health
- Auto-healing status

#### Token Usage & Costs
**What it does:**
- Track OpenAI API usage
- Track Anthropic API usage
- Calculate costs
- Set usage limits

---

## 5. Matching Engine

### Purpose
Live matching results, match quality analysis, and algorithm review.

### Tools

#### Matching Engine (Live) (`/matching`)
**What it does:**
- Live view of startup-investor matches
- Real-time match generation
- Match score display
- Save matches

**How it works:**
1. System loads 100 startups
2. Matches with all investors
3. Calculates match scores (0-100)
4. Displays top matches

**Match Score Formula:**
```
Base Score = GOD Score × 10
+ Stage Match Bonus (0-10)
+ Sector Match Bonus (0-15)
+ Check Size Fit Bonus (0-5)
+ Geography Match Bonus (0-5)
+ Investor Quality Bonus (0-10)
= Final Score (capped at 100)
```

#### Match Analytics (`/admin/analytics`)
**What it does:**
- Match statistics
- Quality distribution
- Success rates
- Sector analysis

#### Matching Algorithm Review
**What it does:**
- Review matching algorithm code
- See how scores are calculated
- Adjust weights

**Algorithm Location:**
- `/src/services/matchingService.ts`
- `calculateAdvancedMatchScore()` function

#### Saved Matches (`/saved-matches`)
**What it does:**
- View saved matches
- Export matches
- Manage match lists

---

## 6. ML Engine & Inferences

### Purpose
Machine learning training, recommendations, and performance insights.

### Tools

#### ML Dashboard (`/admin/ml-dashboard`)
**What it does:**
- ML training status
- Performance metrics
- Recommendations display
- Model accuracy tracking

**Key metrics:**
- Training accuracy
- Test accuracy
- Recommendation count
- Improvement over time

#### Run ML Training
**What it does:**
- Manually trigger ML training
- Improve matching algorithm
- Learn from match outcomes

**How to use:**
1. Go to ML Dashboard
2. Click "Run Training"
3. Wait for completion (5-10 minutes)
4. Review recommendations

**Training Process:**
1. Collects match outcomes
2. Extracts success patterns
3. Analyzes success factors
4. Generates recommendations
5. Tracks performance

#### ML Recommendations
**What it does:**
- View ML-generated recommendations
- See suggested weight adjustments
- Apply recommendations
- Track performance changes

**Example recommendations:**
- "Increase Team weight by 0.2"
- "Decrease Market weight by 0.1"
- "Add bonus for YC startups"

#### ML Performance Tracking
**What it does:**
- Track model performance over time
- See accuracy trends
- Monitor improvement

---

## 7. Admin Edit Tools

### Purpose
Full access to all site features: startups, VCs, MatchMarket, uploads, review pipeline.

### Tools

#### Edit Startups (`/admin/edit-startups`)
**What it does:**
- Approve/reject startups
- Edit startup data
- Bulk actions
- Status management

**Actions available:**
- Edit name, tagline, description
- Update sectors, stage
- Approve/reject
- Delete
- View matches
- Find talent

#### Edit Investors (`/investors`)
**What it does:**
- View investor directory
- Search investors
- Edit investor profiles
- Update investor data

#### Review Queue (`/admin/review`)
**What it does:**
- Review pending submissions
- Approve/reject startups
- Bulk approve
- Add notes

#### Bulk Import Startups (`/admin/bulk-import`)
**What it does:**
- Upload multiple startups
- Import from spreadsheet
- Import from URLs
- AI enrichment

**How to use:**
1. Paste URLs or upload CSV
2. Click "Import All"
3. System enriches with AI
4. Startups appear in Review Queue

#### Bulk Upload Investors (`/admin/bulk-upload`)
**What it does:**
- Upload multiple investors
- Import from spreadsheet
- Import from URLs
- AI enrichment

#### Add Single Investor (`/invite-investor`)
**What it does:**
- Add one investor at a time
- AI research and enrichment
- Quick submission form

#### Market Trends (`/market-trends`)
**What it does:**
- Sector analysis
- Supply/demand metrics
- Top performers
- Trend visualization

#### Trending Startups (`/trending`)
**What it does:**
- See trending startups
- Multiple ranking algorithms
- Real-time updates

#### Talent Matching (`/admin/talent-matching`)
**What it does:**
- Match founders with key hires
- Based on courage & intelligence
- View candidate matches

#### Market Intelligence (`/market-intelligence`)
**What it does:**
- Sector performance analytics
- Founder patterns
- Market insights

---

## 8. User Access Control

### Purpose
Manage user permissions, authentication, and site access restrictions.

### Tools

#### User Management (`/admin/setup`)
**What it does:**
- View all users
- Manage user roles
- Set permissions
- Enable/disable users

**User roles:**
- Admin: Full access
- User: Limited access
- Guest: Read-only

#### Access Control Settings
**What it does:**
- Configure page visibility
- Set tool access by role
- Lock down sensitive features

**Pages to lock down:**
- Admin Control Center
- GOD Scoring System
- ML Dashboard
- AI Logs
- Database Tools

#### Authentication Settings
**What it does:**
- Manage login system
- Configure signup
- Session settings
- Password policies

---

## 9. API & 3rd Party Services

### Purpose
Manage API keys, permissions, and integrations.

### Tools

#### API Keys Management (`/admin/setup`)
**What it does:**
- View all API keys
- Rotate keys
- Set permissions
- Monitor usage

**Services managed:**
- Supabase
- OpenAI
- Anthropic
- Stripe
- Slack
- Resend
- GitHub
- Fly.io

#### Supabase Configuration
**What it does:**
- Database connection settings
- RLS policies
- Table access
- Service role keys

#### OpenAI Configuration
**What it does:**
- API key management
- Model selection
- Token limits
- Usage tracking

#### Anthropic Configuration
**What it does:**
- Claude API key
- Usage tracking
- Model settings

#### Stripe Configuration
**What it does:**
- Payment processing
- Webhook setup
- Subscription management
- Test mode

#### Slack Integration
**What it does:**
- Webhook URLs
- Notifications
- Alerts
- Channel configuration

#### Resend Email Service
**What it does:**
- Email API key
- Templates
- Delivery tracking

#### GitHub Integration
**What it does:**
- Repository access
- Webhooks
- Deployment settings

#### Fly.io Configuration
**What it does:**
- Deployment settings
- Environment variables
- Scaling configuration

---

## 🔒 Access Control

### Admin-Only Tools
These tools require admin privileges:
- MEGA Scraper & Data Collection
- Database Tools
- AI System & Activities
- ML Engine & Inferences
- Admin Edit Tools
- User Access Control
- API & 3rd Party Services

### Authenticated User Tools
These tools require login:
- GOD Scoring System (view scores)
- Matching Engine (view matches)

### Public Tools
These are accessible to everyone:
- Matching Engine (limited view)
- Trending Startups
- Market Trends

---

## 🚀 Quick Start Workflow

### Daily Operations

1. **Check Discovered Startups** (`/admin/discovered-startups`)
   - Review new startups from RSS
   - Import promising ones

2. **Review Queue** (`/admin/review`)
   - Approve/reject pending startups
   - Bulk approve if needed

3. **Run Matching** (`/matching`)
   - Generate new matches
   - Review match quality

4. **Check ML Recommendations** (`/admin/ml-dashboard`)
   - Review ML suggestions
   - Apply if beneficial

5. **Monitor AI Activity** (`/admin/ai-logs`)
   - Check enrichment success
   - Review errors

### Weekly Tasks

1. **Run ML Training** (`/admin/ml-dashboard`)
   - Improve algorithm
   - Get recommendations

2. **Review GOD Scores** (`/admin/god-scores`)
   - Check score distribution
   - Identify outliers

3. **Database Health Check** (`/admin/diagnostic`)
   - Verify system health
   - Fix any issues

4. **Review API Usage** (`/admin/ai-intelligence`)
   - Check token usage
   - Monitor costs

---

## 📝 Notes

- All admin tools are accessible from `/admin/control`
- Tools are organized by function for easy navigation
- Admin-only tools are clearly marked
- Access control can be configured per tool
- API keys should be rotated regularly
- ML training should run weekly for best results

---

## 🆘 Troubleshooting

### Tool Not Loading
1. Check if you're logged in
2. Verify admin privileges
3. Check browser console for errors
4. Try hard refresh (Cmd+Shift+R)

### Can't Access Tool
1. Verify you have admin access
2. Check user role in database
3. Contact system administrator

### Data Not Updating
1. Check automation engine status
2. Verify database connection
3. Check for errors in logs

---

**Last Updated:** January 2025
**Version:** 2.0





