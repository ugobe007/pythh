#!/bin/bash
# ============================================================================
# SETUP MATCH FALLBACK SYSTEM
# ============================================================================
# This script sets up the complete fallback system for match generation
# ============================================================================

set -e

echo "🚀 Setting up Match Fallback System..."
echo ""

# Step 1: Apply database migration
echo "📊 Step 1: Applying database migration..."
echo "⚠️  You need to run this SQL manually in Supabase:"
echo "   1. Go to: https://app.supabase.com/project/YOUR_PROJECT/sql"
echo "   2. Copy contents of: supabase/migrations/20260122_match_queue_trigger.sql"
echo "   3. Paste and execute"
echo ""
read -p "Press ENTER when migration is applied..."

# Step 2: Stop PM2 processes
echo "🛑 Step 2: Stopping PM2 processes..."
pm2 stop match-regenerator 2>/dev/null || true
pm2 stop match-queue-processor 2>/dev/null || true
pm2 delete match-regenerator 2>/dev/null || true
pm2 delete match-queue-processor 2>/dev/null || true

# Step 3: Start new PM2 processes
echo "▶️  Step 3: Starting PM2 processes with new config..."
pm2 start ecosystem.config.js --only match-regenerator
pm2 start ecosystem.config.js --only match-queue-processor
pm2 save

# Step 4: Verify
echo ""
echo "✅ Step 4: Verifying setup..."
pm2 status

echo ""
echo "📋 Step 5: Check queue status"
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  console.log('\\nQueue Status:');
  const { data, error } = await supabase.from('queue_status').select('*');
  if (error) {
    console.error('❌ Error:', error.message);
    console.log('⚠️  Make sure database migration is applied first!');
  } else if (data && data.length > 0) {
    data.forEach(s => {
      console.log(\`  \${s.status}: \${s.count} items\`);
    });
  } else {
    console.log('  Queue is empty (no pending matches)');
  }
  process.exit(0);
})();
"

echo ""
echo "✅ SETUP COMPLETE!"
echo ""
echo "📚 Next Steps:"
echo "  1. Read: FALLBACK_STRATEGY.md for full documentation"
echo "  2. Test: Submit a new URL and watch the queue process it"
echo "  3. Monitor: pm2 logs match-queue-processor"
echo ""
echo "🎯 What Changed:"
echo "  ✅ Database trigger auto-queues new startups"
echo "  ✅ Queue processor runs every 5 minutes (fast response)"
echo "  ✅ Match regenerator runs every 30 minutes (backup)"
echo "  ✅ User submissions get priority processing"
echo ""
echo "⏱️  Expected wait time: 2-5 minutes (down from 0-30 minutes)"
