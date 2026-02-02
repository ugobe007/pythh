import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env (default to .env.bak which we use elsewhere)
dotenv.config({ path: process.env.ENV_FILE || '.env.bak' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function main() {
  const since24h = isoHoursAgo(24);

  // Counts
  const { count: newEvents } = await supabase
    .from('startup_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since24h);

  const { count: newRssStartups } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'rss')
    .gte('created_at', since24h);

  const { count: totalEvents } = await supabase
    .from('startup_events')
    .select('*', { count: 'exact', head: true });

  const { count: totalRssStartups } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'rss');

  // Active RSS sources
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id,name,category,last_scraped')
    .eq('active', true);

  // Missed candidates: events with entities but graph_safe=false
  const { data: recentEvents } = await supabase
    .from('startup_events')
    .select('event_id, source_title, source_url, created_at, entities, extraction_meta')
    .gte('created_at', since24h)
    .limit(300);

  const missed = (recentEvents || []).filter((e: any) => {
    try {
      const meta = e.extraction_meta || {};
      const hasEntities = Array.isArray(e.entities) && e.entities.length > 0;
      const graphSafe = !!meta.graph_safe;
      return hasEntities && !graphSafe;
    } catch {
      return false;
    }
  });

  const missedSamples = missed.slice(0, 15).map((m: any) => {
    const primary = Array.isArray(m.entities) && m.entities.length > 0 ? m.entities[0].name : 'N/A';
    return {
      created_at: m.created_at,
      title: String(m.source_title).slice(0, 90),
      primary_entity: primary,
      event_id: m.event_id,
    };
  });

  console.log('\n📊 SCRAPER METRICS (last 24h)');
  console.log('================================');
  console.log(`New events:          ${newEvents ?? 0}`);
  console.log(`New RSS startups:    ${newRssStartups ?? 0}`);
  const staleCutoff = new Date(since24h);
  const staleSources = (sources || []).filter(s => {
    try {
      return !s.last_scraped || new Date(s.last_scraped) < staleCutoff;
    } catch {
      return true;
    }
  });
  console.log(`Active RSS sources:  ${sources?.length ?? 0}`);
  console.log(`Stale (>24h) sources:${staleSources.length}`);
  console.log('\n📈 ALL-TIME TOTALS');
  console.log('================================');
  console.log(`Total events:        ${totalEvents ?? 0}`);
  console.log(`Total RSS startups:  ${totalRssStartups ?? 0}`);

  console.log('\n🕳️  Potentially missed (entities present, graph_safe=false)');
  console.log('================================');
  console.log(`Count: ${missed.length}`);
  missedSamples.forEach((s, i) => {
    console.log(` ${String(i + 1).padStart(2, ' ')}. ${s.created_at} | ${s.primary_entity} | ${s.title}`);
  });

  if (sources && sources.length) {
    const byCat: Record<string, number> = {};
    for (const s of sources) {
      const cat = s.category || 'uncategorized';
      byCat[cat] = (byCat[cat] || 0) + 1;
    }
    const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([cat, n]) => `${cat}:${n}`).join(', ');
    console.log('\n🗂️  RSS source categories (top)');
    console.log('================================');
    console.log(catList || 'none');
  }
}

main().catch(err => {
  console.error('Metrics script failed:', err?.message || err);
  process.exit(1);
});
