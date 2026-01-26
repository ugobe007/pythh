const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.bak" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testScraper() {
  console.log("🔍 Testing Scraper Health\n");

  // Check RSS sources
  const { data: sources, count: sourceCount } = await supabase
    .from("rss_sources")
    .select("*", { count: "exact" })
    .eq("active", true);

  console.log(`📡 Active RSS Sources: ${sourceCount || 0}`);

  // Check recent events (last 24h)
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { count: recentEvents } = await supabase
    .from("startup_events")
    .select("*", { count: "exact", head: true })
    .gte("occurred_at", oneDayAgo.toISOString());

  console.log(`📰 Events (last 24h): ${recentEvents || 0}`);

  // Check recent startups from RSS
  const { count: recentStartups } = await supabase
    .from("startup_uploads")
    .select("*", { count: "exact", head: true })
    .eq("source_type", "rss")
    .gte("created_at", oneDayAgo.toISOString());

  console.log(`🚀 New startups from RSS (last 24h): ${recentStartups || 0}`);

  // Check ontology
  const { count: ontologyCount } = await supabase
    .from("entity_ontologies")
    .select("*", { count: "exact", head: true });

  console.log(`🧠 Ontology entities: ${ontologyCount || 0}`);

  // Check last scrape time
  const { data: lastScraped } = await supabase
    .from("rss_sources")
    .select("last_scraped")
    .order("last_scraped", { ascending: false, nullsFirst: false })
    .limit(1);

  if (lastScraped && lastScraped[0]?.last_scraped) {
    const lastTime = new Date(lastScraped[0].last_scraped);
    const hoursAgo = ((Date.now() - lastTime.getTime()) / (1000 * 60 * 60)).toFixed(1);
    console.log(`⏰ Last scrape: ${hoursAgo} hours ago (${lastTime.toLocaleString()})`);
  } else {
    console.log(`⏰ Last scrape: Never (or all sources have NULL last_scraped)`);
  }

  console.log("\n✅ Scraper health check complete");
}

testScraper().catch(console.error);
