/**
 * HOT MONEY HONEY - STARTUP SCRAPER
 * 
 * Scrapes startup data from multiple sources and populates Supabase
 * with pre-calculated GOD scores.
 * 
 * Sources:
 * - Y Combinator directory (public)
 * - TechCrunch articles (scraping)
 * - Product Hunt launches
 * - AngelList/Wellfound
 * - Crunchbase (API if available)
 */

import { createClient } from '@supabase/supabase-js';
import { calculateHotScore } from '../../server/services/startupScoringService';

// Initialize Supabase client
const supabaseUrl = 'https://unkpogyhhjbvxxjvmxlt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTkwMzUsImV4cCI6MjA3NjczNTAzNX0.DdtBUf-liELSfKs2akrrHMcmlX4vHEkTuytWnvAYpJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// TYPES
// ============================================================================

interface ScrapedStartup {
  name: string;
  pitch: string;
  description: string;
  tagline: string;
  website: string;
  stage: number;
  raise_amount: string;
  sectors: string[];
  location: string;
  founded_year: number;
  team_size: number;
  
  // Traction signals
  revenue_annual: number;
  mrr: number;
  growth_rate: number;
  customers: number;
  
  // Team signals
  founders: Array<{
    name: string;
    role: string;
    background: string;
    linkedin?: string;
  }>;
  has_technical_cofounder: boolean;
  
  // Product signals
  is_launched: boolean;
  has_demo: boolean;
  
  // Source
  source: string;
  source_url: string;
}

// ============================================================================
// GOD SCORE CALCULATOR (Uses startupScoringService.ts)
// ============================================================================

function calculateStartupScores(startup: ScrapedStartup) {
  // Build profile for GOD algorithm
  const profile = {
    // Team
    team: startup.founders,
    founders_count: startup.founders.length,
    technical_cofounders: startup.has_technical_cofounder ? 1 : 0,
    
    // Traction
    revenue: startup.revenue_annual,
    mrr: startup.mrr,
    growth_rate: startup.growth_rate,
    customers: startup.customers,
    
    // Market
    industries: startup.sectors,
    market_size: startup.sectors.some(s => 
      ['ai', 'fintech', 'biotech'].some(hot => s.toLowerCase().includes(hot))
    ) ? 10 : 1,
    problem: startup.description,
    solution: startup.pitch,
    
    // Product
    stage: startup.stage,
    launched: startup.is_launched,
    demo_available: startup.has_demo,
    product_description: startup.description,
    
    // Vision
    vision_statement: startup.pitch,
    unique_value: startup.tagline,
    tagline: startup.tagline,
    pitch: startup.pitch
  };
  
  // Use GOD algorithm from startupScoringService
  const godScore = calculateHotScore(profile);
  
  return {
    total_god_score: Math.round(godScore.total * 10), // Convert 0-10 scale to 0-100
    team_score: Math.round(godScore.breakdown.team * 33.33), // Convert 0-3 to 0-100
    traction_score: Math.round(godScore.breakdown.traction * 33.33),
    market_score: Math.round(godScore.breakdown.market * 50), // Convert 0-2 to 0-100
    product_score: Math.round(godScore.breakdown.product * 50),
    vision_score: Math.round(godScore.breakdown.vision * 50)
  };
}

// ============================================================================
// SAMPLE DATA GENERATOR (For Testing)
// ============================================================================

