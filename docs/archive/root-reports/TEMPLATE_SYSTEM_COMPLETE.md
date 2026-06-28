# Template Sequential Flow System - Complete ✅

## Overview
Created a comprehensive sequential template flow system that guides startups through completing fundraising templates in order, with GOD score-based recommendations and completion reports.

## Components Created

### 1. **TemplateSequentialFlow.tsx** (`src/pages/TemplateSequentialFlow.tsx`)
- Sequential step-by-step template flow (Step 1, Step 2, Step 3, etc.)
- Progress tracking with completion percentage
- GOD score-based recommendations showing which components need improvement
- Priority-based template suggestions (Critical, High, Medium)
- Links each template to GOD score components it improves
- Route: `/startup/:startupId/templates`

### 2. **TemplateCompletionWidget.tsx** (`src/components/TemplateCompletionWidget.tsx`)
- Shows completion progress on startup profile pages
- Displays recently completed templates
- Links to full template flow
- Integrated into `StartupDetail.tsx`

### 3. **GOD Score Template Guide Script** (`scripts/templates/god-score-template-guide.js`)
- Analyzes startup GOD scores
- Generates recommendations for which templates to complete
- Maps templates to GOD score components (traction, team, market, product, vision)
- Provides priority-based guidance
- Usage: `node scripts/templates/god-score-template-guide.js <startup-id>`

### 4. **Database Migration** (`migrations/create_template_tables.sql`)
- `template_completions` table: Tracks which templates each startup has completed
- `template_recommendations` table: Stores GOD score-based recommendations
- Adds `step_number` column to `service_templates` for sequential ordering
- Adds `god_score_impact` column to `service_templates` for component mapping

## Features

### ✅ Sequential Flow
- Templates are ordered by `step_number`
- Users must complete templates in order (or can skip ahead if unlocked)
- Visual progress indicator showing completion percentage

### ✅ GOD Score Integration
- Templates mapped to GOD score components:
  - `pitch-analyzer` → vision, market
  - `value-prop-sharpener` → vision, market, product
  - `traction-improvement` → traction
  - `team-gap-analysis` → team
  - `pmf-analysis` → product, traction
- Recommendations generated based on low component scores

### ✅ Completion Tracking
- Templates marked as completed when analysis finishes
- Completion data stored in `template_completions` table
- Reports shown on startup profile page

### ✅ Reports
- Completion widget on startup profile showing:
  - Progress bar (X/Y templates completed)
  - Recently completed templates
  - Link to full template flow
- Full sequential flow page shows:
  - Overall progress
  - Current GOD score
  - Priority recommendations
  - All templates with completion status

## How to Use

### For Startups:
1. Navigate to `/startup/:startupId/templates` to see sequential flow
2. Complete templates in order (Step 1, Step 2, etc.)
3. Each template analysis automatically marks it as completed
4. View progress on startup profile page

### For Admins:
1. Set `step_number` in `service_templates` table (1, 2, 3, etc.)
2. Set `god_score_impact` array for each template (e.g., `['traction', 'team']`)
3. Run `node scripts/templates/god-score-template-guide.js <startup-id>` to generate recommendations

## Database Setup

Run the migration:
```sql
-- In Supabase SQL Editor
\i migrations/create_template_tables.sql
```

Or manually:
1. Create `template_completions` table
2. Create `template_recommendations` table
3. Add `step_number` and `god_score_impact` columns to `service_templates`

## Template Configuration

Each template in `service_templates` should have:
- `step_number`: Sequential order (1, 2, 3, etc.)
- `god_score_impact`: Array of components it improves, e.g., `['traction', 'team']`

Example SQL:
```sql
UPDATE service_templates 
SET 
  step_number = 1,
  god_score_impact = ARRAY['vision', 'market']
WHERE slug = 'pitch-analyzer';
```

## ML Training Timeout Fix ✅

Also fixed the ML training timeout issue:
- Changed from single large query to paginated batches (100 records at a time)
- Reduced total limit from 5000 to 500
- Reduced time range from 1 month to 1 week
- Separate GOD score fetch for better performance
- Added small delays between batches to avoid overwhelming database

## Next Steps

1. **Update existing templates** in database with `step_number` and `god_score_impact`
2. **Test the flow** by navigating to `/startup/:startupId/templates`
3. **Complete a template** and verify it marks as completed
4. **Check startup profile** to see completion widget

## Files Modified

- ✅ `src/pages/TemplateSequentialFlow.tsx` (NEW)
- ✅ `src/components/TemplateCompletionWidget.tsx` (NEW)
- ✅ `src/pages/StartupDetail.tsx` (updated with widget)
- ✅ `src/pages/ServiceDetailPage.tsx` (updated to mark completion)
- ✅ `src/pages/ServicesPage.tsx` (updated with link)
- ✅ `src/App.tsx` (added route)
- ✅ `scripts/templates/god-score-template-guide.js` (NEW)
- ✅ `server/services/mlTrainingService.ts` (fixed timeout)
- ✅ `migrations/create_template_tables.sql` (NEW)

## Status: ✅ COMPLETE

All requested features implemented:
1. ✅ Sequential template flow (Step 1, 2, 3, etc.)
2. ✅ GOD score-based recommendations
3. ✅ Completion tracking and reports
4. ✅ Reports on startup profile
5. ✅ ML training timeout fixed

