#!/usr/bin/env node
/**
 * WEBSITE DISCOVERY ENGINE
 * ========================
 * 
 * Discovers actual company websites for startups that only have:
 * - Name (often extracted from headlines)
 * - Source URL (article URL from RSS feed)
 * 
 * Strategies:
 * 1. Search Google for "company name official website"
 * 2. Extract from RSS article content (if source_url available)
 * 3. Check Crunchbase/LinkedIn for company website
 * 4. Pattern-based domain guessing (companyname.com, companyname.io)
 * 
 * Usage:
 *   npx tsx scripts/discover-websites.ts [--limit 100] [--dry-run]
 */

import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Publisher domains to skip (we already know these are wrong)
const PUBLISHER_DOMAINS = new Set([
  'techcrunch.com', 'businessinsider.com', 'entrepreneur.com', 'forbes.com',
  'cnbc.com', 'theverge.com', 'wired.com', 'fastcompany.com', 'inc.com',
  'wsj.com', 'nytimes.com', 'medium.com', 'twitter.com', 'linkedin.com',
  'reddit.com', 'ycombinator.com', 'venturebeat.com', 'arstechnica.com',
  'bloomberg.com', 'reuters.com', 'bbc.com', 'cnn.com', 'theguardian.com',
  'axios.com', 'strictlyvc.com', 'avc.com', 'mattermark.com', 'dealroom.co',
  'crunchbase.com', 'pitchbook.com', 'finsmes.com', 'pulse2.com', 'inc42.com',
  'theblock.co', 'coindesk.com', 'decrypt.co', 'cointelegraph.com', 'zdnet.com',
  'engadget.com', 'gizmodo.com', 'mashable.com', 'theregister.com', 'techmeme.com',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'news.ycombinator.com',
  'producthunt.com', 'betalist.com', 'angellist.com', 'substack.com', 'mirror.xyz',
  'google.com', 'apple.com', 'amazon.com', 'microsoft.com', 'ibm.com', 'meta.com'
]);

// Names that are definitely NOT startup names
const BAD_NAME_PATTERNS = [
  /^(raises?|wins?|leads?|takes?|just|new|how|why|what|the|a|an|on|at|in|to|i)$/i,
  /\s(raises?|wins?|leads?|secures?|announces?)\s/i,
  /^\d+[MBK]?$/i,  // Just numbers like "100M"
  /^[A-Z]{2,4}$/,  // Just abbreviations like "IBM", "AWS"
];

// KNOWN COMPANY WEBSITES (high-confidence matches)
const KNOWN_COMPANY_WEBSITES: Record<string, string> = {
  // AI/ML Companies
  'Anyscale': 'anyscale.com',
  'Weights & Biases': 'wandb.ai',
  'Stability AI': 'stability.ai',
  'Cohere': 'cohere.com',
  'Together AI': 'together.ai',
  'Modal': 'modal.com',
  'Baseten': 'baseten.co',
  'Deepgram': 'deepgram.com',
  'Fiddler AI': 'fiddler.ai',
  'Sakana AI': 'sakana.ai',
  'Adept AI': 'adept.ai',
  'Adept': 'adept.ai',
  'Anthropic': 'anthropic.com',
  'Hugging Face': 'huggingface.co',
  
  // Developer Tools
  'Neon': 'neon.tech',
  'Pulumi': 'pulumi.com',
  'EdgeDB': 'edgedb.com',
  'Pocketbase': 'pocketbase.io',
  'Dub.co': 'dub.co',
  'Trigger.dev': 'trigger.dev',
  'Railway': 'railway.app',
  'Render': 'render.com',
  'Vercel': 'vercel.com',
  'Supabase': 'supabase.com',
  'PlanetScale': 'planetscale.com',
  'Clerk': 'clerk.com',
  'Tauri': 'tauri.app',
  'Coder': 'coder.com',
  
  // Fintech
  'Marqeta': 'marqeta.com',
  'Unit': 'unit.co',
  'Column': 'column.us',
  'Mercury': 'mercury.com',
  'Brex': 'brex.com',
  'Ramp': 'ramp.com',
  'Plaid': 'plaid.com',
  'Stripe': 'stripe.com',
  
  // Robotics/Hardware
  '1X Technologies': '1x.tech',
  'Figure': 'figure.ai',
  'Boston Dynamics': 'bostondynamics.com',
  
  // Other notable
  '23andMe': '23andme.com',
  '37signals': '37signals.com',
  'Acorns': 'acorns.com',
  '6 River Systems': '6river.com',
  'HCLTech': 'hcltech.com',
  'Analog Devices': 'analog.com',
  'CryptoQuant': 'cryptoquant.com',
  'LiveKit': 'livekit.io',
};

