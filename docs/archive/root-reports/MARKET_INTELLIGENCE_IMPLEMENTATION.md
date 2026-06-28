# Market Intelligence & Talent Matching - Implementation Guide

## Quick Start

### 1. Set Up Database Tables

Run the SQL migration:
```bash
psql -h your-db-host -U postgres -d your-db -f database/market_intelligence_tables.sql
```

Or run it in Supabase SQL Editor.

### 2. Use Talent Matching Service

```typescript
import { matchFounderToHires } from './server/services/talentMatchingService';

// Get founder profile from startup
const founder: FounderProfile = {
  id: startup.id,
  name: startup.name,
  founder_courage: startup.founder_courage || 'moderate',
  founder_intelligence: startup.founder_intelligence || 'moderate',
  founder_speed: startup.founder_speed || 1.5,
  technical_cofounders: startup.technical_cofounders || 0,
  sectors: startup.sectors || [],
  stage: startup.stage
};

// Get talent pool from database
const { data: talentPool } = await supabase
  .from('talent_pool')
  .select('*')
  .eq('availability_status', 'available');

// Find matches
const matches = matchFounderToHires(founder, talentPool, {
  minScore: 50,
  maxResults: 10,
  requiredSkills: ['technical'], // Optional: filter by skill
  excludeCommitted: true
});

// Save matches to database
for (const match of matches) {
  await supabase.from('founder_hire_matches').insert({
    startup_id: founder.id,
    talent_id: match.talent_id,
    match_score: match.match_score,
    match_reasons: match.match_reasons,
    alignment_type: match.alignment_types,
    founder_courage: founder.founder_courage,
    founder_intelligence: founder.founder_intelligence,
    candidate_courage: talentPool.find(t => t.id === match.talent_id)?.candidate_courage,
    candidate_intelligence: talentPool.find(t => t.id === match.talent_id)?.candidate_intelligence
  });
}
```

### 3. Track Key Variables

```typescript
// Example: Track average GOD score by sector
const { data: startups } = await supabase
  .from('startup_uploads')
  .select('sectors, total_god_score')
  .not('total_god_score', 'is', null);

// Calculate average by sector
const sectorAverages = {};
startups.forEach(startup => {
  startup.sectors?.forEach(sector => {
    if (!sectorAverages[sector]) {
      sectorAverages[sector] = { sum: 0, count: 0 };
    }
    sectorAverages[sector].sum += startup.total_god_score;
    sectorAverages[sector].count += 1;
  });
});

// Store in key_variables_tracking
for (const [sector, data] of Object.entries(sectorAverages)) {
  const avg = data.sum / data.count;
  await supabase.from('key_variables_tracking').insert({
    variable_name: 'avg_god_score',
    variable_category: 'startup_health',
    value: avg,
    sector: sector,
    measurement_date: new Date().toISOString().split('T')[0],
    sample_size: data.count
  });
}
```

---

## Key Variables to Track

### Startup Health Metrics
- `avg_god_score`: Average GOD score across all startups
- `avg_god_score_by_sector`: Average by sector
- `avg_god_score_by_stage`: Average by stage
- `mrr_growth_rate`: Average MRR growth
- `customer_growth_rate`: Average customer growth
- `time_to_mvp_days`: Average days to MVP
- `funding_velocity_days`: Average days between funding rounds

### Founder Attributes
- `founder_courage_distribution`: Distribution of courage scores
- `founder_intelligence_distribution`: Distribution of intelligence scores
- `founder_speed_avg`: Average founder speed score
- `courage_intelligence_correlation`: Correlation between courage and success
- `founder_age_distribution`: Age distribution of founders

### Market Trends
- `sector_funding_velocity`: Funding velocity by sector
- `stage_success_rate`: Success rate by stage
- `geographic_performance`: Performance by location
- `emerging_sectors`: Sectors with increasing activity

### Talent Trends
- `talent_availability_by_skill`: Available talent by skill type
- `match_success_rate`: % of matches that result in hires
- `avg_match_score`: Average match quality
- `courage_alignment_impact`: Impact of courage alignment on hire success

---

## Analytics Queries

### For Investors

```sql
-- Sector Performance Dashboard
SELECT 
  sector,
  AVG(total_god_score) as avg_god_score,
  COUNT(*) as startup_count,
  AVG(mrr) as avg_mrr,
  AVG(growth_rate_monthly) as avg_growth_rate
FROM startup_uploads
WHERE status = 'approved'
GROUP BY sector
ORDER BY avg_god_score DESC;

-- Founder Quality Trends
SELECT 
  founder_courage,
  founder_intelligence,
  AVG(total_god_score) as avg_god_score,
  COUNT(*) as count
FROM startup_uploads
WHERE founder_courage IS NOT NULL
GROUP BY founder_courage, founder_intelligence
ORDER BY avg_god_score DESC;

-- Funding Velocity by Sector
SELECT 
  su.sectors[1] as sector,
  AVG(EXTRACT(EPOCH FROM (fr2.date - fr1.date)) / 86400) as avg_days_between_rounds
FROM funding_rounds fr1
JOIN funding_rounds fr2 ON fr1.startup_id = fr2.startup_id
JOIN startup_uploads su ON fr1.startup_id = su.id
WHERE fr2.date > fr1.date
GROUP BY sector;
```

### For Startups

```sql
-- Benchmarking: How do you compare?
SELECT 
  'Your Startup' as label,
  total_god_score,
  mrr,
  growth_rate_monthly
FROM startup_uploads
WHERE id = 'your-startup-id'

UNION ALL

SELECT 
  'Sector Average' as label,
  AVG(total_god_score),
  AVG(mrr),
  AVG(growth_rate_monthly)
FROM startup_uploads
WHERE sectors && ARRAY['your-sector']
  AND status = 'approved';
```

---

## Next Steps

1. **Build Talent Intake Form**: Create UI for candidates to join talent pool
2. **Create Matching Dashboard**: Show founders their top matches
3. **Build Analytics Dashboard**: Visualize market intelligence
4. **Automate Tracking**: Set up cron jobs to calculate key variables daily
5. **Generate Reports**: Weekly/monthly reports for investors and startups

---

## Value Proposition

### For Founders
- Find key hires that match your hustle
- Understand what skills you're missing
- See how you compare to peers

### For Investors
- Market intelligence on sectors and trends
- Founder quality insights
- Deal flow quality metrics

### For the Platform
- Network effects: More data = better matches
- Competitive moat: Unique insights
- Revenue opportunities: Premium analytics





