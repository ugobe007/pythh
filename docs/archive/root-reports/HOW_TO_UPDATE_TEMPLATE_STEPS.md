# How to Update Template Step Numbers and GOD Score Impact

## Option 1: Using Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to your Supabase project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Migration Script**
   - Copy the contents of `migrations/update_template_steps.sql`
   - Paste into the SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

3. **Verify the Updates**
   - The script includes a verification query at the end
   - Check that all templates have `step_number` and `god_score_impact` set correctly

## Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db execute --file migrations/update_template_steps.sql
```

## Option 3: Run Individual Updates

If you prefer to run updates one at a time:

```sql
-- Example: Update pitch-analyzer
UPDATE service_templates 
SET 
  step_number = 1,
  god_score_impact = ARRAY['vision', 'market']
WHERE slug = 'pitch-analyzer';
```

## Template to Step Mapping

| Step | Template Slug | Name | GOD Score Impact |
|------|--------------|------|------------------|
| 1 | `pitch-analyzer` | Pitch Deck Analyzer | vision, market |
| 2 | `value-prop-sharpener` | Value Prop Sharpener | vision, market, product |
| 3 | `vc-approach-playbook` | VC Approach Playbook | market |
| 4 | `funding-strategy` | Funding Strategy Roadmap | market, vision |
| 5 | `traction-improvement` | Traction Improvement Plan | traction |
| 6 | `team-gap-analysis` | Team Gap Analysis | team |
| 7 | `pmf-analysis` | Product-Market Fit Analysis | product, traction |
| 8 | `partnership-opportunities` | Partnership Finder | market, traction |

## Adding New Templates

When adding new templates, set:
- `step_number`: Next sequential number (9, 10, etc.)
- `god_score_impact`: Array of components it improves: `['traction']`, `['team', 'product']`, etc.

Example:
```sql
INSERT INTO service_templates (
  slug, name, description, category, tier_required, 
  step_number, god_score_impact, is_active
) VALUES (
  'new-template',
  'New Template Name',
  'Description here',
  'category',
  'flame',
  9,
  ARRAY['traction', 'team'],
  true
);
```

## Checking Current Values

```sql
SELECT 
  slug,
  name,
  step_number,
  god_score_impact,
  category
FROM service_templates
WHERE is_active = true
ORDER BY step_number;
```

## Troubleshooting

**If the UPDATE doesn't affect any rows:**
- Check that the `slug` exactly matches (case-sensitive)
- Verify the template exists: `SELECT * FROM service_templates WHERE slug = 'pitch-analyzer';`

**If you get an error about ARRAY syntax:**
- Make sure you're using PostgreSQL/Supabase (not MySQL)
- The syntax `ARRAY['vision', 'market']` is correct for PostgreSQL

**If step_number is NULL after update:**
- Check that the column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'service_templates';`
- If it doesn't exist, run `migrations/create_template_tables.sql` first