function isValidCompanyName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 100) return false;
  for (const pattern of BAD_NAME_PATTERNS) {
    if (pattern.test(name)) return false;
  }
  // Should have at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  return true;
}

function isPublisherDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  return PUBLISHER_DOMAINS.has(normalized);
}

/**
 * Extract potential website from article content
 */
async function extractWebsiteFromArticle(sourceUrl: string, companyName: string): Promise<string | null> {
  try {
    const response = await axios.get(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/2.0)' },
      timeout: 10000,
    });

    const html = response.data;
    const companyLower = companyName.toLowerCase().replace(/\s+/g, '');

    // Look for links that might be the company website
    const linkPattern = /href=["']?(https?:\/\/[^"'\s>]+)["']?/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
        
        // Skip publisher domains
        if (isPublisherDomain(domain)) continue;
        
        // Check if domain contains company name (fuzzy match)
        const domainBase = domain.replace(/\.(com|io|co|ai|xyz|app|dev|tech)$/, '');
        if (domainBase.includes(companyLower.slice(0, 5)) || 
            companyLower.includes(domainBase.slice(0, 5))) {
          return domain;
        }
      } catch {}
    }

    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Guess potential domains from company name
 */
function guessDomains(name: string): string[] {
  const clean = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
  
  if (clean.length < 2) return [];
  
  return [
    `${clean}.com`,
    `${clean}.io`,
    `${clean}.ai`,
    `${clean}.co`,
    `${clean}.app`,
    `get${clean}.com`,
    `${clean}app.com`,
    `${clean}hq.com`,
  ];
}

/**
 * Check if domain is reachable
 */
async function checkDomain(domain: string): Promise<boolean> {
  try {
    const url = `https://${domain}`;
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    });
    return response.status < 400;
  } catch {
    try {
      // Try http
      const url = `http://${domain}`;
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: (status) => status < 500,
      });
      return response.status < 400;
    } catch {
      return false;
    }
  }
}

/**
 * Main discovery function
 */
async function discoverWebsite(startup: { 
  id: string; 
  name: string; 
  source_url?: string; 
  description?: string;
}): Promise<string | null> {
  
  // Strategy 0: Check known company list first (instant)
  if (KNOWN_COMPANY_WEBSITES[startup.name]) {
    console.log(`   ✅ Known company: ${KNOWN_COMPANY_WEBSITES[startup.name]}`);
    return KNOWN_COMPANY_WEBSITES[startup.name];
  }
  
  // Strategy 1: Extract from article if we have source_url
  if (startup.source_url) {
    const extracted = await extractWebsiteFromArticle(startup.source_url, startup.name);
    if (extracted) {
      console.log(`   ✅ Extracted from article: ${extracted}`);
      return extracted;
    }
  }

  // Strategy 2: Guess domains and check if reachable
  const guesses = guessDomains(startup.name);
  for (const domain of guesses) {
    const isValid = await checkDomain(domain);
    if (isValid) {
      console.log(`   ✅ Found via domain guess: ${domain}`);
      return domain;
    }
  }

  // Strategy 3: Check if name itself is a domain
  if (startup.name.includes('.') && !startup.name.includes(' ')) {
    const isValid = await checkDomain(startup.name);
    if (isValid) {
      console.log(`   ✅ Name is a domain: ${startup.name}`);
      return startup.name;
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) || 100 : 100;
  const dryRun = args.includes('--dry-run');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('               🔍 WEBSITE DISCOVERY ENGINE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} startups\n`);

  // Get startups with NULL website and valid names
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, source_url, description')
    .is('website', null)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Failed to fetch startups:', error.message);
    process.exit(1);
  }

  console.log(`Found ${startups?.length || 0} startups without websites\n`);

  let discovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const startup of startups || []) {
    console.log(`\n🔎 ${startup.name}`);

    // Skip invalid names
    if (!isValidCompanyName(startup.name)) {
      console.log('   ⏭️  Skipped: Invalid company name');
      skipped++;
      continue;
    }

    const website = await discoverWebsite(startup);

    if (website) {
      discovered++;
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('startup_uploads')
          .update({ website: `https://${website}` })
          .eq('id', startup.id);

        if (updateError) {
          console.log(`   ❌ Failed to update: ${updateError.message}`);
          failed++;
        }
      } else {
        console.log(`   [DRY RUN] Would set website to: ${website}`);
      }
    } else {
      console.log('   ❌ No website found');
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                        📊 RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total processed:  ${startups?.length || 0}`);
  console.log(`Websites found:   ${discovered}`);
  console.log(`Skipped (bad name): ${skipped}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success rate:     ${startups?.length ? ((discovered / (startups.length - skipped)) * 100).toFixed(1) : 0}%`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
