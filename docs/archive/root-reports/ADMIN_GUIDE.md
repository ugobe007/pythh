# Hot Money Honey - Administrator Guide

## 🎯 System Overview

Hot Money Honey is an investor-startup matching platform with AI-powered research capabilities. This guide explains the complete workflow for managing investors and startup submissions.

---

## 📋 Table of Contents

1. [Database Setup](#database-setup)
2. [Investor Management](#investor-management)
3. [Startup Upload System](#startup-upload-system)
4. [AI Research Features](#ai-research-features)
5. [Admin Navigation](#admin-navigation)
6. [Troubleshooting](#troubleshooting)

---

## 🗄️ Database Setup

### Initial Setup (One-Time)

1. **Run SQL Migrations** (in order):
   - `supabase/test_connection.sql` - Test database connectivity
   - `supabase/migrations/step1_create_investors.sql` - Create investors table
   - `supabase/migrations/step2_create_uploads.sql` - Create startup_uploads table
   - `supabase/migrations/step3_create_indexes.sql` - Add performance indexes
   - `supabase/migrations/step4_triggers_rls.sql` - Add triggers and enable RLS
   - `supabase/migrations/step5_policies.sql` - Create RLS policies

2. **Seed Initial Data**:
   - Visit: `http://localhost:5173/setup`
   - Click **"🚀 Seed Investor Data"**
   - This adds 5 sample investors (Y Combinator, a16z, Sequoia, Techstars, Founders Fund)

3. **Environment Variables Required**:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   ```

---

## 👥 Investor Management

### Investor Workflow

```
┌─────────────────┐
│  View Investors │ (/investors)
│  Directory      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────┐
│ Add   │  │ Edit │
│ New   │  │ Card │
└───┬───┘  └──┬───┘
    │         │
    ▼         ▼
┌─────────────────┐
│ Investor Form   │
│ - Basic Info    │
│ - URLs          │
│ - Financials    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Research     │
│ (Optional)      │
│ - Auto-fill     │
│ - Missing data  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review & Save   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Live in         │
│ Directory       │
└─────────────────┘
```

### Adding New Investors

**Method 1: Via Setup Page**
1. Go to: `http://localhost:5173/setup`
2. Click **"✚ Add New Investor"** (green button)

**Method 2: Via Admin Panel**
1. Look for red **"🔐 ADMIN"** panel (bottom-right)
2. Click **"✚ Add Investor"**

**Method 3: Via Investor Directory**
1. Go to: `http://localhost:5173/investors`
2. Click **"✚ Invite New Investor"** (green button at top)

### Investor Form Fields

**Required:**
- Name (e.g., "Benchmark Capital")
- Type (VC Firm, Accelerator, Angel Network, Corporate VC)
- Website URL (needed for AI research)

**Optional but Recommended:**
- Tagline
- Description
- LinkedIn URL
- Twitter handle
- Contact email
- Check size
- Geography

**AI Auto-Filled:**
- AUM (Assets Under Management)
- Fund size
- Investment stages
- Sectors/Industries
- Portfolio count
- Number of exits
- Unicorns backed
- Notable investments

### Using AI Research

**When Adding New Investor:**
1. Fill in: Name, Type, and Website URL (minimum)
2. Click **"✨ Research with AI"** button
3. Wait ~5-10 seconds for AI to analyze the website
4. Review auto-filled data
5. Make any corrections
6. Click **Submit**

**When Editing Existing Investor:**
1. Click **"✏️ Edit Profile"** on investor card
2. Review existing data
3. Click **"✨ Fill Missing Data with AI"**
4. AI will only fill empty fields (won't overwrite)
5. Review and save

### Editing Investors

1. Go to: `http://localhost:5173/investors`
2. Find the investor card
3. Click **"✏️ Edit Profile"** (purple button)
4. Update any fields
5. Use AI to fill missing data (optional)
6. Click **"💾 Save Changes"**

### Managing Duplicates

**Check for Duplicates:**
1. Go to: `http://localhost:5173/setup`
2. Scroll to **"🔍 Manage Duplicates"** section
3. Click **"Check for Duplicates"**
4. System shows duplicate names with creation dates

**Remove Duplicates:**
1. After checking, click **"🗑️ Remove Duplicates"**
2. Confirm the action
3. System keeps oldest entry per name, deletes newer ones
4. List auto-refreshes to show remaining duplicates

---

## 🚀 Startup Upload System

### Startup Submission Workflow

```
┌─────────────────┐
│  Upload Page    │ (/upload)
└────────┬────────┘
         │
    ┌────┴─────┬──────────┐
    │          │          │
    ▼          ▼          ▼
┌───────┐  ┌──────┐  ┌────────┐
│  URL  │  │ Deck │  │ Manual │
│ Paste │  │ PDF  │  │  Form  │
└───┬───┘  └──┬───┘  └────┬───┘
    │         │           │
    └─────────┴───────────┘
              │
              ▼
    ┌─────────────────┐
    │ Extract Data    │
    │ - Name          │
    │ - Description   │
    │ - Stage         │
    │ - Raise Amount  │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Review Data     │
    │ (Preview)       │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Submit to DB    │
    │ Status: PENDING │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Admin Review    │
    │ Queue           │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐      ┌──────────┐
│ Approve │      │  Reject  │
└────┬────┘      └────┬─────┘
     │                │
     ▼                ▼
┌─────────┐      ┌──────────┐
│Published│      │ Archived │
└─────────┘      └──────────┘
```

### Three Upload Methods

**1. URL Submission**
- User pastes startup website URL
- System scrapes website data (TODO: Not yet implemented)
- Currently shows placeholder extraction
- Best for: Quick submissions

**2. Pitch Deck Upload**
- User uploads PDF pitch deck
- System extracts text and data (TODO: Not yet implemented)
- Currently shows placeholder extraction
- Best for: Detailed submissions with existing decks

**3. Manual Entry**
- User fills out complete form
- Direct data entry
- Fully functional
- Best for: Maximum control and accuracy

### Startup Data Fields

**Captured:**
- Company name
- Tagline
- Description/Pitch
- Website URL
- LinkedIn URL
- Raise amount
- Raise type (Seed, Series A, etc.)
- Stage (1-10 scale)
- Source type (url/deck/manual)
- Source URL (if applicable)
- Deck filename (if uploaded)

**Metadata:**
- Submitter name
- Submitter email
- Submission date
- Status (pending/reviewing/approved/rejected/published)
- Admin notes

### Admin Review Process

**Access Review Queue:**
1. Click **"📋 Review Queue"** in Admin panel
2. Or visit: `http://localhost:5173/admin/review`

**Review Actions:**
- **Approve** → Status: "approved" → Visible to investors
- **Reject** → Status: "rejected" → Not shown
- **Edit** → Modify submission details
- **Add Notes** → Internal admin comments

---

## 🤖 AI Research Features

### OpenAI Integration

**Model:** GPT-4o-mini
**Purpose:** Automatically research and extract investor data
**Cost:** ~$0.001-0.002 per investor research

### What AI Extracts

1. **Basic Info:**
   - Investor name (if not provided)
   - Tagline/motto
   - Description/investment philosophy

2. **Contact Info:**
   - Twitter handle
   - Contact email

3. **Financial Data:**
   - AUM (Assets Under Management)
   - Fund size
   - Typical check size

4. **Investment Focus:**
   - Investment stages (array)
   - Sectors/industries (array)
   - Geography

5. **Track Record:**
   - Portfolio company count
   - Number of exits
   - Unicorns backed
   - Notable investments (array)

### AI Research Best Practices

**Do:**
- ✅ Provide website URL (required)
- ✅ Provide LinkedIn URL (helps)
- ✅ Review AI results before saving
- ✅ Use for filling missing data on existing profiles
- ✅ Correct any inaccuracies manually

**Don't:**
- ❌ Trust AI blindly - always review
- ❌ Use without website URL
- ❌ Skip manual verification
- ❌ Submit without reviewing auto-filled data

### AI Accuracy Notes

- **High Accuracy:** Name, tagline, description, website, LinkedIn
- **Medium Accuracy:** Check size, stages, sectors, geography
- **Variable Accuracy:** Portfolio count, exits, unicorns (depends on website data)
- **Low Accuracy:** Contact emails (often not publicly listed)

---

## 🎛️ Admin Navigation

### Admin Panel Location

**Visible on these pages:**
- Home (`/`)
- Investors Directory (`/investors`)
- Setup Page (`/setup`)
- Invite Investor (`/invite-investor`)

**Panel Features:**
- Red panel in bottom-right corner
- Always accessible
- Three main links

### Admin Panel Links

```
┌─────────────────────┐
│   🔐 ADMIN          │
├─────────────────────┤
│ 🔧 DB Setup         │ → /setup
│ ✚ Add Investor      │ → /invite-investor
│ 📋 Review Queue     │ → /admin/review
└─────────────────────┘
```

### Key Admin Pages

| Page | URL | Purpose |
|------|-----|---------|
| **Database Setup** | `/setup` | Seed data, manage duplicates |
| **Investor Directory** | `/investors` | View all investors, search, filter |
| **Add Investor** | `/invite-investor` | Add new investors with AI |
| **Edit Investor** | `/investor/:id/edit` | Edit investor profiles |
| **Upload Startup** | `/upload` | Submit new startups |
| **Review Queue** | `/admin/review` | Review pending startups |
| **Analytics** | `/analytics` | View system analytics |

---

## 🔧 Troubleshooting

### Common Issues

**1. "Error loading investor"**
- **Cause:** ID mismatch (number vs UUID)
- **Fix:** Already fixed - investor IDs now support both
- **Verify:** Click any investor card's "Edit" button

**2. "Cannot remove duplicates"**
- **Cause:** Missing DELETE policy in database
- **Fix:** Run `supabase/fix_delete_policy.sql`
- **Verify:** Check for duplicates, then remove

**3. "AI research not working"**
- **Cause:** Missing OpenAI API key
- **Fix:** Add `VITE_OPENAI_API_KEY` to `.env`
- **Verify:** Try researching any investor with a website

**4. "No investors showing"**
- **Cause:** Database not seeded or connection issue
- **Fix:** Visit `/setup` and seed data
- **Verify:** Check Supabase dashboard for data

**5. "Startup upload not working"**
- **Cause:** URL scraping/PDF parsing not implemented
- **Status:** Use Manual Entry method instead
- **Future:** URL and PDF extraction coming soon

### Database Maintenance

**Weekly Tasks:**
1. Check for duplicate entries → Remove
2. Review pending startup submissions
3. Verify AI research accuracy on recent additions
4. Update investor data that may be stale

**Monthly Tasks:**
1. Backup database (Supabase automatic backups)
2. Review and clean test data
3. Update notable investments for active investors
4. Check for investors with missing data

### SQL Utilities

**Location:** `/supabase/`

| File | Purpose |
|------|---------|
| `test_connection.sql` | Test database connectivity |
| `remove_duplicates.sql` | Find and remove duplicate investors |
| `fix_delete_policy.sql` | Add DELETE permission to RLS |

---

## 📊 Data Models

### Investors Table Schema

```sql
investors (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('vc_firm', 'accelerator', 'angel_network', 'corporate_vc')),
  tagline TEXT,
  description TEXT,
  website TEXT,
  logo TEXT,
  linkedin TEXT,
  twitter TEXT,
  contact_email TEXT,
  aum TEXT,
  fund_size TEXT,
  check_size TEXT,
  stage TEXT[],
  sectors TEXT[],
  geography TEXT,
  portfolio_count INTEGER,
  exits INTEGER,
  unicorns INTEGER,
  notable_investments TEXT[],
  hot_honey_investments INTEGER DEFAULT 0,
  hot_honey_startups TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Startup Uploads Table Schema

```sql
startup_uploads (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  pitch TEXT,
  description TEXT,
  tagline TEXT,
  website TEXT,
  linkedin TEXT,
  raise_amount TEXT,
  raise_type TEXT,
  stage INTEGER,
  source_type TEXT CHECK (source_type IN ('url', 'deck', 'manual')),
  source_url TEXT,
  deck_filename TEXT,
  extracted_data JSONB,
  status TEXT CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'published')),
  admin_notes TEXT,
  submitted_by TEXT,
  submitted_email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
)
```

---

## 🎯 Quick Reference

### Essential URLs

```
Homepage:           http://localhost:5173/
Investors:          http://localhost:5173/investors
Add Investor:       http://localhost:5173/invite-investor
Edit Investor:      http://localhost:5173/investor/:id/edit
Upload Startup:     http://localhost:5173/upload
Admin Setup:        http://localhost:5173/setup
Review Queue:       http://localhost:5173/admin/review
```

### Essential Commands

```bash
# Start dev server
npm run dev

# Run database migrations (in Supabase SQL Editor)
# Copy contents of each file in /supabase/migrations/ in order

# Check for errors
npm run build

# Install dependencies
npm install
```

### Key Keyboard Shortcuts

- **Search investors:** Type in search box on `/investors`
- **Filter by type:** Use dropdown filter
- **Quick add:** Click green "Add" buttons
- **Quick edit:** Click purple "Edit" buttons on cards

---

## 📝 Workflow Checklists

### ✅ Onboarding New Admin

- [ ] Verify Supabase credentials in `.env`
- [ ] Verify OpenAI API key in `.env`
- [ ] Run all 5 SQL migration files
- [ ] Run fix_delete_policy.sql
- [ ] Seed initial investor data
- [ ] Test adding one investor manually
- [ ] Test AI research feature
- [ ] Test editing an investor
- [ ] Test startup upload (manual method)
- [ ] Bookmark all essential URLs

### ✅ Adding New Investor (Quick)

- [ ] Click "Add Investor" button
- [ ] Enter name and website URL
- [ ] Click "Research with AI"
- [ ] Wait for AI to complete
- [ ] Review auto-filled data
- [ ] Correct any errors
- [ ] Submit
- [ ] Verify appears in directory

### ✅ Weekly Maintenance

- [ ] Check for duplicates → Remove
- [ ] Review pending startups
- [ ] Update 3-5 investor profiles
- [ ] Verify AI research accuracy
- [ ] Clean test submissions

---

## 🆘 Support

### When Things Break

1. **Check Console:** Browser DevTools → Console tab
2. **Check Network:** DevTools → Network tab
3. **Check Database:** Supabase Dashboard → Table Editor
4. **Check Logs:** Supabase Dashboard → Logs

### Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| "relation does not exist" | Table not created | Run SQL migrations |
| "permission denied" | RLS policy issue | Check policies in step5 |
| "duplicate key" | Already exists | Check for duplicates |
| "OpenAI API error" | Invalid/missing API key | Check .env file |

### Getting Help

- **Code Issues:** Check `/src/` files
- **Database Issues:** Check `/supabase/` files
- **AI Issues:** Check `/src/lib/aiResearch.ts`
- **Service Issues:** Check `/src/lib/investorService.ts`

---

## 🚀 Future Enhancements

### Planned Features

1. **URL Scraping:** Auto-extract startup data from URLs
2. **PDF Parsing:** Extract pitch deck data from PDFs
3. **Investor Profiles:** Individual investor profile pages
4. **Bulk Import:** CSV upload for multiple investors
5. **Email Notifications:** Alert admins of new submissions
6. **Advanced Search:** More filter options
7. **Export Data:** Download investor/startup lists

### In Development

- URL scraping integration (Firecrawl or Jina AI)
- PDF parsing (pdf-parse library)
- Individual investor profile pages (`/investor/:id`)
- Admin review dashboard improvements

---

## 📈 Best Practices

### Data Quality

1. **Always review AI research** - Don't trust blindly
2. **Keep data current** - Update investor profiles quarterly
3. **Verify check sizes** - These change frequently
4. **Confirm notable investments** - Add recent wins
5. **Update contact info** - Emails and LinkedIn change

### System Performance

1. **Remove duplicates weekly** - Prevents database bloat
2. **Archive old startups** - Keep review queue clean
3. **Use search filters** - Faster than scrolling
4. **Cache investor data** - Frontend uses local storage

### Security

1. **Never commit `.env`** - Keep secrets secret
2. **RLS policies enabled** - Database security
3. **Admin panel restricted** - Should add auth later
4. **API keys rotated** - Change quarterly

---

## 📞 Contact

For technical issues or questions about this system, contact the development team.

**Last Updated:** November 2, 2025
**Version:** 1.0.0
**System:** Hot Money Honey Platform
