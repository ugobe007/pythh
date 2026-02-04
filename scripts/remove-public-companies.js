require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Public companies that should be removed unless they have Ventures/Capital in name
const PUBLIC_COMPANIES = [
  'microsoft', 'quora', 'kpmg', 'baidu', 'rappi', 'alibaba', 'iterable', 
  'nea', 'rippling', 'crowdstrike', 'samsara', 'clickup', 'wipro', 'dell', 
  'spotify', 'paypal', 'github', 'pinterest', 'grab', 'discover',
  'google', 'amazon', 'meta', 'facebook', 'apple', 'nvidia', 'tesla',
  'uber', 'airbnb', 'stripe', 'slack', 'dropbox', 'zoom', 'shopify',
  'netflix', 'twitter', 'linkedin', 'snapchat', 'tiktok', 'bytedance',
  'salesforce', 'oracle', 'ibm', 'intel', 'cisco', 'adobe', 'vmware',
  'coinbase', 'robinhood', 'doordash', 'instacart', 'square', 'paypal',
  'twilio', 'cloudflare', 'datadog', 'mongodb', 'snowflake', 'palantir',
  'okta', 'docusign', 'zendesk', 'hubspot', 'atlassian', 'asana',
  'figma', 'canva', 'notion', 'airtable', 'discord', 'reddit',
  'openai', 'anthropic', 'databricks', 'vercel', 'supabase', 'netlify',
  'infosys', 'tcs', 'cognizant', 'accenture', 'deloitte', 'pwc', 'ey',
  'mckinsey', 'bain', 'bcg', 'jpmorgan', 'goldman', 'visa', 'mastercard'
];

async function removePublicCompanies() {
  // Get all from startup_uploads
  const { data, error } = await supabase.from('startup_uploads').select('id, name, status');
  if (error) { console.log('Error:', error); return; }
  
  const toRemove = data.filter(d => {
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
    const { error: delError } = await supabase.from('startup_uploads').delete().in('id', ids);
    if (delError) console.log('Delete error:', delError);
    else console.log('\n✅ Deleted', toRemove.length, 'public company entries from startup_uploads');
  }
  
  // Also clean discovered_startups
  const { data: discovered } = await supabase.from('discovered_startups').select('id, name');
  if (discovered) {
    const discToRemove = discovered.filter(d => {
      const nameLower = d.name.toLowerCase().trim();
      const isPublic = PUBLIC_COMPANIES.some(p => nameLower === p || nameLower.startsWith(p + ' '));
      const hasVentureQualifier = /ventures?|capital|investments?|partners?|fund/i.test(d.name);
      return isPublic && !hasVentureQualifier;
    });
    
    console.log('\nPublic companies in discovered_startups:', discToRemove.length);
    if (discToRemove.length > 0) {
      const ids = discToRemove.map(d => d.id);
      await supabase.from('discovered_startups').delete().in('id', ids);
      console.log('✅ Deleted', discToRemove.length, 'from discovered_startups');
    }
  }
}

removePublicCompanies();
