/**
 * STARTUP NAME EXTRACTION FILTER
 * 
 * Problem: Parser treats news headlines as startup names
 * Example: "Nvidia's Huang plans to visit China" → Name: "Nvidia's Huang" ❌
 * Reality: Article mentions real startups like "Carrum", "Raana Semiconductors" ✅
 * 
 * Solution: Extract real startup names from news articles/blog posts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Filter patterns to distinguish news subjects from startup names
const NEWS_SUBJECT_PATTERNS = [
  /^[A-Z][a-z]+(?:'s|')\s+[A-Z][a-z]+$/,  // "Nvidia's Huang", "Musk's Tesla"
  /^(?:Jeff|Elon|Jensen|Mark|Bill|Larry|Sergey|Satya)\s+[A-Z][a-z]+$/,
  /^(?:Baby|Winter|Copy|Teams|Price|Money|Not|Otherwise|Carefully)$/i,
  /^(?:Week|Commission|Violations|Snapshot|Post|Strategy's)$/i,
  /^(?:Are|Has|Put|Get|Files|Asking)$/i,
];

// Startup name patterns (real companies)
const STARTUP_NAME_PATTERNS = [
  /\b([A-Z][a-z]+(?:AI|Tech|Labs|Systems|Software|Solutions|Cloud|Data|Cyber|Bio|Quantum))\b/g,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:raised|secured|announced|completed|closed|received)\s+\$[\d.]+[KMB]/gi,
  /(?:acquired|acquires)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:launched|debuts|unveils|introduces)/gi,
  /\b([A-Z][a-z]+)\s+(?:raises|closes|secures)\s+(?:Series\s+[A-D]|seed|pre-seed)/gi,
];

function isNewsSubject(name) {
  for (const pattern of NEWS_SUBJECT_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  return false;
}

function extractStartupNames(text) {
  const startups = new Set();
  
  for (const pattern of STARTUP_NAME_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[1]?.trim();
      if (name && name.length > 2 && !isNewsSubject(name)) {
        startups.add(name);
      }
    }
  }
  
  return Array.from(startups);
}

async function recoverStartupsFromArchived() {
  console.log('🔍 RECOVERING STARTUPS FROM ARCHIVED NEWS ARTICLES\n');
  
  // Get total count
  const {count} = await supabase
    .from('startup_uploads')
    .select('*', {count: 'exact', head: true})
    .eq('status', 'rejected');
  
  console.log(`📊 Analyzing ${count} archived entries in batches...\n`);
  
  let recovered = 0;
  const recoveredStartups = [];
  const batchSize = 500;
  
  // Process in batches
  for (let offset = 0; offset < count; offset += batchSize) {
    console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(count/batchSize)}...`);
    
    const {data: archived} = await supabase
      .from('startup_uploads')
      .select('id, name, description, extracted_data, source_url')
      .eq('status', 'rejected')
      .range(offset, offset + batchSize - 1);
  
    for (const entry of archived || []) {
      // Check if this is a news subject (not a real startup)
      if (isNewsSubject(entry.name)) {
        // Extract real startup names from description
        const text = `${entry.description || ''} ${JSON.stringify(entry.extracted_data || {})}`;
        const startupNames = extractStartupNames(text);
        
        if (startupNames.length > 0) {
          console.log(`\n📰 News Entry: "${entry.name}"`);
          console.log(`   🎯 Found ${startupNames.length} startups:`);
          
          for (const startupName of startupNames) {
            console.log(`      - ${startupName}`);
            
            // Check if startup already exists
            const {data: existing} = await supabase
              .from('startup_uploads')
              .select('id')
              .eq('name', startupName)
              .maybeSingle();
            
            if (!existing) {
              recoveredStartups.push({
                name: startupName,
                source_article_id: entry.id,
                source_url: entry.source_url,
                discovered_in: entry.name,
                description: text.substring(0, 500),
              });
              recovered++;
            }
          }
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RECOVERY SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total archived entries analyzed: ${count}`);
  console.log(`New startups discovered: ${recovered}`);
  console.log('='.repeat(70));
  
  // Save recovered startups to discovered_startups table
  if (recoveredStartups.length > 0) {
    console.log('\n💾 Saving to discovered_startups table...');
    
    for (const startup of recoveredStartups) {
      const {error} = await supabase
        .from('discovered_startups')
        .insert({
          name: startup.name,
          description: startup.description,
          source_url: startup.source_url,
          discovered_via: 'archived_news_extraction',
          metadata: {
            source_article: startup.discovered_in,
            extraction_date: new Date().toISOString(),
          },
        });
      
      if (!error) {
        console.log(`  ✅ ${startup.name}`);
      }
    }
    
    console.log(`\n✅ Next steps:`);
    console.log(`   1. Run inference scraper on recovered startups`);
    console.log(`   2. Admin review at http://localhost:5173/admin/discovered-startups`);
    console.log(`   3. Approve for scoring and matching`);
  }
}

recoverStartupsFromArchived().catch(console.error);
