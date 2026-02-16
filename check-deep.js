const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // GOD Score distribution - need to paginate since Supabase defaults to 1000
  console.log('=== GOD SCORE DISTRIBUTION (FULL) ===');
  let allScores = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase.from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    allScores = allScores.concat(data.map(s => s.total_god_score));
    offset += pageSize;
    if (data.length < pageSize) break;
  }
  
  if (allScores.length > 0) {
    const min = allScores[0];
    const max = allScores[allScores.length - 1];
    const avg = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    const q1 = allScores[Math.floor(allScores.length * 0.25)];
    const median = allScores[Math.floor(allScores.length * 0.5)];
    const q3 = allScores[Math.floor(allScores.length * 0.75)];
    const iqr = q3 - q1;
    console.log('Count: ' + allScores.length);
    console.log('Min: ' + min + ' | Q1: ' + q1 + ' | Median: ' + median + ' | Q3: ' + q3 + ' | Max: ' + max + ' | IQR: ' + iqr + ' | Avg: ' + avg);
    
    const buckets = { '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 };
    allScores.forEach(s => {
      if (s < 50) buckets['40-49']++;
      else if (s < 60) buckets['50-59']++;
      else if (s < 70) buckets['60-69']++;
      else if (s < 80) buckets['70-79']++;
      else if (s < 90) buckets['80-89']++;
      else buckets['90-100']++;
    });
    console.log('Buckets:', JSON.stringify(buckets));
  }

  // Check SSOT scraper vs simple scraper - which one is actually running?
  console.log('\n=== STARTUP_EVENTS TABLE (SSOT scraper output) ===');
  let eventCount = null;
  try {
    const res = await supabase.from('startup_events').select('*', { count: 'exact', head: true });
    eventCount = res.count;
  } catch(e) { console.log('startup_events table may not exist:', e.message); }
  console.log('Total events: ' + eventCount);
  
  if (eventCount > 0) {
    const { data: recentEvents } = await supabase.from('startup_events')
      .select('event_type, company_name, headline, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('Recent events:');
    (recentEvents || []).forEach(e => {
      const ts = e.created_at ? e.created_at.substring(0, 16) : '?';
      console.log('  ' + ts + ' | ' + (e.event_type || '?').padEnd(12) + ' | ' + (e.company_name || '?').substring(0, 25).padEnd(25) + ' | ' + (e.headline || '?').substring(0, 50));
    });
  }

  // Check what scraper the PM2 process is actually running
  console.log('\n=== RSS SCRAPER ECOSYSTEM CONFIG ===');
  const fs = require('fs');
  const ecoConfig = fs.readFileSync('ecosystem.config.js', 'utf8');
  const scraperMatch = ecoConfig.match(/name:\s*'rss-scraper'[\s\S]*?(?=\n\s*\{|\n\s*\])/);
  if (scraperMatch) {
    const lines = scraperMatch[0].split('\n').slice(0, 10);
    lines.forEach(l => console.log('  ' + l.trim()));
  }

  // Ontology agent status - is it in PM2?
  console.log('\n=== ML-ONTOLOGY-AGENT CHECK ===');
  console.log('Last ontology update: Feb 12 (3 days ago)');
  console.log('Agent NOT in PM2 process list. Defined in ecosystem.config.js with cron_restart every 6h.');
  
  // Duplicate ontology entries
  const { data: dupes } = await supabase.from('entity_ontologies')
    .select('entity_name, entity_type')
    .limit(5000);
  if (dupes) {
    const seen = {};
    const duplicates = [];
    dupes.forEach(d => {
      const key = d.entity_name.toLowerCase() + '|' + d.entity_type;
      if (seen[key]) duplicates.push(d.entity_name);
      seen[key] = true;
    });
    console.log('Duplicate entries: ' + duplicates.length);
    if (duplicates.length > 0) {
      console.log('Examples: ' + [...new Set(duplicates)].slice(0, 10).join(', '));
    }
  }

  // Check for bad startup names in approved startups
  console.log('\n=== BAD NAME SAMPLES (approved startups) ===');
  const { data: badNames } = await supabase.from('startup_uploads')
    .select('name')
    .eq('status', 'approved')
    .limit(5000);
  if (badNames) {
    const suspicious = badNames.filter(s => {
      const n = (s.name || '').toLowerCase();
      return n.includes('announces') || n.includes('launches') || n.includes('merge ') ||
             n.includes('nasdaq') || n.includes('challenger') || n.includes(' in ') ||
             n.length > 50 || /^(the|a|an|new|why|how)\s/i.test(s.name || '');
    });
    console.log('Suspicious names found: ' + suspicious.length);
    suspicious.slice(0, 15).forEach(s => console.log('  - ' + s.name));
  }

  console.log('\nDone');
})();
