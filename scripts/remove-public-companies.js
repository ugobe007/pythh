require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Public companies that should be removed unless they have Ventures/Capital in name
const PUBLIC_COMPANIES = [
  // Tech Giants
  'microsoft', 'google', 'amazon', 'meta', 'facebook', 'apple', 'nvidia', 'tesla',
  'uber', 'airbnb', 'stripe', 'slack', 'dropbox', 'zoom', 'shopify', 'adobe',
  'netflix', 'twitter', 'linkedin', 'snapchat', 'tiktok', 'bytedance',
  'salesforce', 'oracle', 'ibm', 'intel', 'cisco', 'vmware', 'sap',
  'coinbase', 'robinhood', 'doordash', 'instacart', 'square', 'paypal',
  'twilio', 'cloudflare', 'datadog', 'mongodb', 'snowflake', 'palantir',
  'okta', 'docusign', 'zendesk', 'hubspot', 'atlassian', 'asana',
  'figma', 'canva', 'notion', 'airtable', 'discord', 'reddit',
  'openai', 'anthropic', 'databricks', 'vercel', 'supabase', 'netlify',
  'spotify', 'github', 'pinterest', 'grab', 'discover',
  'quora', 'kpmg', 'baidu', 'rappi', 'alibaba', 'iterable', 
  'nea', 'rippling', 'crowdstrike', 'samsara', 'clickup', 'wipro', 'dell', 
  'infosys', 'tcs', 'cognizant', 'accenture', 'deloitte', 'pwc', 'ey',
  'mckinsey', 'bain', 'bcg', 'jpmorgan', 'goldman', 'visa', 'mastercard',
  
  // Traditional Companies & Media
  'disney', 'coca-cola', 'pepsi', 'mcdonalds', 'walmart', 'target', 'costco',
  'chevron', 'exxon', 'shell', 'bp', 'marathon', 'valero',
  'united', 'american', 'delta', 'southwest', 'jetblue',
  'ford', 'gm', 'toyota', 'honda', 'volkswagen', 'bmw', 'mercedes',
  'verizon', 'att', 'tmobile', 'comcast', 'charter',
  
  // Finance & Energy
  'devon', 'columbia', 'eldorado', 'foran', 'elara',
  'morgan', 'citi', 'bank', 'wells', 'schwab', 'fidelity', 'blackrock',
  'berkshire', 'prudential', 'aig', 'metlife', 'allstate', 'progressive',
  'proshares', 'vanguard', 'ishares', 'spdr',
  
  // Media & Publications
  'wall street journal', 'wsj', 'new york times', 'nyt', 'washington post',
  'bloomberg', 'reuters', 'forbes', 'fortune', 'cnbc', 'bbc', 'cnn', 'fox',
  'techcrunch', 'venturebeat', 'wired', 'verge', 'mashable', 'engadget',
  
  // Geography (should not be startup names)
  'hong kong', 'singapore', 'london', 'new york', 'san francisco', 'tokyo',
  'beijing', 'shanghai', 'mumbai', 'bangalore', 'delhi', 'dubai',
  
  // Generic junk patterns
  'startups', 'startup', 'series', 'funding', 'investment', 'capital'
];

async function removePublicCompanies() {
  // Get ALL from startup_uploads (handle pagination)
  let allData = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, status')
      .range(offset, offset + batchSize - 1);
    if (error) { console.log('Error:', error); return; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  console.log('Total startup_uploads:', allData.length);
  
  const toRemove = allData.filter(d => {
    const nameLower = d.name.toLowerCase().trim();
    // Check if it's a public company (exact match or starts with company name + space)
    const isPublic = PUBLIC_COMPANIES.some(p => nameLower === p || nameLower.startsWith(p + ' '));
    // Allow if they have a venture/capital qualifier
    const hasVentureQualifier = /ventures?|capital|investments?|partners?|fund/i.test(d.name);
    return isPublic && !hasVentureQualifier;
  });
  
  console.log('Public companies to remove from startup_uploads:');
  toRemove.forEach(d => console.log('  - ' + d.name + ' (status: ' + d.status + ')'));
  console.log('\nTotal:', toRemove.length);
  
  if (toRemove.length > 0) {
    const ids = toRemove.map(d => d.id);
    
    // First delete related social_signals to avoid FK constraint
    console.log('\nDeleting related social_signals...');
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      await supabase.from('social_signals').delete().in('startup_id', batch);
    }
    
    // Delete in batches
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error: delError } = await supabase.from('startup_uploads').delete().in('id', batch);
      if (delError) console.log('Delete error:', delError);
    }
    console.log('✅ Deleted', toRemove.length, 'public company entries from startup_uploads');
  }
  
  // Also clean discovered_startups (with pagination)
  let allDiscovered = [];
  offset = 0;
  while (true) {
    const { data: discovered } = await supabase
      .from('discovered_startups')
      .select('id, name')
      .range(offset, offset + batchSize - 1);
    if (!discovered || discovered.length === 0) break;
    allDiscovered = allDiscovered.concat(discovered);
    if (discovered.length < batchSize) break;
    offset += batchSize;
  }
  console.log('Total discovered_startups:', allDiscovered.length);
  
  if (allDiscovered.length > 0) {
    const discToRemove = allDiscovered.filter(d => {
      const nameLower = d.name.toLowerCase().trim();
      const isPublic = PUBLIC_COMPANIES.some(p => nameLower === p || nameLower.startsWith(p + ' '));
      const hasVentureQualifier = /ventures?|capital|investments?|partners?|fund/i.test(d.name);
      return isPublic && !hasVentureQualifier;
    });
    
    console.log('\nPublic companies in discovered_startups:', discToRemove.length);
    discToRemove.slice(0, 20).forEach(d => console.log('  - ' + d.name));
    if (discToRemove.length > 20) console.log('  ... and', discToRemove.length - 20, 'more');
    if (discToRemove.length > 0) {
      const ids = discToRemove.map(d => d.id);
      // Delete in batches
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await supabase.from('discovered_startups').delete().in('id', batch);
      }
      console.log('✅ Deleted', discToRemove.length, 'from discovered_startups');
    }
  }
}

removePublicCompanies();
