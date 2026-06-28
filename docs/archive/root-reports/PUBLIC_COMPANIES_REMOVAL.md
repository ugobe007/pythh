# Public and Large Private Companies Removal

## Summary

Removed **129 companies** from the startup database that were creating bias in GOD scoring:
- **32 Public companies** (Amazon Web Services, AMD, ServiceNow, Cloudflare, etc.)
- **27 Mature startups** (Palantir, Anthropic, Runway, SpaceX, etc.)
- **70 Large/Public companies** (Segment, Nextdoor, Intercom, Carbon Health, etc.)

## Impact

- **Before**: 1,862 approved startups
- **After**: 1,733 approved startups
- **Removed**: 129 companies (6.9% of database)
- **Matches cleaned**: All matches for removed companies were also deleted

## Companies Removed

### Public Companies (32)
- Amazon Web Services (AWS)
- Advanced Micro Devices (AMD)
- ServiceNow
- Cloudflare
- Workday
- Nutanix
- Okta
- Docker
- Grammarly
- Supabase
- Retool
- And 22 more...

### Mature Startups (27)
- Palantir
- Anthropic
- Runway
- SpaceX
- Segment
- Nextdoor
- Intercom
- Carbon Health
- And 19 more...

### Large/Public Companies (70)
- Various large corporations and mature platforms

## Why This Matters

1. **GOD Score Bias**: Public and large companies have different metrics (revenue, team size, market position) that skew the scoring algorithm
2. **Not Startups**: These are established companies, not early-stage startups seeking funding
3. **Data Quality**: Removing them improves the quality and accuracy of the startup database
4. **Better Benchmarks**: Benchmark scores will now reflect actual startup performance, not large corporations

## Next Steps

1. ✅ Companies removed and marked as `rejected`
2. ✅ Matches cleaned up
3. ⏳ Recalculate GOD scores (will be more accurate now)
4. ⏳ Recalculate benchmark scores (will reflect actual startups)

## Prevention

The filtering system (`utils/companyFilters.js`) is already integrated into:
- `discover-startups-from-rss.js` - Filters during discovery
- `utils/saveDiscoveredStartup.js` - Filters before saving
- `auto-import-pipeline.js` - Filters before importing

This prevents future public/large companies from being added to the database.

