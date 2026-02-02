#!/usr/bin/env node
/**
 * RSS Pattern Analysis
 * Analyze actual RSS feed data to discover language patterns
 * This helps refine ontologies based on real-world data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzePatterns() {
  console.log('🔍 RSS PATTERN ANALYSIS\n');
  console.log('Analyzing real headlines to discover language patterns...\n');
  console.log('═'.repeat(70) + '\n');
  
  // 1. Get active RSS sources
  console.log('📡 ACTIVE RSS SOURCES:\n');
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('name, url, category, is_active')
    .eq('is_active', true)
    .order('name');
  
  if (sources?.length) {
    sources.forEach((source, idx) => {
      console.log(`${idx + 1}. ${source.name}`);
      console.log(`   Category: ${source.category || 'N/A'}`);
      console.log(`   URL: ${source.url.slice(0, 60)}...`);
      console.log('');
    });
  }
  console.log(`Total: ${sources?.length || 0} active feeds\n`);
  console.log('─'.repeat(70) + '\n');
  
  // 2. Recent headlines analysis
  console.log('📰 RECENT HEADLINES (Last 50):\n');
  const { data: events } = await supabase
    .from('startup_events')
    .select('source_title, entities, event_type, frame_type, extraction_meta, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (events?.length) {
    // Categorize by graph_safe status
    const graphSafe = events.filter(e => e.extraction_meta?.graph_safe === true);
    const graphUnsafe = events.filter(e => e.extraction_meta?.graph_safe === false);
    
    console.log(`✅ PASSED (graph_safe=true): ${graphSafe.length} headlines\n`);
    graphSafe.slice(0, 15).forEach((e, idx) => {
      const entityNames = e.entities?.map(ent => ent.name).join(', ') || 'none';
      console.log(`${idx + 1}. ${e.source_title.slice(0, 60)}...`);
      console.log(`   Event: ${e.event_type} | Frame: ${e.frame_type}`);
      console.log(`   Entities: [${entityNames}]`);
      console.log('');
    });
    
    console.log('─'.repeat(70) + '\n');
    console.log(`❌ REJECTED (graph_safe=false): ${graphUnsafe.length} headlines\n`);
    graphUnsafe.slice(0, 15).forEach((e, idx) => {
      const entityNames = e.entities?.map(ent => ent.name).join(', ') || 'none';
      console.log(`${idx + 1}. ${e.source_title.slice(0, 60)}...`);
      console.log(`   Event: ${e.event_type} | Frame: ${e.frame_type}`);
      console.log(`   Entities: [${entityNames}]`);
      console.log('');
    });
  }
  
  console.log('═'.repeat(70) + '\n');
  
  // 3. Entity frequency analysis
  console.log('📊 ENTITY FREQUENCY ANALYSIS:\n');
  const entityCounts = new Map();
  
  events?.forEach(event => {
    event.entities?.forEach(entity => {
      const name = entity.name;
      entityCounts.set(name, (entityCounts.get(name) || 0) + 1);
    });
  });
  
  // Sort by frequency
  const sortedEntities = Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  console.log('Top 30 Most Common Entities:\n');
  sortedEntities.forEach(([name, count], idx) => {
    console.log(`${idx + 1}. "${name}" - appears ${count} times`);
  });
  
  console.log('\n' + '═'.repeat(70) + '\n');
  
  // 4. Discovered startups analysis
  console.log('🎯 DISCOVERED STARTUPS ANALYSIS:\n');
  const { data: discovered } = await supabase
    .from('discovered_startups')
    .select('name, source_title, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (discovered?.length) {
    console.log(`Recent discoveries: ${discovered.length}\n`);
    
    // Categorize by pattern
    const singleWord = [];
    const multiWord = [];
    const hasNumbers = [];
    const suspicious = [];
    
    discovered.forEach(d => {
      const name = d.name;
      const words = name.split(/\s+/);
      
      if (words.length === 1) {
        singleWord.push(d);
      } else if (words.length > 1) {
        multiWord.push(d);
      }
      
      if (/\d/.test(name)) {
        hasNumbers.push(d);
      }
      
      // Suspicious patterns
      if (words.length > 5 || 
          /^(your|my|our|their|for|to|with)/i.test(name) ||
          /researchers|scientists|founders|startups|vcs/i.test(name)) {
        suspicious.push(d);
      }
    });
    
    console.log('📝 PATTERN BREAKDOWN:\n');
    console.log(`Single-word names: ${singleWord.length}`);
    console.log(`Multi-word names: ${multiWord.length}`);
    console.log(`Names with numbers: ${hasNumbers.length}`);
    console.log(`Suspicious patterns: ${suspicious.length}\n`);
    
    if (suspicious.length > 0) {
      console.log('⚠️  SUSPICIOUS NAMES (should be blocked):\n');
      suspicious.slice(0, 20).forEach((d, idx) => {
        console.log(`${idx + 1}. "${d.name}"`);
        console.log(`   From: ${d.source_title.slice(0, 50)}...`);
        console.log('');
      });
    }
  }
  
  console.log('═'.repeat(70) + '\n');
  
  // 5. Event type distribution
  console.log('📈 EVENT TYPE DISTRIBUTION:\n');
  const eventTypes = new Map();
  events?.forEach(e => {
    const type = e.event_type || 'UNKNOWN';
    eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
  });
  
  Array.from(eventTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pct = ((count / events.length) * 100).toFixed(1);
      console.log(`${type}: ${count} (${pct}%)`);
    });
  
  console.log('\n' + '═'.repeat(70) + '\n');
  
  // 6. Recommendations
  console.log('💡 RECOMMENDATIONS FOR ONTOLOGY EXPANSION:\n');
  
  // Find entities that appear frequently but might be generic
  const potentialGeneric = sortedEntities
    .filter(([name, count]) => {
      const lower = name.toLowerCase();
      return count >= 3 && (
        /researchers|scientists|engineers|founders|investors|startups|companies/i.test(name) ||
        name.split(/\s+/).length === 1 && lower === lower.toUpperCase() || // All caps acronyms
        /^(top|big|leading|major|former|ex-)/i.test(name)
      );
    });
  
  if (potentialGeneric.length > 0) {
    console.log('➕ Add to GENERIC_TERMS:\n');
    potentialGeneric.slice(0, 10).forEach(([name, count]) => {
      console.log(`   - "${name}" (appears ${count} times)`);
    });
    console.log('');
  }
  
  // Find potential places
  const potentialPlaces = sortedEntities
    .filter(([name, count]) => {
      return count >= 2 && (
        /valley|bay|city|area|region|hub/i.test(name) ||
        name.split(/\s+/).length === 1 && /^[A-Z][a-z]+$/.test(name) // Proper noun single word
      );
    });
  
  if (potentialPlaces.length > 0) {
    console.log('➕ Potential PLACES to verify:\n');
    potentialPlaces.slice(0, 10).forEach(([name, count]) => {
      console.log(`   - "${name}" (appears ${count} times)`);
    });
    console.log('');
  }
  
  // Find potential investors
  const potentialInvestors = sortedEntities
    .filter(([name, count]) => {
      const lower = name.toLowerCase();
      return count >= 2 && (
        /capital|ventures|partners|fund|vc|investments/i.test(name) &&
        !/(vc funding|venture capital|seed fund)/i.test(name) // Not generic terms
      );
    });
  
  if (potentialInvestors.length > 0) {
    console.log('➕ Potential INVESTORS to add:\n');
    potentialInvestors.slice(0, 10).forEach(([name, count]) => {
      console.log(`   - "${name}" (appears ${count} times)`);
    });
    console.log('');
  }
  
  console.log('═'.repeat(70) + '\n');
  console.log('🎯 NEXT STEPS:\n');
  console.log('1. Review suspicious names and add patterns to validateEntityQuality()');
  console.log('2. Add frequent generic terms to entity_ontologies table');
  console.log('3. Add verified investors/places to ontology database');
  console.log('4. Run health check to validate improvements');
  console.log('5. Monitor discovered_startups table for new patterns');
  console.log('\n');
}

analyzePatterns().catch(console.error);
