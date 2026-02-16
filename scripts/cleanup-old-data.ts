#!/usr/bin/env tsx

/**
 * Monthly data cleanup for investor-related tables.
 *
 * This script is designed to be run from GitHub Actions (see .github/workflows/cleanup.yml)
 * and from the CLI via: npx tsx scripts/cleanup-old-data.ts
 *
 * It removes:
 * - investor_news older than 90 days
 * - investor_advice older than 180 days
 * - investor_activity older than 60 days
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars for cleanup-old-data.ts');
  console.error('   VITE_SUPABASE_URL or SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupOldData() {
  console.log('🧹 Starting monthly investor data cleanup...\n');

  const results = {
    newsDeleted: 0,
    adviceDeleted: 0,
    activityDeleted: 0,
  };

  try {
    // 1. Delete news older than 90 days
    console.log('📰 Cleaning old news articles...');
    const { data: oldNews, error: newsError } = await supabase
      .from('investor_news')
      .delete()
      .lt('published_date', daysAgo(90))
      .select('id');

    if (newsError) {
      console.error('❌ Error deleting old news:', newsError.message || newsError);
    } else {
      results.newsDeleted = oldNews?.length || 0;
      console.log(`✅ Deleted ${results.newsDeleted} old news articles`);
    }

    // 2. Delete advice older than 180 days
    console.log('\n📝 Cleaning old advice articles...');
    const { data: oldAdvice, error: adviceError } = await supabase
      .from('investor_advice')
      .delete()
      .lt('published_date', daysAgo(180))
      .select('id');

    if (adviceError) {
      console.error('❌ Error deleting old advice:', adviceError.message || adviceError);
    } else {
      results.adviceDeleted = oldAdvice?.length || 0;
      console.log(`✅ Deleted ${results.adviceDeleted} old advice articles`);
    }

    // 3. Delete activity older than 60 days
    console.log('\n📊 Cleaning old activity records...');
    const { data: oldActivity, error: activityError } = await supabase
      .from('investor_activity')
      .delete()
      .lt('activity_date', daysAgo(60))
      .select('id');

    if (activityError) {
      console.error('❌ Error deleting old activity:', activityError.message || activityError);
    } else {
      results.activityDeleted = oldActivity?.length || 0;
      console.log(`✅ Deleted ${results.activityDeleted} old activity records`);
    }

    // 4. Get summary counts after cleanup
    console.log('\n📊 Current database stats:');

    const { count: newsCount } = await supabase
      .from('investor_news')
      .select('*', { count: 'exact', head: true });

    const { count: adviceCount } = await supabase
      .from('investor_advice')
      .select('*', { count: 'exact', head: true });

    const { count: partnersCount } = await supabase
      .from('investor_partners')
      .select('*', { count: 'exact', head: true });

    const { count: investmentsCount } = await supabase
      .from('investor_investments')
      .select('*', { count: 'exact', head: true });

    console.log(`   News articles: ${newsCount || 0}`);
    console.log(`   Advice articles: ${adviceCount || 0}`);
    console.log(`   Partners: ${partnersCount || 0}`);
    console.log(`   Investments: ${investmentsCount || 0}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ News deleted: ${results.newsDeleted}`);
    console.log(`✅ Advice deleted: ${results.adviceDeleted}`);
    console.log(`✅ Activity deleted: ${results.activityDeleted}`);
    console.log(`📊 Total records removed: ${results.newsDeleted + results.adviceDeleted + results.activityDeleted}`);
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error?.message || error);
    process.exit(1);
  }
}

cleanupOldData().catch((err) => {
  console.error('❌ Unexpected error in cleanup-old-data.ts:', err?.message || err);
  process.exit(1);
});
