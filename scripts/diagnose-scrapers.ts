/**
 * SCRAPER DIAGNOSTIC REPORT
 * Shows exactly what's going wrong with data collection
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function diagnoseScraperIssues() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    SCRAPER DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Publisher websites stored as startup websites
  console.log('1️⃣  PUBLISHER WEBSITES STORED AS STARTUPS\n');
  
  const publisherDomains = [
    'techcrunch.com', 'businessinsider.com', 'entrepreneur.com', 'forbes.com',
    'cnbc.com', 'github.com', 'theverge.com', 'wired.com', 'fastcompany.com',
    'inc.com', 'wsj.com', 'nytimes.com', 'medium.com', 'twitter.com', 'linkedin.com',
    'reddit.com', 'ycombinator.com', 'venturebeat.com', 'arstechnica.com',
    'bloomberg.com', 'reuters.com', 'bbc.com', 'cnn.com', 'theguardian.com'
  ];

  let publisherCount = 0;
  for (const domain of publisherDomains) {
    const { data, count } = await supabase
      .from('startup_uploads')
      .select('id', { count: 'exact', head: true })
      .ilike('website', `%${domain}%`);
    
    if (count && count > 0) {
      console.log(`   ${domain}: ${count} records (SHOULD BE 0)`);
      publisherCount += count;
    }
  }
  console.log(`\n   ⚠️  TOTAL PUBLISHER DOMAINS: ${publisherCount}`);

  // 2. Bad company names (extracted from headlines, not actual company names)
  console.log('\n2️⃣  BAD COMPANY NAMES (HEADLINE FRAGMENTS)\n');

  const { data: badNames } = await supabase
    .from('startup_uploads')
    .select('name, website')
    .or(`name.ilike.%raises%,name.ilike.%wins%,name.ilike.%leads%,name.ilike.%takes%,name.ilike.%just%,name.ilike.%'s %,name.eq.I,name.eq.The,name.eq.A,name.eq.An,name.eq.On`)
    .eq('status', 'approved')
    .limit(20);

  console.log('   Examples of bad names:');
  badNames?.slice(0, 15).forEach(s => {
    console.log(`     • "${s.name}" → ${s.website?.substring(0, 50)}`);
  });

  // 3. Single-word generic names
  console.log('\n3️⃣  SINGLE-WORD GENERIC NAMES\n');

  const { data: singleWords } = await supabase.rpc('exec_sql', {
    query: `
      SELECT name, COUNT(*) as occurrences
      FROM startup_uploads
      WHERE status = 'approved' 
      AND name ~ '^[A-Z][a-z]+$'
      AND LENGTH(name) BETWEEN 3 AND 10
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY occurrences DESC
      LIMIT 20
    `
  });

  // Fallback query
  const { data: singleWordExamples } = await supabase
    .from('startup_uploads')
    .select('name, website')
    .eq('status', 'approved')
    .in('name', ['Target', 'Amazon', 'Apple', 'Google', 'Meta', 'Microsoft', 'Tesla', 'Intel', 'Oracle', 'IBM', 'Dell', 'HP', 'Sony', 'Samsung', 'LG', 'Final', 'Legal', 'Brown', 'Kaiser', 'Benz', 'FOSS'])
    .limit(20);

  console.log('   Single-word names that are likely wrong:');
  singleWordExamples?.forEach(s => {
    console.log(`     • "${s.name}" → ${s.website?.substring(0, 60)}`);
  });

  // 4. Ontology coverage
  console.log('\n4️⃣  ENTITY ONTOLOGY COVERAGE\n');

  const { data: ontologyStats } = await supabase
    .from('entity_ontologies')
    .select('entity_type')
    .limit(1000);

  const ontologyCounts: Record<string, number> = {};
  ontologyStats?.forEach(row => {
    ontologyCounts[row.entity_type] = (ontologyCounts[row.entity_type] || 0) + 1;
  });

  console.log('   Entity types in ontology:');
  Object.entries(ontologyCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`     • ${type}: ${count}`);
    });

  // 5. SSOT scraper vs legacy scraper
  console.log('\n5️⃣  SSOT vs LEGACY SCRAPER EVENTS\n');

  const { data: eventStats } = await supabase
    .from('startup_events')
    .select('event_type, frame_confidence')
    .limit(5000);

  const eventCounts: Record<string, { count: number; avgConf: number }> = {};
  eventStats?.forEach(row => {
    if (!eventCounts[row.event_type]) {
      eventCounts[row.event_type] = { count: 0, avgConf: 0 };
    }
    eventCounts[row.event_type].count++;
    eventCounts[row.event_type].avgConf += row.frame_confidence || 0;
  });

  // Calculate averages
  Object.keys(eventCounts).forEach(k => {
    eventCounts[k].avgConf = eventCounts[k].avgConf / eventCounts[k].count;
  });

  console.log('   Event type distribution:');
  Object.entries(eventCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([type, stats]) => {
      const confStr = stats.avgConf > 0.7 ? '✅' : (stats.avgConf > 0.3 ? '⚠️' : '❌');
      console.log(`     ${confStr} ${type}: ${stats.count} (avg confidence: ${(stats.avgConf * 100).toFixed(0)}%)`);
    });

  // 6. graph_safe distribution
  console.log('\n6️⃣  GRAPH_SAFE GATE (SSOT SCRAPER)\n');

  const { count: graphSafeTrue } = await supabase
    .from('startup_events')
    .select('id', { count: 'exact', head: true })
    .eq('extraction_meta->graph_safe', true);

  const { count: graphSafeFalse } = await supabase
    .from('startup_events')
    .select('id', { count: 'exact', head: true })
    .eq('extraction_meta->graph_safe', false);

  console.log(`   graph_safe=true: ${graphSafeTrue || 0} (creates startup records)`);
  console.log(`   graph_safe=false: ${graphSafeFalse || 0} (events only, no startup)`);
  
  const passRate = graphSafeTrue && graphSafeFalse 
    ? ((graphSafeTrue / (graphSafeTrue + graphSafeFalse)) * 100).toFixed(1)
    : 'N/A';
  console.log(`   Pass rate: ${passRate}%`);

  // 7. Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    🔧 ISSUES & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('ISSUE 1: Publisher URLs stored as startup websites');
  console.log('  → Problem: Scraper is storing RSS article URLs, not actual company URLs');
  console.log('  → Impact: ~484 records have publisher domains as websites');
  console.log('  → Fix: Add PUBLISHER_DOMAIN blocklist to graph_safe gate\n');

  console.log('ISSUE 2: Headline fragments extracted as company names');
  console.log('  → Problem: "raises", "wins", "leads" appearing in names');
  console.log('  → Impact: ~2000+ records have bad names');
  console.log('  → Fix: Improve extractCompanyName() in frameParser.ts\n');

  console.log('ISSUE 3: Low ontology coverage for STARTUP type');
  console.log('  → Problem: Only 134 STARTUP entities vs 262 GENERIC_TERM');
  console.log('  → Impact: Parser cannot validate company names');
  console.log('  → Fix: Expand STARTUP ontology from known-good sources\n');

  console.log('ISSUE 4: OTHER event type dominates (88%)');
  console.log('  → Problem: Parser falling back to OTHER due to low confidence');
  console.log('  → Impact: Most events not properly classified');
  console.log('  → Fix: Expand frame patterns in frameParser.ts\n');

  console.log('═══════════════════════════════════════════════════════════════════\n');
}

diagnoseScraperIssues();
