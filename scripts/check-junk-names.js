/**
 * Check discovered_startups for junk names, public companies, and mature companies
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Known mature/public companies that shouldn't be in startup discovery
const MATURE_COMPANIES = new Set([
  'slack', 'airbnb', 'uber', 'lyft', 'stripe', 'dropbox', 'zoom', 'shopify', 
  'spotify', 'netflix', 'twitter', 'facebook', 'meta', 'google', 'amazon', 'microsoft', 'apple',
  'tesla', 'nvidia', 'intel', 'ibm', 'oracle', 'salesforce', 'adobe', 'cisco', 'paypal', 'square',
  'doordash', 'instacart', 'coinbase', 'robinhood', 'snap', 'pinterest', 'linkedin', 'tiktok',
  'bytedance', 'alibaba', 'tencent', 'baidu', 'samsung', 'sony', 'huawei', 'xiaomi', 'openai',
  'anthropic', 'palantir', 'snowflake', 'databricks', 'figma', 'canva', 'notion', 'airtable',
  'asana', 'monday', 'atlassian', 'twilio', 'cloudflare', 'datadog', 'mongodb', 'elastic',
  'github', 'gitlab', 'hashicorp', 'confluent', 'servicenow', 'workday', 'splunk', 'crowdstrike',
  'docusign', 'okta', 'zscaler', 'palo alto networks', 'fortinet', 'veeva', 'coupa', 'bill.com',
  'toast', 'affirm', 'marqeta', 'plaid', 'brex', 'ramp', 'gusto', 'rippling', 'deel',
  'discord', 'reddit', 'quora', 'medium', 'substack', 'wordpress', 'wix', 'squarespace',
  'hubspot', 'zendesk', 'freshworks', 'intercom', 'drift', 'gong', 'outreach', 'salesloft',
  'miro', 'lucidchart', 'coda', 'clickup', 'linear', 'productboard', 'amplitude', 'mixpanel',
  'segment', 'braze', 'iterable', 'klaviyo', 'mailchimp', 'sendgrid', 'postmark',
  'vercel', 'netlify', 'heroku', 'digitalocean', 'linode', 'vultr', 'render', 'fly.io',
  'supabase', 'firebase', 'aws', 'gcp', 'azure', 'ibm cloud', 'oracle cloud',
  'grammarly', '1password', 'lastpass', 'dashlane', 'bitwarden', 'keeper',
  'calm', 'headspace', 'peloton', 'whoop', 'oura', 'fitbit', 'garmin',
  'doximity', 'ro', 'hims', 'nurx', 'cerebral', 'betterhelp', 'talkspace',
  'flexport', 'convoy', 'project44', 'samsara', 'motive', 'keeptruckin',
  'rappi', 'grab', 'gojek', 'ola', 'didi', 'bolt', 'cabify', 'freenow',
  'wipro', 'infosys', 'tcs', 'cognizant', 'accenture', 'deloitte', 'kpmg', 'pwc', 'ey',
  'mckinsey', 'bain', 'bcg', 'sequoia', 'andreessen', 'benchmark', 'greylock', 'kleiner',
  'ford', 'gm', 'toyota', 'honda', 'bmw', 'mercedes', 'volkswagen', 'audi', 'porsche',
  'boeing', 'airbus', 'lockheed', 'raytheon', 'northrop', 'general dynamics',
  'jpmorgan', 'goldman', 'morgan stanley', 'citi', 'bank of america', 'wells fargo',
  'visa', 'mastercard', 'american express', 'discover', 'capital one',
  'walmart', 'target', 'costco', 'kroger', 'cvs', 'walgreens',
  'coca-cola', 'pepsi', 'nestle', 'unilever', 'procter', 'johnson',
  'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi'
]);

// Generic words that aren't company names
const GENERIC_WORDS = new Set([
  'tech', 'labs', 'data', 'cloud', 'app', 'pay', 'hub', 'box', 'go', 'one', 'pro',
  'now', 'up', 'it', 'me', 'we', 'us', 'ai', 'ml', 'iot', 'inc', 'ltd', 'llc', 'corp',
  'group', 'global', 'digital', 'systems', 'solutions', 'services', 'network', 'platform',
  'partners', 'ventures', 'capital', 'holdings', 'technologies', 'software', 'media',
  'health', 'bio', 'pharma', 'energy', 'power', 'finance', 'fund', 'bank', 'insurance'
]);

// Junk patterns
const JUNK_PATTERNS = [
  /^[A-Z]{1,2}$/,                    // Single or two uppercase letters
  /^\d+$/,                            // Just numbers
  /^(The|And|For|With|From|Into|About|After|Before|During|While|When|Where|Why|How|What|Which)$/i,
  /^(Series|Seed|Round|Funding|Million|Billion|Venture|Capital|Investment|Investors|Raises)$/i,
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i,
  /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i,
  /^(New|Top|Best|First|Last|Next|More|Most|This|That|Here|There|Some|Many|Few|All|Any)$/i,
  /^(Says|Said|Report|Reports|News|Update|Updates|Today|Now|Just|Also|Even|Still|Already)$/i,
  /^(Startup|Startups|Company|Companies|Business|Businesses|Firm|Firms)$/i,
  /^(CEO|CTO|CFO|COO|CMO|VP|Director|Manager|Founder|Founders|Executive)$/i,
  /^(Q[1-4]|FY\d{2,4}|H[12])$/i,     // Quarter/fiscal year references
  /^(USD|EUR|GBP|JPY|CNY|CAD|AUD)$/i, // Currency codes
  /^(News|Article|Insider|Journal|Finsmes) /i,  // Starts with publication prefix
  /^(That|Can|Being|Or) /i,          // Starts with common words
  / (Partner|Board|The)$/i,          // Ends with generic words
];

async function checkJunkNames() {
  console.log('=== CHECKING DISCOVERED_STARTUPS FOR JUNK ===\n');
  
  // Fetch all names
  const { data, error } = await supabase
    .from('discovered_startups')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  console.log(`Total entries: ${data.length}\n`);
  
  const issues = {
    mature: [],
    junk: [],
    short: [],
    lowercase: [],
    generic: [],
    suspicious: [],
    multiWord: []
  };
  
  for (const row of data) {
    const name = row.name;
    const nameLower = name.toLowerCase();
    
    // Check for mature companies
    if (MATURE_COMPANIES.has(nameLower)) {
      issues.mature.push(name);
      continue;
    }
    
    // Check for junk patterns
    if (JUNK_PATTERNS.some(p => p.test(name))) {
      issues.junk.push(name);
      continue;
    }
    
    // Check for very short names
    if (name.length <= 2) {
      issues.short.push(name);
      continue;
    }
    
    // Check for all lowercase (usually junk)
    if (name === nameLower && name.length > 2 && !/\d/.test(name)) {
      issues.lowercase.push(name);
      continue;
    }
    
    // Check for generic single words
    if (GENERIC_WORDS.has(nameLower)) {
      issues.generic.push(name);
      continue;
    }
    
    // Check for 3+ word phrases (likely article fragments)
    if (name.includes(' ') && name.split(' ').length >= 3) {
      issues.multiWord.push(name);
      continue;
    }
    
    // Check for suspicious patterns
    if (/^[A-Z][a-z]+$/.test(name) && name.length <= 4) {
      // Very short capitalized words like "Tech", "Labs"
      issues.suspicious.push(name);
    }
  }
  
  // Report findings
  console.log('🏢 MATURE/PUBLIC COMPANIES:', issues.mature.length);
  if (issues.mature.length > 0) {
    console.log('   ' + [...new Set(issues.mature)].slice(0, 30).join(', '));
  }
  
  console.log('\n🗑️  JUNK PATTERN MATCHES:', issues.junk.length);
  if (issues.junk.length > 0) {
    console.log('   ' + [...new Set(issues.junk)].slice(0, 30).join(', '));
  }
  
  console.log('\n📏 VERY SHORT NAMES (<=2 chars):', issues.short.length);
  if (issues.short.length > 0) {
    console.log('   ' + [...new Set(issues.short)].join(', '));
  }
  
  console.log('\n🔡 ALL LOWERCASE (potential junk):', issues.lowercase.length);
  if (issues.lowercase.length > 0) {
    console.log('   ' + [...new Set(issues.lowercase)].slice(0, 30).join(', '));
  }
  
  console.log('\n⚠️  GENERIC SINGLE-WORD:', issues.generic.length);
  if (issues.generic.length > 0) {
    console.log('   ' + [...new Set(issues.generic)].join(', '));
  }
  
  console.log('\n🔍 SUSPICIOUS (short capitalized):', issues.suspicious.length);
  if (issues.suspicious.length > 0) {
    console.log('   ' + [...new Set(issues.suspicious)].slice(0, 30).join(', '));
  }
  
  console.log('\n📝 MULTI-WORD (3+ words, likely fragments):', issues.multiWord.length);
  if (issues.multiWord.length > 0) {
    console.log('   ' + [...new Set(issues.multiWord)].slice(0, 20).join(' | '));
  }
  
  const totalJunk = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
  const cleanCount = data.length - totalJunk;
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Clean entries: ${cleanCount} (${((cleanCount/data.length)*100).toFixed(1)}%)`);
  console.log(`❌ Problematic entries: ${totalJunk} (${((totalJunk/data.length)*100).toFixed(1)}%)`);
  
  // Sample of recent clean names
  const cleanNames = data.filter(d => {
    const n = d.name;
    const nl = n.toLowerCase();
    return !MATURE_COMPANIES.has(nl) && 
           !JUNK_PATTERNS.some(p => p.test(n)) &&
           n.length > 2 &&
           n !== nl &&
           !GENERIC_WORDS.has(nl) &&
           !(n.includes(' ') && n.split(' ').length >= 3);
  }).map(d => d.name);
  
  console.log('\n=== SAMPLE OF CLEAN RECENT NAMES (50) ===');
  console.log(cleanNames.slice(0, 50).join(', '));
  
  // Also check startup_uploads (approved startups)
  console.log('\n\n=== CHECKING STARTUP_UPLOADS (APPROVED) ===\n');
  const { data: uploads } = await supabase
    .from('startup_uploads')
    .select('name, status');
  
  if (uploads) {
    const approved = uploads.filter(d => d.status === 'approved');
    console.log('Total startup_uploads:', uploads.length);
    console.log('Approved startups:', approved.length);
    
    const approvedMature = approved.filter(d => MATURE_COMPANIES.has(d.name.toLowerCase()));
    console.log('\n🏢 MATURE COMPANIES IN APPROVED:', approvedMature.length);
    if (approvedMature.length > 0) {
      console.log('   ' + approvedMature.map(d => d.name).join(', '));
    }
    
    const approvedJunk = approved.filter(d => JUNK_PATTERNS.some(p => p.test(d.name)));
    console.log('\n🗑️  JUNK PATTERNS IN APPROVED:', approvedJunk.length);
    if (approvedJunk.length > 0) {
      console.log('   ' + approvedJunk.map(d => d.name).slice(0, 20).join(', '));
    }
    
    const approvedShort = approved.filter(d => d.name.length <= 2);
    console.log('\n📏 VERY SHORT IN APPROVED:', approvedShort.length);
    if (approvedShort.length > 0) {
      console.log('   ' + approvedShort.map(d => d.name).join(', '));
    }
  }
}

checkJunkNames().catch(console.error);
