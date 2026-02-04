/**
 * Cleanup script for junk names, public companies, and mature companies
 * Run with --dry-run to see what would be deleted
 * Run without flags to actually delete
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key for deletes (bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

// ============ BLOCKLISTS ============

// Known mature/public companies that shouldn't be in startup discovery
const MATURE_COMPANIES = new Set([
  // Tech Giants
  'slack', 'airbnb', 'uber', 'lyft', 'stripe', 'dropbox', 'zoom', 'shopify', 
  'spotify', 'netflix', 'twitter', 'facebook', 'meta', 'google', 'amazon', 'microsoft', 'apple',
  'tesla', 'nvidia', 'intel', 'ibm', 'oracle', 'salesforce', 'adobe', 'cisco', 'paypal', 'square',
  'doordash', 'instacart', 'coinbase', 'robinhood', 'snap', 'pinterest', 'linkedin', 'tiktok',
  'bytedance', 'alibaba', 'tencent', 'baidu', 'samsung', 'sony', 'huawei', 'xiaomi', 'openai',
  'anthropic', 'palantir', 'snowflake', 'databricks', 'figma', 'canva', 'notion', 'airtable',
  'asana', 'monday', 'atlassian', 'twilio', 'cloudflare', 'datadog', 'mongodb', 'elastic',
  'github', 'gitlab', 'hashicorp', 'confluent', 'servicenow', 'workday', 'splunk', 'crowdstrike',
  'docusign', 'okta', 'zscaler', 'fortinet', 'veeva', 'coupa',
  'toast', 'affirm', 'marqeta', 'plaid', 'brex', 'ramp', 'gusto', 'rippling', 'deel',
  'discord', 'reddit', 'quora', 'medium', 'substack', 'wordpress', 'wix', 'squarespace',
  'hubspot', 'zendesk', 'freshworks', 'intercom', 'drift', 'gong', 'outreach', 'salesloft',
  'miro', 'lucidchart', 'coda', 'clickup', 'linear', 'productboard', 'amplitude', 'mixpanel',
  'segment', 'braze', 'iterable', 'klaviyo', 'mailchimp', 'sendgrid', 'postmark',
  'vercel', 'netlify', 'heroku', 'digitalocean', 'linode', 'vultr', 'render',
  'supabase', 'firebase', 'grammarly',
  'calm', 'headspace', 'peloton', 'whoop', 'oura', 'fitbit', 'garmin',
  'flexport', 'convoy', 'samsara', 'motive',
  'rappi', 'grab', 'gojek', 'ola', 'didi', 'bolt', 'cabify',
  // Consulting/Services
  'wipro', 'infosys', 'tcs', 'cognizant', 'accenture', 'deloitte', 'kpmg', 'pwc', 'ey',
  'mckinsey', 'bain', 'bcg',
  // Traditional Tech
  'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi',
  // Finance
  'jpmorgan', 'goldman', 'visa', 'mastercard', 'discover',
  // Retail
  'walmart', 'target', 'costco',
  // VC firms (not startups)
  'sequoia', 'andreessen', 'benchmark', 'greylock', 'kleiner', 'accel', 'lightspeed',
  'general catalyst', 'founders fund', 'khosla', 'nea', 'bessemer', 'index ventures',
  'a16z', 'y combinator', 'yc', 'techstars', '500 startups'
]);

// Junk patterns that definitely aren't company names
const JUNK_PATTERNS = [
  /^[A-Z]{1,2}$/,                    // Single or two uppercase letters (AI, ML, UK, EU, etc)
  /^\d+$/,                            // Just numbers
  /^(The|And|For|With|From|Into|About|After|Before|During|While|When|Where|Why|How|What|Which|Or|But|If|So|As|At|To|Of|In|On|By|Is|It|A|An)$/i,
  /^(Series|Seed|Round|Funding|Million|Billion|Venture|Capital|Investment|Investors|Raises|Raised)$/i,
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i,
  /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i,
  /^(New|Top|Best|First|Last|Next|More|Most|This|That|Here|There|Some|Many|Few|All|Any)$/i,
  /^(Says|Said|Report|Reports|News|Update|Updates|Today|Now|Just|Also|Even|Still|Already)$/i,
  /^(Startup|Startups|Company|Companies|Business|Businesses|Firm|Firms)$/i,
  /^(CEO|CTO|CFO|COO|CMO|VP|Director|Manager|Founder|Founders|Executive|Partner|Board)$/i,
  /^(Q[1-4]|FY\d{2,4}|H[12])$/i,     // Quarter/fiscal year references
  /^(USD|EUR|GBP|JPY|CNY|CAD|AUD|Gbp|Usd)$/i, // Currency codes
  /^(News|Article|Insider|Journal|Finsmes|Techcrunch) /i,  // Starts with publication prefix
  /^(That|Can|Being|Or|And|From|To|At) /i,          // Starts with common words
  / (Partner|Board|The)$/i,          // Ends with generic words
  /^(VC|PE|GP|LP|Ltd|LLC|Inc|Corp)$/i,  // Business suffixes alone
  /^(Tech|Labs|Data|Cloud|App|Pay|Hub|Box|Go|One|Pro|Bio|Med|Fin)$/i,  // Generic industry words alone
  /^(Media|Digital|Software|Platform|Solutions|Services|Systems|Network|Group|Holdings|Ventures|Capital|Fund|Partners)$/i,
];

// Names too short to be real companies
const MIN_LENGTH = 3;

async function cleanupTable(tableName) {
  console.log(`\n=== Cleaning ${tableName} ===\n`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('id, name');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log(`Total entries: ${data.length}`);
  
  const toDelete = [];
  const reasons = {};
  
  for (const row of data) {
    const name = row.name;
    const nameLower = name.toLowerCase();
    let deleteReason = null;
    
    // Check mature companies
    if (MATURE_COMPANIES.has(nameLower)) {
      deleteReason = 'mature_company';
    }
    // Check junk patterns
    else if (JUNK_PATTERNS.some(p => p.test(name))) {
      deleteReason = 'junk_pattern';
    }
    // Check too short
    else if (name.length < MIN_LENGTH) {
      deleteReason = 'too_short';
    }
    // Check all lowercase (usually junk)
    else if (name === nameLower && name.length > 2 && !/\d/.test(name) && !name.includes('.')) {
      deleteReason = 'all_lowercase';
    }
    
    if (deleteReason) {
      toDelete.push({ id: row.id, name: row.name, reason: deleteReason });
      reasons[deleteReason] = (reasons[deleteReason] || 0) + 1;
    }
  }
  
  console.log(`\nEntries to delete: ${toDelete.length}`);
  console.log('By reason:', reasons);
  
  if (toDelete.length > 0) {
    console.log('\nSample deletions:');
    const samples = {};
    for (const item of toDelete) {
      if (!samples[item.reason]) samples[item.reason] = [];
      if (samples[item.reason].length < 5) {
        samples[item.reason].push(item.name);
      }
    }
    for (const [reason, names] of Object.entries(samples)) {
      console.log(`  ${reason}: ${names.join(', ')}`);
    }
    
    if (!DRY_RUN) {
      console.log('\nDeleting...');
      const ids = toDelete.map(d => d.id);
      
      // Delete in batches of 100
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error: delError } = await supabase
          .from(tableName)
          .delete()
          .in('id', batch);
        
        if (delError) {
          console.error(`Error deleting batch ${i}:`, delError);
        } else {
          console.log(`  Deleted batch ${i}-${i + batch.length}`);
        }
      }
      console.log(`✅ Deleted ${toDelete.length} entries from ${tableName}`);
    } else {
      console.log('\n[DRY RUN] No changes made. Run without --dry-run to delete.');
    }
  }
  
  return toDelete.length;
}

async function main() {
  console.log('=== JUNK NAME CLEANUP ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}\n`);
  
  const discoveredDeleted = await cleanupTable('discovered_startups');
  
  // Note: We're more careful with startup_uploads since those are approved
  // Only delete obvious mature companies
  console.log('\n=== Checking startup_uploads (approved) ===');
  const { data: uploads } = await supabase
    .from('startup_uploads')
    .select('id, name, status')
    .eq('status', 'approved');
  
  if (uploads) {
    const matureInApproved = uploads.filter(u => MATURE_COMPANIES.has(u.name.toLowerCase()));
    console.log(`Mature companies in approved startups: ${matureInApproved.length}`);
    if (matureInApproved.length > 0) {
      console.log('  ' + matureInApproved.map(u => u.name).join(', '));
      console.log('\n⚠️  To remove these from startup_uploads, manually review and update their status to "rejected"');
    }
  }
  
  console.log('\n=== CLEANUP COMPLETE ===');
}

main().catch(console.error);
