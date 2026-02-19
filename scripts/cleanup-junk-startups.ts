#!/usr/bin/env tsx
/**
 * Database Cleanup Script - Purge Junk Startups
 * 
 * Applies the same entity quality filters (from frameParser.ts) to existing database records.
 * Marks invalid startups as 'rejected' to remove them from the active pipeline.
 * 
 * Run with: npx tsx scripts/cleanup-junk-startups.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// ENTITY QUALITY FILTER (matches frameParser.ts logic)
// ============================================================================

function validateEntityQuality(entity: string): { valid: boolean; reason?: string } {
  if (!entity) return { valid: false, reason: 'empty' };
  if (entity.length < 2) return { valid: false, reason: 'too_short' };
  if (entity.length <= 3 && !/^[A-Z][a-z]?[A-Z]?$/.test(entity)) return { valid: false, reason: 'short_invalid' };
  if (!/[a-zA-Z]/.test(entity)) return { valid: false, reason: 'no_letters' };
  
  // Reject lowercase-starting names (headline fragments)
  if (/^[a-z]/.test(entity)) return { valid: false, reason: 'lowercase_start' };
  
  // Stoplist
  const stopList = [
    'It', 'How', 'Why', 'What', 'When', 'Where', 'The', 'A', 'An',
    'Your', 'My', 'Our', 'Their', 'His', 'Her',
    'You', 'We', 'They', 'Us', 'Them',
    'For', 'To', 'With', 'At', 'In', 'On',
    // Month names
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
    'JSON', 'HTML', 'CSS', 'XML', 'YAML', 'SQL', 'API', 'REST', 'RBAC',
    'Image', 'Fixing', 'Locate', 'Local', 'Markdown', 'Code',
    'Launch', 'Inside', 'Using', 'Building', 'Making', 'Creating',
    'Getting', 'Setting', 'Running', 'Testing', 'Deploying',
    'New', 'Old', 'Best', 'Top', 'First', 'Last', 'Next', 'Every',
    'Entire', 'Simple', 'Basic', 'Advanced', 'Quick', 'Full',
    'After', 'Before', 'During', 'Until', 'Since', 'About',
    'General', 'Move', 'Transition', 'Avoid', 'Think', 'Grow',
    'Learn', 'Start', 'Stop', 'Try', 'Keep', 'Find', 'Help',
    'Open', 'Close', 'Save', 'Share', 'Watch', 'Meet', 'Join',
    'Most', 'More', 'Less', 'Much', 'Many', 'Some', 'Any', 'All',
    'Way', 'End', 'Part', 'Real', 'True', 'False', 'None',
    'Worst', 'Newest', 'Biggest', 'Smallest', 'Latest', 'Oldest',
    'Shop', 'Work', 'Play', 'Live', 'Show', 'Talk', 'Deal', 'Plan',
    'View', 'Pick', 'List', 'Guide', 'Review', 'Report', 'Update',
  ];
  if (stopList.some(stop => entity.toLowerCase() === stop.toLowerCase())) {
    return { valid: false, reason: 'stoplist' };
  }
  
  // Financing terms
  const financingTerms = ['Funding', 'Investment', 'Round', 'Capital', 'Venture'];
  if (financingTerms.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return { valid: false, reason: 'financing_term' };
  }
  
  // Funding stages
  const fundingStages = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Series E', 'IPO', 'SPAC'];
  if (fundingStages.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return { valid: false, reason: 'funding_stage' };
  }
  
  // Generic categories
  const genericTerms = [
    'Researchers', 'Founders', 'Startups', 'VCs', 'VC', 'Investors', 'Executives',
    'Leaders', 'People', 'Companies', 'Firms', 'Teams', 'Scientists',
    'MIT Researchers', 'Stanford Researchers', 'Former USDS Leaders',
    'Indian Startups', 'Big VCs', 'SMEs', 'Angel', 'Angels',
    'Unconventional', 'Conventional', 'Traditional', 'Modern', 'Special',
    'Show', 'Show HN', 'Launch HN', 'Ask HN', 'Tell HN', 'How To', 'Humans',
    'Google Chrome', 'GitHub CEO', 'Google CEO', 'Apple CEO',
    'Microsoft CEO', 'Amazon CEO', 'Meta CEO',
    'New Era', 'Secret Backdoor', 'Solar Cells', 'Cron Translator',
    'The Power', 'React Refs', 'Codex App', 'How Can You',
    'Kubernetes API', 'Markdown Projects',
    'Finnish', 'Japanese', 'Chinese', 'American', 'British', 'European',
    'Korean', 'Israeli', 'Canadian', 'German', 'French',
  ];
  if (genericTerms.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return { valid: false, reason: 'generic_term' };
  }
  
  // Geographic entities
  const places = [
    'Africa', 'Asia', 'Europe', 'America', 'Australia',
    'USA', 'UK', 'India', 'China', 'Japan', 'Germany', 'France', 'Brazil',
    'Silicon Valley', 'Bay Area', 'New York', 'London', 'Berlin', 'Washington',
    'Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai', 'Pune',
    'Shanghai', 'Beijing', 'Shenzhen', 'Hong Kong', 'Singapore',
    'Tokyo', 'Seoul', 'Paris', 'Amsterdam', 'Stockholm', 'Tel Aviv',
    'Dubai', 'Lagos', 'Nairobi', 'Cape Town', 'Cairo',
    'Toronto', 'Vancouver', 'Sydney', 'Melbourne', 'São Paulo',
    'San Francisco', 'Los Angeles', 'Seattle', 'Boston', 'Austin',
    'African', 'Asian', 'European', 'American', 'Australian',
    'Moroccan', 'Ethiopian', 'Nigerian', 'Kenyan', 'South African',
    'Latin', 'Central', 'Caribbean', 'Nordic', 'Scandinavian',
    'Middle Eastern', 'Southeast Asian',
  ];
  if (places.some(place => entity.toLowerCase() === place.toLowerCase())) {
    return { valid: false, reason: 'geographic' };
  }
  
  // Well-known companies (major blacklist)
  const wellKnownCompanies = [
    // FAANG+ / Big Tech
    'Google', 'Apple', 'Microsoft', 'Amazon', 'Meta', 'Facebook',
    'Netflix', 'Tesla', 'Nvidia', 'Intel', 'AMD', 'IBM', 'Oracle',
    'Salesforce', 'SAP', 'Adobe', 'Cisco', 'Dell', 'HP', 'Qualcomm',
    // Major platforms
    'Twitter', 'X', 'LinkedIn', 'TikTok', 'Snapchat', 'Pinterest',
    'Reddit', 'Discord', 'Slack', 'Zoom', 'Dropbox', 'Box',
    'GitHub', 'GitLab', 'Atlassian', 'Jira', 'Confluence',
    // Unicorns
    'Stripe', 'SpaceX', 'ByteDance', 'Databricks', 'Canva', 'Figma',
    'Notion', 'Airtable', 'Miro', 'Webflow', 'Vercel', 'Supabase',
    'OpenAI', 'Anthropic', 'Stability AI', 'Hugging Face', 'Cohere',
    'Weights And Biases', 'Scale AI', 'Snowflake',
    'Datadog', 'MongoDB', 'Elastic', 'Confluent', 'HashiCorp',
    // Payment/Fintech
    'PayPal', 'Square', 'Block', 'Coinbase', 'Robinhood', 'Plaid',
    'Visa', 'Mastercard', 'American Express', 'Amex', 'Chase', 'JPMorgan',
    'Goldman Sachs', 'Morgan Stanley', 'Wells Fargo', 'Bank Of America',
    // E-commerce
    'Shopify', 'Etsy', 'eBay', 'Alibaba', 'JD', 'Temu', 'Shein',
    'Uber', 'Lyft', 'DoorDash', 'Instacart', 'Airbnb', 'Booking',
    // Cloud
    'AWS', 'Azure', 'GCP', 'Cloudflare', 'Akamai', 'Linode', 'DigitalOcean',
    'Heroku', 'Netlify', 'Railway', 'Render',
    // Enterprise
    'Workday', 'ServiceNow', 'Zendesk', 'HubSpot', 'Mailchimp',
    'Twilio', 'SendGrid', 'Segment', 'Amplitude', 'Mixpanel',
    // Gaming
    'Roblox', 'Epic Games', 'Riot Games', 'Valve', 'Steam', 'Unity',
    'Unreal', 'Activision', 'Blizzard', 'EA', 'Electronic Arts',
    // Security
    'Okta', 'Auth0', 'CrowdStrike', 'Palo Alto', 'Fortinet', 'SentinelOne',
    'Snyk', 'JFrog', 'Docker', 'Kubernetes', 'Jenkins', 'CircleCI',
    // Productivity
    'Asana', 'Monday', 'ClickUp', 'Trello', 'Basecamp', 'Linear',
    'Obsidian', 'Roam', 'Evernote', 'OneNote',
    // Media
    'YouTube', 'Spotify', 'SoundCloud', 'Twitch', 'Substack', 'Medium',
    'WordPress', 'Wix', 'Squarespace', 'Ghost', 'Contentful',
    // Healthcare
    'Moderna', 'Pfizer', 'Johnson', 'AstraZeneca', 'Novartis', 'Roche',
    '23andMe', 'Oscar Health', 'Ro', 'Hims', 'Teladoc',
    // Mobility
    'Waymo', 'Cruise', 'Rivian', 'Lucid', 'NIO', 'BYD', 'Ford', 'GM',
    // Crypto
    'Binance', 'FTX', 'Kraken', 'Gemini', 'Celsius', 'BlockFi',
    'Alchemy', 'Infura', 'Metamask', 'Opensea', 'Uniswap',
    // Well-known apps/tools
    'Camscanner', 'CamScanner', 'Ko-fi', 'Kofi', 'Patreon',
    'ClickFunnels', 'Teachable', 'Podia', 'Gumroad', 'Lemon Squeezy',
    'Checkr', 'Greenhouse', 'Lever', 'Ashby', 'BambooHR',
    'Nextdoor', 'Ring', 'Nest', 'Arlo', 'SimpliSafe',
    'OneSignal', 'Pusher', 'Ably', 'PubNub', 'Stream',
    'ClickHouse', 'TimescaleDB', 'QuestDB', 'InfluxDB', 'Prometheus',
    'Preply', 'Duolingo', 'Babbel', 'Rosetta Stone',
    'CurseForge', 'Modrinth', 'Thunderstore',
    // Other
    'Fundamental', 'Basic', 'Essential', 'Primary', 'Secondary',
    'Linq', 'Query', 'Database', 'SQL', 'NoSQL', 'Redis', 'PostgreSQL',
    'Stablecoins', 'Stablecoin', 'Non-venture', 'Venture',
  ];
  if (wellKnownCompanies.some(company => entity.toLowerCase() === company.toLowerCase())) {
    return { valid: false, reason: 'well_known_company' };
  }
  
  // Check "X AI" variants
  const entityWithoutAI = entity.replace(/\s+AI$/i, '').trim();
  if (entityWithoutAI !== entity && wellKnownCompanies.some(company => entityWithoutAI.toLowerCase() === company.toLowerCase())) {
    return { valid: false, reason: 'well_known_company_ai_variant' };
  }
  
  // Famous persons
  const famousPersons = [
    'Jim Cramer', 'Palmer Luckey', 'Tony Fadell', 'Elon Musk', 'Sam Altman',
    'Jensen Huang', 'Satya Nadella', 'Tim Cook', 'Mark Zuckerberg', 'Jeff Bezos',
    'Bill Gates', 'Steve Jobs', 'Sundar Pichai', 'Jack Dorsey', 'Brian Chesky',
    'Travis Kalanick', 'Adam Neumann', 'Elizabeth Holmes', 'Do Kwon', 'SBF',
    'Adam Mosseri', 'Andy Jassy', 'Dara Khosrowshahi', 'Susan Wojcicki',
    'Kevin Systrom', 'Evan Spiegel', 'Bobby Kotick', 'Garry Tan',
    // Content creators
    'Logan Paul', 'Jake Paul', 'MrBeast', 'PewDiePie', 'Marques Brownlee',
    'Bezos', 'Musk', 'Zuckerberg', 'Altman', 'Gates', 'Jobs', 'Cook',
  ];
  if (famousPersons.some(p => entity.toLowerCase() === p.toLowerCase())) {
    return { valid: false, reason: 'famous_person' };
  }
  
  // Compound patterns
  if (/^(Backed|Chinese|Indian|Top|Leading|Global|Major|Biggest)\s+(AI|ML|Tech|Cloud)\s+(Startup|Company|Firm)/i.test(entity)) {
    return { valid: false, reason: 'compound_pattern' };
  }
  
  if (/\b(AI|ML)\s+(Startup|Company|Firm)\s+/i.test(entity) && entity.split(/\s+/).length > 3) {
    return { valid: false, reason: 'ai_startup_pattern' };
  }
  
  if (/^(US|EU|UK|UAE|APAC|EMEA|LATAM|MENA)\s+(AI|Tech|Fintech|Startup|Cloud|Crypto|SaaS)$/i.test(entity)) {
    return { valid: false, reason: 'region_tech_pattern' };
  }
  
  if (/^(Startup|Company|Firm)\s+/i.test(entity)) {
    return { valid: false, reason: 'startup_prefix' };
  }
  
  if (/\b(startup|firm|platform|service|solution|provider)s?\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    return { valid: false, reason: 'descriptor_suffix' };
  }
  
  if (/\bcompany\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    if (!/^The\s+/i.test(entity) && entity.split(/\s+/).length === 2) {
      return { valid: false, reason: 'company_suffix' };
    }
  }
  
  if (/\b(funding|investment|round|capital)\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    return { valid: false, reason: 'funding_suffix' };
  }
  
  if (/\b(Million|Billion|Thousand)\s+(Series|Round|Seed|Pre-Seed)/i.test(entity)) {
    return { valid: false, reason: 'amount_stage_pattern' };
  }
  
  if (/^(When|How|Why|What|Where|While|If|As|Since|After|Before)\s+/i.test(entity)) {
    return { valid: false, reason: 'question_word_start' };
  }
  
  if (/^Former\s+/i.test(entity)) {
    return { valid: false, reason: 'former_prefix' };
  }
  
  // Block political/government references
  if (/^White House$/i.test(entity) || /^Capitol$/i.test(entity) || /^Senate$/i.test(entity) || /^Congress$/i.test(entity)) {
    return { valid: false, reason: 'government' };
  }
  
  // Block dollar amounts
  if (/^\$\d+(\.\d+)?(k|m|b|bn|million|billion|thousand)?$/i.test(entity)) {
    return { valid: false, reason: 'dollar_amount' };
  }
  
  // Block chemistry/science terms
  const scienceTerms = ['Transition Metal', 'Carbon', 'Hydrogen', 'Oxygen', 'Nitrogen', 'Silicon', 'Lithium', 'Sodium', 'Potassium', 'Calcium'];
  if (scienceTerms.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return { valid: false, reason: 'science_term' };
  }
  
  // Block single-word generic descriptors
  const moreGenericWords = ['Reclamation', 'Move', 'Star', 'Gold', 'Silver', 'Bronze', 'Game', 'Play', 'Sport', 'Music', 'Art', 'Book', 'Film', 'Movie', 'Show', 'Series', 'Episode', 'Season', 'Chapter', 'Volume', 'Issue', 'Edition', 'Version', 'Release', 'Update', 'Patch', 'Fix', 'Bug', 'Feature', 'Enhancement', 'Improvement', 'Change', 'Modification', 'Adjustment'];
  if (moreGenericWords.some(w => entity.toLowerCase() === w.toLowerCase())) {
    return { valid: false, reason: 'single_generic_word' };
  }
  
  // Too long (descriptions, not names)
  if (entity.split(' ').length > 4) {
    return { valid: false, reason: 'too_long' };
  }
  
  // Single generic words
  const singleWords = ['Read', 'Write', 'Build', 'Create', 'Make', 'Learn', 'Teach', 'Code', 'Test', 'Deploy', 'Launch', 'Release', 'Ship', 'Scale', 'Grow', 'Hire', 'Fire', 'Quit', 'Join', 'Leave', 'Exit', 'Enter', 'Start', 'Stop', 'Begin', 'Finish', 'Win', 'Lose', 'Fail', 'Succeed', 'Rise', 'Fall', 'Up', 'Down', 'Left', 'Right', 'Forward', 'Backward', 'Inside', 'Outside', 'Above', 'Below', 'Over', 'Under', 'Through', 'Around', 'Between', 'Among', 'Across', 'Along', 'Past', 'Beyond', 'Behind', 'Ahead', 'Near', 'Far', 'Close', 'Distant', 'Here', 'There', 'Everywhere', 'Nowhere', 'Somewhere', 'Anywhere', 'Bluetooth', 'WiFi', 'Internet', 'Web', 'Network', 'Protocol', 'Server', 'Client', 'Cloud', 'Edge', 'Core', 'Node', 'Cluster', 'Mesh', 'Grid', 'Hub', 'Spoke', 'Ring', 'Star', 'Tree', 'Graph', 'Wisdom', 'Knowledge', 'Intelligence', 'Understanding', 'Insight', 'Awareness', 'Consciousness', 'Thought', 'Mind', 'Brain', 'Heart', 'Soul', 'Spirit', 'Body', 'Health', 'Wealth', 'Power', 'Force', 'Energy', 'Strength', 'Speed', 'Time', 'Space', 'Place', 'Location', 'Position', 'Direction', 'Distance', 'Range', 'Scope', 'Scale', 'Size', 'Shape', 'Form', 'Structure', 'Pattern', 'Design', 'Style', 'Type', 'Kind', 'Sort', 'Class', 'Category', 'Group', 'Set', 'Collection', 'List', 'Array', 'Vector', 'Matrix', 'Tensor', 'Field', 'Domain', 'Range', 'Function', 'Method', 'Process', 'System', 'Model', 'Framework', 'Architecture', 'Infrastructure', 'Platform', 'Service', 'Solution', 'Product', 'Tool', 'Utility', 'Application', 'Program', 'Software', 'Hardware', 'Firmware', 'Middleware', 'Interface', 'Protocol', 'Standard', 'Specification', 'Implementation', 'Execution', 'Operation', 'Action', 'Activity', 'Task', 'Job', 'Work', 'Project', 'Program', 'Initiative', 'Campaign', 'Mission', 'Vision', 'Goal', 'Objective', 'Target', 'Aim', 'Purpose', 'Reason', 'Cause', 'Effect', 'Result', 'Outcome', 'Output', 'Input', 'Feedback', 'Response', 'Reaction', 'Interaction', 'Transaction', 'Exchange', 'Transfer', 'Transition', 'Transformation', 'Change', 'Shift', 'Move', 'Motion', 'Movement', 'Flow', 'Stream', 'Current', 'Trend', 'Pattern', 'Cycle', 'Wave', 'Pulse', 'Beat', 'Rhythm', 'Tempo', 'Rate', 'Frequency', 'Period', 'Duration', 'Interval', 'Span', 'Length', 'Width', 'Height', 'Depth', 'Volume', 'Capacity', 'Quantity', 'Amount', 'Number', 'Count', 'Total', 'Sum', 'Average', 'Mean', 'Median', 'Mode', 'Range', 'Variance', 'Deviation', 'Error', 'Noise', 'Signal', 'Data', 'Information', 'Content', 'Message', 'Communication', 'Language', 'Speech', 'Text', 'Document', 'File', 'Record', 'Entry', 'Item', 'Element', 'Component', 'Part', 'Piece', 'Unit', 'Module', 'Package', 'Bundle', 'Suite', 'Stack', 'Heap', 'Queue', 'Buffer', 'Cache', 'Store', 'Repository', 'Database', 'Warehouse', 'Lake', 'Pool', 'Sink', 'Source', 'Origin', 'Destination', 'Endpoint', 'Gateway', 'Bridge', 'Link', 'Connection', 'Binding', 'Coupling', 'Integration', 'Aggregation', 'Composition', 'Inheritance', 'Polymorphism', 'Encapsulation', 'Abstraction', 'Generalization', 'Specialization', 'Realization', 'Association', 'Dependency', 'Relationship', 'Entity', 'Object', 'Instance', 'Class', 'Interface', 'Abstract', 'Concrete', 'Generic', 'Specific', 'General', 'Particular', 'Individual', 'Collective', 'Singular', 'Plural', 'Unique', 'Common', 'Rare', 'Frequent', 'Occasional', 'Regular', 'Irregular', 'Normal', 'Abnormal', 'Standard', 'Custom', 'Default', 'Optional', 'Required', 'Mandatory', 'Voluntary', 'Automatic', 'Manual', 'Dynamic', 'Static', 'Active', 'Passive', 'Reactive', 'Proactive', 'Interactive', 'Responsive', 'Adaptive', 'Flexible', 'Rigid', 'Fixed', 'Variable', 'Constant', 'Mutable', 'Immutable', 'Persistent', 'Transient', 'Temporary', 'Permanent', 'Eternal', 'Infinite', 'Finite', 'Limited', 'Unlimited', 'Bounded', 'Unbounded', 'Open', 'Closed', 'Public', 'Private', 'Protected', 'Internal', 'External', 'Local', 'Global', 'Regional', 'National', 'International', 'Universal', 'Cosmic', 'Galactic', 'Solar', 'Lunar', 'Stellar', 'Planetary', 'Terrestrial', 'Celestial', 'Spatial', 'Temporal', 'Eternal', 'Momentary', 'Instant', 'Moment', 'Second', 'Minute', 'Hour', 'Day', 'Week', 'Month', 'Year', 'Decade', 'Century', 'Millennium', 'Era', 'Age', 'Epoch', 'Period', 'Phase', 'Stage', 'Step', 'Level', 'Tier', 'Layer', 'Grade', 'Rank', 'Order', 'Sequence', 'Series', 'Chain', 'Line', 'Path', 'Route', 'Course', 'Track', 'Trail', 'Road', 'Street', 'Avenue', 'Boulevard', 'Highway', 'Freeway', 'Expressway', 'Parkway', 'Throughway', 'Bypass', 'Shortcut', 'Detour', 'Loop', 'Circle', 'Square', 'Triangle', 'Rectangle', 'Polygon', 'Pentagon', 'Hexagon', 'Octagon', 'Oval', 'Ellipse', 'Sphere', 'Cube', 'Cone', 'Cylinder', 'Pyramid', 'Prism', 'Torus', 'Helix', 'Spiral', 'Curve', 'Arc', 'Angle', 'Corner', 'Edge', 'Vertex', 'Face', 'Surface', 'Plane', 'Line', 'Point', 'Dot', 'Spot', 'Mark', 'Sign', 'Symbol', 'Icon', 'Logo', 'Brand', 'Name', 'Title', 'Label', 'Tag', 'Badge', 'Flag', 'Banner', 'Header', 'Footer', 'Sidebar', 'Menu', 'Toolbar', 'Statusbar', 'Scrollbar', 'Slider', 'Button', 'Switch', 'Toggle', 'Checkbox', 'Radio', 'Dropdown', 'Select', 'Input', 'Output', 'Textarea', 'Textbox', 'Field', 'Form', 'Panel', 'Dialog', 'Modal', 'Popup', 'Tooltip', 'Alert', 'Notification', 'Message', 'Toast', 'Snackbar', 'Badge', 'Chip', 'Tag', 'Label', 'Card', 'Tile', 'Widget', 'Component', 'Control', 'Element', 'Container', 'Wrapper', 'Layout', 'Grid', 'Flexbox', 'Column', 'Row', 'Cell', 'Block', 'Inline', 'Float', 'Position', 'Display', 'Visibility', 'Opacity', 'Transform', 'Transition', 'Animation', 'Effect', 'Filter', 'Shadow', 'Border', 'Margin', 'Padding', 'Width', 'Height', 'Size', 'Color', 'Background', 'Foreground', 'Font', 'Text', 'Content', 'Image', 'Video', 'Audio', 'Media', 'Resource', 'Asset', 'File', 'Document', 'Page', 'Screen', 'Window', 'Frame', 'Canvas', 'Context', 'Render', 'Paint', 'Draw', 'Fill', 'Stroke', 'Clip', 'Mask', 'Blend', 'Composite', 'Merge', 'Split', 'Join', 'Combine', 'Separate', 'Divide', 'Multiply', 'Add', 'Subtract', 'Increment', 'Decrement', 'Increase', 'Decrease', 'Expand', 'Collapse', 'Fold', 'Unfold', 'Wrap', 'Unwrap', 'Pack', 'Unpack', 'Compress', 'Decompress', 'Encode', 'Decode', 'Encrypt', 'Decrypt', 'Hash', 'Sign', 'Verify', 'Validate', 'Sanitize', 'Escape', 'Unescape', 'Parse', 'Format', 'Normalize', 'Denormalize', 'Serialize', 'Deserialize', 'Stringify', 'Parse', 'Convert', 'Transform', 'Map', 'Reduce', 'Filter', 'Sort', 'Search', 'Find', 'Locate', 'Detect', 'Identify', 'Recognize', 'Match', 'Compare', 'Contrast', 'Differentiate', 'Distinguish', 'Discriminate', 'Categorize', 'Classify', 'Group', 'Cluster', 'Segment', 'Partition', 'Divide', 'Split', 'Merge', 'Combine', 'Unite', 'Join', 'Connect', 'Link', 'Bind', 'Attach', 'Detach', 'Disconnect', 'Unlink', 'Unbind', 'Separate', 'Isolate', 'Quarantine', 'Contain', 'Release', 'Free', 'Lock', 'Unlock', 'Secure', 'Protect', 'Guard', 'Shield', 'Defend', 'Attack', 'Invade', 'Penetrate', 'Breach', 'Exploit', 'Hack', 'Crack', 'Break', 'Fix', 'Repair', 'Restore', 'Recover', 'Backup', 'Archive', 'Store', 'Save', 'Load', 'Fetch', 'Get', 'Put', 'Post', 'Delete', 'Remove', 'Clear', 'Reset', 'Refresh', 'Reload', 'Restart', 'Reboot', 'Shutdown', 'Startup', 'Initialize', 'Finalize', 'Cleanup', 'Garbage', 'Collect', 'Dispose', 'Destroy', 'Kill', 'Terminate', 'Abort', 'Cancel', 'Stop', 'Pause', 'Resume', 'Continue', 'Proceed', 'Advance', 'Progress', 'Regress', 'Return', 'Yield', 'Await', 'Async', 'Sync', 'Promise', 'Future', 'Past', 'Present', 'Now', 'Then', 'Soon', 'Later', 'Eventually', 'Always', 'Never', 'Sometimes', 'Often', 'Rarely', 'Seldom', 'Usually', 'Normally', 'Typically', 'Generally', 'Specifically', 'Particularly', 'Especially', 'Notably', 'Remarkably', 'Significantly', 'Substantially', 'Considerably', 'Marginally', 'Slightly', 'Barely', 'Hardly', 'Scarcely', 'Nearly', 'Almost', 'Approximately', 'Roughly', 'About', 'Around', 'Circa', 'Exactly', 'Precisely', 'Accurately', 'Correctly', 'Properly', 'Appropriately', 'Suitably', 'Adequately', 'Sufficiently', 'Insufficiently', 'Inadequately', 'Improperly', 'Incorrectly', 'Inaccurately', 'Imprecisely', 'Vaguely', 'Ambiguously', 'Clearly', 'Obviously', 'Evidently', 'Apparently', 'Seemingly', 'Presumably', 'Supposedly', 'Allegedly', 'Reportedly', 'Purportedly', 'Ostensibly', 'Nominally', 'Technically', 'Theoretically', 'Hypothetically', 'Practically', 'Realistically', 'Ideally', 'Optimally', 'Maximally', 'Minimally', 'Optimally', 'Suboptimally'];
  
  if (singleWords.some(w => entity.toLowerCase() === w.toLowerCase()) && entity.split(/\s+/).length === 1) {
    return { valid: false, reason: 'single_generic_word' };
  }
  
  return { valid: true };
}

// ============================================================================
// MAIN CLEANUP LOGIC
// ============================================================================

async function cleanupJunkStartups(dryRun: boolean = false) {
  console.log('🧹 Database Cleanup - Junk Startup Removal');
  console.log('==========================================\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Fetch all startups
  console.log('📥 Fetching all startups from database...');
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, status, total_god_score, source_type, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching startups:', error.message);
    process.exit(1);
  }
  
  console.log(`✅ Fetched ${startups.length} startups\n`);
  
  // Validate each startup
  const invalid: any[] = [];
  const valid: any[] = [];
  const alreadyRejected: any[] = [];
  
  for (const startup of startups) {
    if (startup.status === 'rejected') {
      alreadyRejected.push(startup);
      continue;
    }
    
    const validation = validateEntityQuality(startup.name);
    if (!validation.valid) {
      invalid.push({ ...startup, reason: validation.reason });
    } else {
      valid.push(startup);
    }
  }
  
  console.log('📊 VALIDATION RESULTS');
  console.log('=====================');
  console.log(`✅ Valid startups: ${valid.length}`);
  console.log(`❌ Invalid startups: ${invalid.length}`);
  console.log(`⏭️  Already rejected: ${alreadyRejected.length}`);
  console.log(`📈 Total: ${startups.length}\n`);
  
  if (invalid.length === 0) {
    console.log('🎉 No junk startups found! Database is clean.\n');
    return;
  }
  
  // Group invalid startups by reason
  const byReason = invalid.reduce((acc, s) => {
    acc[s.reason] = acc[s.reason] || [];
    acc[s.reason].push(s);
    return acc;
  }, {} as Record<string, any[]>);
  
  console.log('🔍 INVALID STARTUPS BY REASON');
  console.log('==============================');
  for (const [reason, items] of Object.entries(byReason)) {
    console.log(`\n${reason} (${items.length}):`);
    items.slice(0, 10).forEach(s => {
      console.log(`  • ${s.name} (GOD: ${s.total_god_score || 'N/A'}, ${s.source_type || 'unknown'})`);
    });
    if (items.length > 10) {
      console.log(`  ... and ${items.length - 10} more`);
    }
  }
  
  if (dryRun) {
    console.log('\n\n💡 DRY RUN COMPLETE - Run without --dry-run to apply changes\n');
    return;
  }
  
  // Mark invalid startups as rejected
  console.log('\n\n🗑️  MARKING INVALID STARTUPS AS REJECTED');
  console.log('==========================================\n');
  
  let updated = 0;
  let failed = 0;
  
  for (const startup of invalid) {
    const { error } = await supabase
      .from('startup_uploads')
      .update({ status: 'rejected' })
      .eq('id', startup.id);
    
    if (error) {
      console.log(`❌ Failed to reject ${startup.name}: ${error.message}`);
      failed++;
    } else {
      updated++;
      if (updated % 50 === 0) {
        console.log(`✅ Rejected ${updated}/${invalid.length}...`);
      }
    }
  }
  
  console.log(`\n✅ Rejected ${updated} invalid startups`);
  if (failed > 0) {
    console.log(`❌ Failed to reject ${failed} startups`);
  }
  
  console.log('\n🎉 CLEANUP COMPLETE\n');
}

// ============================================================================
// CLI
// ============================================================================

const dryRun = process.argv.includes('--dry-run');
cleanupJunkStartups(dryRun).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
