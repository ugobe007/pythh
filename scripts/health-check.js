#!/usr/bin/env node
/**
 * CRITICAL HEALTH CHECK SCRIPT
 * ============================
 * Run this BEFORE deploying or after any issues.
 * Checks all critical dependencies that scrapers need.
 * 
 * Usage: node scripts/health-check.js
 */

// HEALTH CHECK SCRIPT - overwritten
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_URL',
  'OPENAI_API_KEY'
];

const CRITICAL_TABLES = [
  'startup_uploads',
  'investors',
  'startup_investor_matches',
  'rss_sources',
  'rss_articles',
  'discovered_startups',
  'signal_events',
  'startup_signal_scores'
];

async function runHealthCheck() {
  console.log('🏥 HOT HONEY HEALTH CHECK');
  console.log('='.repeat(50));
  
  let errors = [];
  let warnings = [];
  
  // 1. Check environment variables
  console.log('\n📋 Environment Variables:');
  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (!value) {
      errors.push(`Missing: ${key}`);
      console.log(`  ❌ ${key}: MISSING`);
    } else if (value.includes('your-') || value.includes('placeholder')) {
      errors.push(`Placeholder value: ${key}`);
      console.log(`  ❌ ${key}: PLACEHOLDER VALUE`);
    } else {
      console.log(`  ✅ ${key}: Set (${value.slice(0, 20)}...)`);
    }
  }
  
  // 2. Check Supabase connection
  console.log('\n🔌 Supabase Connection:');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    errors.push('Cannot connect to Supabase - missing credentials');
    console.log('  ❌ Cannot connect - missing credentials');
  } else {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('startup_uploads').select('count').limit(1);
      
      if (error) {
        errors.push(`Supabase error: ${error.message}`);
        console.log(`  ❌ Connection failed: ${error.message}`);
      } else {
        console.log('  ✅ Connected successfully');
      }
      
      // 3. Check critical tables
      console.log('\n📊 Critical Tables:');
      for (const table of CRITICAL_TABLES) {
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          errors.push(`Table ${table}: ${countError.message}`);
          console.log(`  ❌ ${table}: ${countError.message}`);
        } else {
          console.log(`  ✅ ${table}: ${count || 0} rows`);
        }
      }
      
      // 4. Check RSS scraper activity
      console.log('\n📰 RSS Scraper Activity:');
      const { data: recentScrapes } = await supabase
        .from('rss_sources')
        .select('last_scraped')
        .order('last_scraped', { ascending: false })
        .limit(1);
      
      if (recentScrapes?.[0]?.last_scraped) {
        const lastScrape = new Date(recentScrapes[0].last_scraped);
        const hoursAgo = (Date.now() - lastScrape.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo > 24) {
          errors.push(`No RSS scraping in ${hoursAgo.toFixed(1)} hours`);
          console.log(`  ❌ Last scrape: ${hoursAgo.toFixed(1)} hours ago (STALE)`);
        } else if (hoursAgo > 6) {
          warnings.push(`RSS scraping delayed: ${hoursAgo.toFixed(1)} hours`);
          console.log(`  ⚠️  Last scrape: ${hoursAgo.toFixed(1)} hours ago`);
        } else {
          console.log(`  ✅ Last scrape: ${hoursAgo.toFixed(1)} hours ago`);
        }
      } else {
        warnings.push('No RSS scraping data found');
        console.log('  ⚠️  No scraping data found');
      }
      
      // 5. Check new startups in last 24h
      console.log('\n🚀 New Startups (24h):');
      const { count: newStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (newStartups === 0) {
        warnings.push('No new startups in 24 hours');
        console.log(`  ⚠️  ${newStartups} new startups`);
      } else {
        console.log(`  ✅ ${newStartups} new startups`);
      }
      
    } catch (e) {
      errors.push(`Supabase exception: ${e.message}`);
      console.log(`  ❌ Exception: ${e.message}`);
    }
  }
  
  // 3. Check OpenAI API key (live probe — format alone is not enough)
  console.log('\n🤖 OpenAI API:');
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey || openaiKey.includes('your-')) {
    errors.push('Invalid OpenAI API key');
    console.log('  ❌ Invalid or placeholder API key');
  } else {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      if (res.ok) {
        console.log('  ✅ API key accepted by OpenAI');
      } else if (res.status === 401) {
        errors.push('OpenAI API key rejected (401) — create a new key at platform.openai.com/api-keys');
        console.log('  ❌ Key rejected (401) — billing can be fine; rotate the key in .env');
      } else if (res.status === 429) {
        warnings.push('OpenAI quota/rate limit (429)');
        console.log('  ⚠️  Quota/rate limit (429) — check billing');
      } else {
        warnings.push(`OpenAI probe returned ${res.status}`);
        console.log(`  ⚠️  Unexpected status ${res.status}`);
      }
    } catch (e) {
      errors.push(`OpenAI probe failed: ${e.message}`);
      console.log(`  ❌ Probe failed: ${e.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ ALL CHECKS PASSED');
    process.exit(0);
  } else {
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} ERRORS:`);
      errors.forEach(e => console.log(`   - ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} WARNINGS:`);
      warnings.forEach(w => console.log(`   - ${w}`));
    }
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

runHealthCheck().catch(e => {
  console.error('Health check crashed:', e);
  process.exit(1);
});
