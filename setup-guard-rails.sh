#!/bin/bash
# SETUP GUARD RAILS AND AUTOMATION
# Run this script to enable all protection and automation systems

echo "🔧 Setting up Guard Rails and Automation..."
echo "============================================"
echo ""

# 1. Database migration
echo "📦 1/4 - Running database migration..."
if command -v psql &> /dev/null; then
  echo "   Running SQL migration via psql..."
  # TODO: Replace with your Supabase connection string
  # psql "$DATABASE_URL" -f migrations/add-last-scraped-at.sql
  echo "   ⚠️  Skipped: Please run migrations/add-last-scraped-at.sql manually in Supabase SQL Editor"
else
  echo "   ⚠️  psql not found - Please run migrations/add-last-scraped-at.sql manually in Supabase SQL Editor"
fi
echo ""

# 2. Install dependencies (if needed)
echo "📦 2/4 - Checking dependencies..."
if ! npm list @supabase/supabase-js &> /dev/null; then
  echo "   Installing @supabase/supabase-js..."
  npm install @supabase/supabase-js
else
  echo "   ✅ @supabase/supabase-js already installed"
fi
echo ""

# 3. Test systems
echo "🧪 3/4 - Testing systems..."
echo ""

echo "   Testing data refresh pipeline..."
node scripts/data-refresh-pipeline.js daily 2>&1 | grep "REFRESH SUMMARY" -A 5
echo ""

echo "   Testing health report..."
node scripts/daily-health-report.js 2>&1 | grep "SUMMARY" -A 10
echo ""

# 4. Setup cron jobs
echo "⏰ 4/4 - Cron job setup (optional)..."
echo ""
echo "   To schedule automated runs, add these to your crontab:"
echo "   (Run 'crontab -e' to edit)"
echo ""
echo "   # Daily health report (9 AM)"
echo "   0 9 * * * cd $(pwd) && node scripts/daily-health-report.js >> logs/health-report.log 2>&1"
echo ""
echo "   # Daily data refresh (2 AM)"
echo "   0 2 * * * cd $(pwd) && node scripts/data-refresh-pipeline.js daily >> logs/data-refresh.log 2>&1"
echo ""
echo "   # Weekly full refresh (Sunday 3 AM)"
echo "   0 3 * * 0 cd $(pwd) && node scripts/data-refresh-pipeline.js full >> logs/data-refresh.log 2>&1"
echo ""

# Create logs directory
mkdir -p logs
mkdir -p reports

echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "📋 Quick Reference:"
echo "   npm run health:report        - Run health check"
echo "   npm run data:refresh          - Refresh startup data"
echo "   npm run data:refresh:full     - Full refresh (all sparse)"
echo ""
echo "📁 Outputs:"
echo "   reports/                      - Daily health reports"
echo "   logs/                         - Automation logs"
echo ""
echo "📖 Full documentation: GUARD_RAILS_AND_AUTOMATION.md"
