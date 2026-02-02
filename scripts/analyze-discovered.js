#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzeDiscovered() {
  console.log('\n🎯 DISCOVERED STARTUPS - DETAILED ANALYSIS\n');
  console.log('═'.repeat(70) + '\n');
  
  // Get all discovered startups
  const { data: discovered } = await supabase
    .from('discovered_startups')
    .select('name, source_title')
    .order('created_at', { ascending: false })
    .limit(200);
  
  console.log(`Total discovered: ${discovered?.length || 0}\n`);
  
  if (discovered?.length) {
    // Categorize by patterns
    const patterns = {
      hasShow: [],
      hasGeographic: [],
      hasStartupWord: [],
      suspiciousLong: [],
      suspiciousGeneric: [],
      looksGood: []
    };
    
    discovered.forEach(d => {
      const name = d.name;
      const words = name.split(/\s+/);
      
      if (/^Show\b/i.test(name)) {
        patterns.hasShow.push(d);
      } else if (/\b(Japan|China|India|Africa|Europe|Asia|American|British|French|German)\b/i.test(name)) {
        patterns.hasGeographic.push(d);
      } else if (/\b(Startup|Startups|Company|Companies|Firm|Firms)\b/i.test(name)) {
        patterns.hasStartupWord.push(d);
      } else if (words.length > 6) {
        patterns.suspiciousLong.push(d);
      } else if (/\b(Researchers|Scientists|Engineers|Developers|Founders|VCs|Investors|Executives)\b/i.test(name)) {
        patterns.suspiciousGeneric.push(d);
      } else {
        patterns.looksGood.push(d);
      }
    });
    
    console.log('📊 PATTERN BREAKDOWN:\n');
    console.log(`❌ "Show" prefix (HN pattern): ${patterns.hasShow.length}`);
    console.log(`❌ Geographic terms embedded: ${patterns.hasGeographic.length}`);
    console.log(`❌ Contains "Startup/Company": ${patterns.hasStartupWord.length}`);
    console.log(`❌ Long names (>6 words): ${patterns.suspiciousLong.length}`);
    console.log(`❌ Generic categories: ${patterns.suspiciousGeneric.length}`);
    console.log(`✅ Looks good: ${patterns.looksGood.length}\n`);
    
    console.log('─'.repeat(70) + '\n');
    
    if (patterns.hasShow.length > 0) {
      console.log('⚠️  "Show" PREFIX (Hacker News "Show HN:" pattern):\n');
      patterns.hasShow.slice(0, 15).forEach((d, i) => {
        console.log(`${i+1}. "${d.name}"`);
      });
      console.log('\n💡 Fix: Block "Show" as standalone word\n');
    }
    
    if (patterns.hasGeographic.length > 0) {
      console.log('─'.repeat(70) + '\n');
      console.log('⚠️  GEOGRAPHIC TERMS EMBEDDED:\n');
      patterns.hasGeographic.slice(0, 15).forEach((d, i) => {
        console.log(`${i+1}. "${d.name}"`);
        console.log(`   From: ${d.source_title.slice(0, 55)}...`);
      });
      console.log('\n💡 Fix: "Japan Startup X" should extract only "X"\n');
    }
    
    if (patterns.hasStartupWord.length > 0) {
      console.log('─'.repeat(70) + '\n');
      console.log('⚠️  CONTAINS "Startup/Company" (likely generic):\n');
      patterns.hasStartupWord.slice(0, 15).forEach((d, i) => {
        console.log(`${i+1}. "${d.name}"`);
      });
      console.log('\n💡 Fix: Strip "Startup/Company" or block if standalone\n');
    }
    
    if (patterns.looksGood.length > 0) {
      console.log('─'.repeat(70) + '\n');
      console.log('✅ LOOKS GOOD (real startup names):\n');
      patterns.looksGood.slice(0, 25).forEach((d, i) => {
        console.log(`${i+1}. ${d.name}`);
      });
      console.log('\n');
    }
  }
  
  // Now check startup_uploads (graph joins)
  console.log('═'.repeat(70) + '\n');
  console.log('📦 STARTUP_UPLOADS (Graph Joins Created):\n');
  
  const { data: uploads } = await supabase
    .from('startup_uploads')
    .select('name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  console.log(`Total: ${uploads?.length || 0}\n`);
  
  if (uploads?.length) {
    uploads.forEach((u, i) => {
      const status = u.status || 'pending';
      const emoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
      console.log(`${i+1}. ${emoji} ${u.name} (${status})`);
    });
  }
  
  console.log('\n' + '═'.repeat(70) + '\n');
  console.log('💡 KEY FINDINGS:\n');
  console.log('1. "Show" from Hacker News needs blocking');
  console.log('2. Geographic adjectives being extracted as entities');
  console.log('3. "Startup/Company" words need stripping or blocking');
  console.log('4. Most real company names are single or 2-word names');
  console.log('\n');
}

analyzeDiscovered().catch(console.error);