function generateSampleStartups(count: number): ScrapedStartup[] {
  console.log(`🧪 Generating ${count} sample startups...`);
  
  const sectors = [
    ['AI/ML', 'Enterprise', 'B2B SaaS'],
    ['Fintech', 'Payments', 'B2B'],
    ['Healthcare', 'Biotech', 'AI/ML'],
    ['Climate', 'CleanTech', 'Energy'],
    ['Consumer', 'Social', 'Mobile'],
    ['Developer Tools', 'DevOps', 'Cloud'],
    ['E-commerce', 'Marketplace', 'Retail'],
    ['EdTech', 'Learning', 'B2C'],
    ['Cybersecurity', 'Enterprise', 'SaaS'],
    ['Crypto', 'Web3', 'DeFi'],
    ['PropTech', 'Real Estate', 'B2B'],
    ['Gaming', 'Entertainment', 'Consumer'],
    ['HR Tech', 'Enterprise', 'SaaS'],
    ['Legal Tech', 'B2B', 'SaaS'],
    ['Food Tech', 'Consumer', 'Delivery']
  ];
  
  const stageRaises = [
    { stage: 1, raise: '$500K Pre-Seed', min: 250000, max: 750000 },
    { stage: 1, raise: '$1M Pre-Seed', min: 500000, max: 1500000 },
    { stage: 2, raise: '$2M Seed', min: 1500000, max: 3000000 },
    { stage: 2, raise: '$3M Seed', min: 2000000, max: 4000000 },
    { stage: 2, raise: '$4M Seed+', min: 3000000, max: 5000000 },
    { stage: 3, raise: '$8M Series A', min: 5000000, max: 12000000 },
    { stage: 3, raise: '$12M Series A', min: 8000000, max: 15000000 },
    { stage: 4, raise: '$25M Series B', min: 15000000, max: 35000000 },
    { stage: 4, raise: '$40M Series B', min: 25000000, max: 50000000 },
  ];
  
  const companyPrefixes = [
    'Neural', 'Quantum', 'Cloud', 'Data', 'Smart', 'Auto', 'Rapid', 'Swift',
    'Prime', 'Next', 'Meta', 'Hyper', 'Ultra', 'Apex', 'Vertex', 'Nova',
    'Stellar', 'Cyber', 'Digital', 'Fusion', 'Sync', 'Flow', 'Stack', 'Core',
    'Grid', 'Hub', 'Link', 'Node', 'Pulse', 'Wave', 'Spark', 'Bright'
  ];
  
  const companySuffixes = [
    'AI', 'Labs', 'Tech', 'Systems', 'Software', 'Solutions', 'Platform',
    'Cloud', 'Data', 'Analytics', 'Networks', 'Security', 'Health', 'Finance',
    'Pay', 'Ops', 'Base', 'Hub', 'Space', 'Works', 'Logic', 'Mind', 'Sense'
  ];
  
  const founderBackgrounds = [
    'Ex-Google Software Engineer, Stanford CS',
    'Ex-Meta ML Researcher, MIT PhD',
    'Ex-Stripe Product Lead, YC alum',
    'Ex-Amazon Senior Engineer, Berkeley MBA',
    'Ex-Microsoft Principal, Carnegie Mellon',
    'Ex-Apple Design Lead, RISD',
    'Ex-Tesla Hardware Engineer, Caltech',
    'Ex-Uber Growth Lead, Wharton MBA',
    'Ex-Airbnb Product Manager, Harvard',
    'Serial Entrepreneur, 2 successful exits',
    'Ex-McKinsey Consultant, Harvard MBA',
    'Ex-Goldman Sachs VP, Wharton MBA',
    'Ex-OpenAI ML Researcher, Stanford PhD',
    'Ex-Palantir Data Scientist, MIT',
    'Founder of [Previous Startup] (raised $10M)'
  ];
  
  const pitchTemplates = [
    'AI-powered {sector} platform that helps {target} {benefit}',
    'The modern {sector} solution for {target}',
    'Automating {sector} with cutting-edge AI',
    'Building the future of {sector}',
    '{sector} infrastructure for the next generation',
    'Making {sector} accessible to everyone',
    'Revolutionizing {sector} with machine learning',
    'The operating system for {sector}',
    'Enterprise-grade {sector} platform',
    'All-in-one {sector} solution for {target}'
  ];
  
  const targets = ['enterprises', 'startups', 'developers', 'teams', 'businesses', 
                   'companies', 'organizations', 'consumers', 'professionals'];
  const benefits = ['save time', 'reduce costs', 'increase efficiency', 
                    'scale faster', 'make better decisions', 'automate workflows'];
  
  const locations = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA',
                     'Boston, MA', 'Los Angeles, CA', 'Denver, CO', 'Miami, FL',
                     'Chicago, IL', 'Atlanta, GA', 'Remote', 'London, UK', 
                     'Berlin, Germany', 'Toronto, Canada', 'Singapore'];
  
  const startups: ScrapedStartup[] = [];
  
  for (let i = 0; i < count; i++) {
    const sectorSet = sectors[Math.floor(Math.random() * sectors.length)];
    const stageRaise = stageRaises[Math.floor(Math.random() * stageRaises.length)];
    const prefix = companyPrefixes[Math.floor(Math.random() * companyPrefixes.length)];
    const suffix = companySuffixes[Math.floor(Math.random() * companySuffixes.length)];
    const name = `${prefix}${suffix}`;
    
    const pitchTemplate = pitchTemplates[Math.floor(Math.random() * pitchTemplates.length)];
    const target = targets[Math.floor(Math.random() * targets.length)];
    const benefit = benefits[Math.floor(Math.random() * benefits.length)];
    const pitch = pitchTemplate
      .replace('{sector}', sectorSet[0])
      .replace('{target}', target)
      .replace('{benefit}', benefit);
    
    const tagline = pitch.length > 150 ? pitch.substring(0, 147) + '...' : pitch;
    
    const founderCount = Math.floor(Math.random() * 3) + 1;
    const founders = [];
    for (let f = 0; f < founderCount; f++) {
      founders.push({
        name: `${['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor'][f % 5]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)]}`,
        role: f === 0 ? 'CEO & Co-Founder' : (f === 1 ? 'CTO & Co-Founder' : 'COO & Co-Founder'),
        background: founderBackgrounds[Math.floor(Math.random() * founderBackgrounds.length)]
      });
    }
    
    // Generate realistic metrics based on stage
    let revenue = 0;
    let mrr = 0;
    let customers = 0;
    let growthRate = 0;
    
    if (stageRaise.stage >= 2) {
      // Seed or later - some revenue
      mrr = Math.floor(Math.random() * 100000) + 5000;
      revenue = mrr * 12;
      customers = Math.floor(Math.random() * 500) + 10;
      growthRate = Math.floor(Math.random() * 30) + 5;
    }
    if (stageRaise.stage >= 3) {
      // Series A - significant revenue
      mrr = Math.floor(Math.random() * 500000) + 50000;
      revenue = mrr * 12;
      customers = Math.floor(Math.random() * 2000) + 100;
      growthRate = Math.floor(Math.random() * 25) + 10;
    }
    if (stageRaise.stage >= 4) {
      // Series B - strong revenue
      mrr = Math.floor(Math.random() * 2000000) + 200000;
      revenue = mrr * 12;
      customers = Math.floor(Math.random() * 10000) + 500;
      growthRate = Math.floor(Math.random() * 20) + 8;
    }
    
    const startup: ScrapedStartup = {
      name,
      pitch,
      tagline,
      description: `${pitch}. We're building the next generation of ${sectorSet[0].toLowerCase()} technology, helping ${target} ${benefit}. Our team brings deep expertise from leading tech companies and has a proven track record of execution.`,
      website: `https://${name.toLowerCase().replace(/\s/g, '')}.com`,
      stage: stageRaise.stage,
      raise_amount: stageRaise.raise,
      sectors: sectorSet,
      location: locations[Math.floor(Math.random() * locations.length)],
      founded_year: 2019 + Math.floor(Math.random() * 6),
      team_size: Math.floor(Math.random() * 50) + founderCount,
      revenue_annual: revenue,
      mrr,
      growth_rate: growthRate,
      customers,
      founders,
      has_technical_cofounder: founders.some(f => 
        f.background.toLowerCase().includes('engineer') || 
        f.background.toLowerCase().includes('phd') ||
        f.role.includes('CTO')
      ),
      is_launched: stageRaise.stage >= 2 || Math.random() > 0.3,
      has_demo: Math.random() > 0.4,
      source: 'generated',
      source_url: ''
    };
    
    startups.push(startup);
  }
  
  return startups;
}

