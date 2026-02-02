#!/bin/bash
/**
 * DEPLOY AGGRESSIVE AUTOMATION
 * ============================
 * Restarts PM2 with new automation schedules
 */

echo ""
echo "🚀 DEPLOYING AGGRESSIVE AUTOMATION"
echo "═════════════════════════════════════════════════════"
echo ""

# Stop all PM2 processes
echo "⏸️  Stopping all PM2 processes..."
pm2 delete all 2>/dev/null || echo "   (No processes running)"

# Start with new configuration
echo ""
echo "▶️  Starting processes with new configuration..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Show status
echo ""
echo "📊 Process Status:"
echo "═════════════════════════════════════════════════════"
pm2 status

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📋 New Schedules:"
echo "   • rss-scraper: Every 15 minutes"
echo "   • match-regenerator: Every 2 hours"
echo "   • ml-training-scheduler: Every 2 hours"
echo "   • ml-auto-apply: Every 2 hours @ :30"
echo ""
echo "🔍 Monitor:"
echo "   pm2 logs --lines 50"
echo "   pm2 monit"
echo "   npx tsx check-scrapers.ts"
echo ""