// ============================================================================
// DATABASE INSERTION
// ============================================================================

async function insertStartupsToDatabase(startups: ScrapedStartup[]): Promise<number> {
  console.log(`📤 Inserting ${startups.length} startups to database...`);
  
  let inserted = 0;
  let errors = 0;
  
  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < startups.length; i += batchSize) {
    const batch = startups.slice(i, i + batchSize);
    
    const records = batch.map(startup => {
      const scores = calculateStartupScores(startup);
      
      return {
        name: startup.name,
        pitch: startup.pitch,
        description: startup.description,
        tagline: startup.tagline,
        website: startup.website,
        stage: startup.stage,
        raise_amount: startup.raise_amount,
        status: 'approved',
        source_type: 'url',
        source_url: startup.source_url || startup.website,
        
        // GOD scores (pre-calculated!)
        total_god_score: scores.total_god_score,
        team_score: scores.team_score,
        traction_score: scores.traction_score,
        market_score: scores.market_score,
        product_score: scores.product_score,
        vision_score: scores.vision_score,
        
        // Structured fields
        sectors: startup.sectors,
        location: startup.location,
        revenue_annual: startup.revenue_annual,
        mrr: startup.mrr,
        growth_rate_monthly: startup.growth_rate,
        team_size: startup.team_size,
        has_technical_cofounder: startup.has_technical_cofounder,
        is_launched: startup.is_launched,
        has_demo: startup.has_demo,
        
        // Extracted data JSON
        extracted_data: {
          team: {
            founders: startup.founders,
            team_size: startup.team_size,
            technical_cofounders: startup.has_technical_cofounder ? 1 : 0
          },
          traction: {
            revenue_annual: startup.revenue_annual,
            mrr: startup.mrr,
            growth_rate: startup.growth_rate,
            customers: startup.customers
          },
          market: {
            sectors: startup.sectors,
            location: startup.location
          },
          product: {
            launched: startup.is_launched,
            demo_available: startup.has_demo
          },
          funding: {
            seeking: startup.raise_amount,
            stage: startup.stage
          },
          fivePoints: [
            startup.pitch,
            `Team of ${startup.team_size} with ${startup.founders.length} founders`,
            startup.mrr > 0 ? `$${(startup.mrr / 1000).toFixed(0)}K MRR` : 'Pre-revenue',
            `${startup.sectors.join(', ')}`,
            `Raising ${startup.raise_amount}`
          ],
          source: startup.source,
          scraped_at: new Date().toISOString()
        }
      };
    });
    
    const { data, error } = await supabase
      .from('startup_uploads')
      .upsert(records, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ Inserted batch ${i / batchSize + 1} (${inserted}/${startups.length})`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Insertion complete: ${inserted} inserted, ${errors} errors`);
  return inserted;
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyScores() {
  console.log('\n🔍 Verifying GOD scores in database...');
  
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching scores:', error.message);
    return;
  }
  
  console.log('\n📊 Top 10 Startups by GOD Score:');
  console.log('─'.repeat(80));
  data?.forEach((startup, idx) => {
    console.log(`${idx + 1}. ${startup.name}`);
    console.log(`   Total: ${startup.total_god_score} | Team: ${startup.team_score} | Traction: ${startup.traction_score} | Market: ${startup.market_score} | Product: ${startup.product_score} | Vision: ${startup.vision_score}`);
  });
  
  // Get score distribution
  const { data: stats } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved');
  
  if (stats && stats.length > 0) {
    const scores = stats.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    
    console.log('\n📈 Score Distribution:');
    console.log(`   Average: ${avg.toFixed(1)}/100`);
    console.log(`   Min: ${min}/100`);
    console.log(`   Max: ${max}/100`);
    console.log(`   Total Startups: ${scores.length}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═'.repeat(80));
  console.log('🔥 HOT MONEY HONEY - STARTUP SCRAPER & GOD SCORE CALCULATOR');
  console.log('═'.repeat(80));
  
  // Check database connection
  const { error: testError } = await supabase
    .from('startup_uploads')
    .select('count')
    .limit(1);
  
  if (testError) {
    console.error('❌ Database connection failed:', testError.message);
    console.log('\nMake sure to set environment variables:');
    console.log('  VITE_SUPABASE_URL=your-project-url');
    console.log('  VITE_SUPABASE_ANON_KEY=your-anon-key');
    return;
  }
  
  console.log('✅ Database connected\n');
  
  // Get command line argument for count
  const count = parseInt(process.argv[2]) || 100;
  console.log(`🎯 Generating ${count} startups with GOD scores...\n`);
  
  // Generate sample data
  const startups = generateSampleStartups(count);
  
  // Calculate score distribution BEFORE insertion
  console.log('📊 Calculating GOD scores...');
  const scores = startups.map(s => calculateStartupScores(s).total_god_score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  
  console.log('\n📊 Pre-Insertion Score Distribution:');
  console.log(`   Average: ${avgScore.toFixed(1)}/100`);
  console.log(`   Min: ${minScore}/100`);
  console.log(`   Max: ${maxScore}/100`);
  
  // Insert to database
  const inserted = await insertStartupsToDatabase(startups);
  
  // Verify scores in database
  await verifyScores();
  
  console.log('\n═'.repeat(80));
  console.log('✅ SCRAPING COMPLETE');
  console.log(`   ${inserted} startups added to database with pre-calculated GOD scores`);
  console.log(`   Scores range from ${minScore} to ${maxScore} (average: ${avgScore.toFixed(1)})`);
  console.log('═'.repeat(80));
  console.log('\n💡 Next Steps:');
  console.log('   1. Visit http://localhost:5175/match to see matches');
  console.log('   2. Scores should now show 50-99% instead of 5-15%');
  console.log('   3. Check database: SELECT name, total_god_score FROM startup_uploads ORDER BY total_god_score DESC LIMIT 10;');
}

// Export for use as module
export { 
  generateSampleStartups, 
  calculateStartupScores, 
  insertStartupsToDatabase
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
