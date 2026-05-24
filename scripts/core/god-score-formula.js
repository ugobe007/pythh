#!/usr/bin/env node
/**
 * GOD SCORE V6.1 - STAGE-ADJUSTED WEIGHTS + SOCIAL SIGNALS
 * =========================================================
 * No AI/ML API calls - pure math and logic
 * 
 * Philosophy: Ruthlessly honest scoring with stage-appropriate expectations
 * - Pre-seed: Team & product velocity matter most (no revenue expected)
 * - Seed: Early traction signals + team + velocity + social proof
 * - Series A: Revenue required (ARR, growth, unit economics) + social validation
 * - Series B+: Scale metrics (ARR, efficiency, margins) + brand awareness
 * - Social signals: 7-10% weight (community validation from Twitter/Reddit/HN)
 * - Most startups should score 20-50
 * - Only exceptional startups score 70+
 * - Data-driven, not vibes
 * 
 * Run: node god-score-formula.js
 * Run limited: node god-score-formula.js --limit 100
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// =============================================================================
// STAGE-ADJUSTED WEIGHTS (total = 100 each stage) - WITH SOCIAL SIGNALS
// =============================================================================
const STAGE_WEIGHTS = {
  1: { // Pre-seed - NO revenue expected
    team: 32,
    product_velocity: 23,
    market_timing: 18,
    customer_validation: 15,
    social: 7,  // ✅ Social validation matters even early
    vision: 5
  },
  2: { // Seed - Early revenue signals
    team: 23,
    traction: 23,  // Users, engagement, early revenue
    product_velocity: 18,
    market_timing: 13,
    customer_validation: 8,
    social: 10,  // ✅ Higher weight - social proof important
    vision: 5
  },
  3: { // Series A - Revenue required
    traction: 38,  // ARR, growth, unit economics
    team: 18,
    market: 18,
    product: 13,
    social: 8,  // ✅ Social signals = market validation
    vision: 5
  },
  4: { // Series B+ - Scale metrics
    traction: 47,  // ARR, efficiency, margins
    market: 18,
    team: 13,
    product: 9,
    social: 8,  // ✅ Social buzz = brand awareness
    vision: 5
  }
};

// =============================================================================
// SECTOR DIFFICULTY MULTIPLIERS (for overall scoring)
// Hot sectors = easier to raise but higher bar
// Cold sectors = harder to raise but lower expectations
// =============================================================================
const SECTOR_MULTIPLIERS = {
  // HOT - High competition, need exceptional metrics
  'AI/ML': { difficulty: 1.2, demand: 100 },
  'AI': { difficulty: 1.2, demand: 100 },
  'Climate Tech': { difficulty: 1.1, demand: 85 },
  'Climate': { difficulty: 1.1, demand: 85 },
  'Healthcare': { difficulty: 1.1, demand: 90 },
  'Fintech': { difficulty: 1.1, demand: 95 },
  'FinTech': { difficulty: 1.1, demand: 95 },
  'Cybersecurity': { difficulty: 1.15, demand: 80 },
  
  // WARM - Solid demand
  'SaaS': { difficulty: 1.0, demand: 75 },
  'B2B SaaS': { difficulty: 1.0, demand: 75 },
  'Enterprise': { difficulty: 1.0, demand: 70 },
  'Developer Tools': { difficulty: 1.0, demand: 65 },
  'DevTools': { difficulty: 1.0, demand: 65 },
  'EdTech': { difficulty: 0.95, demand: 55 },
  'Gaming': { difficulty: 0.95, demand: 50 },
  
  // COOLING - Lower demand
  'Crypto': { difficulty: 0.85, demand: 30 },
  'Web3': { difficulty: 0.85, demand: 25 },
  'DeFi': { difficulty: 0.8, demand: 20 },
  'Consumer': { difficulty: 0.9, demand: 40 },
  'Social': { difficulty: 0.85, demand: 25 },
  
  // DEFAULT
  'default': { difficulty: 1.0, demand: 50 }
};

// =============================================================================
// INDUSTRY-SPECIFIC GOD SCORING CONFIGURATIONS
// Each industry has different benchmarks and expectations
// =============================================================================
const INDUSTRY_BENCHMARKS = {
  // BIOTECH / HEALTHCARE - Long R&D cycles, high IP value, regulatory hurdles
  'Biotech': {
    traction_expectations: {
      // Revenue takes longer - pre-seed/seed may have NO revenue (normal)
      no_revenue_penalty: -10,  // Less penalty than default
      early_revenue_bonus: +15,  // Bigger bonus if they DO have revenue early
      customer_count_multiplier: 0.5,  // Fewer customers is normal
      growth_rate_multiplier: 0.7  // Slower growth is expected
    },
    team_expectations: {
      // PhDs, scientific backgrounds matter more
      technical_bonus: +10,  // Extra points for scientific/technical team
      education_multiplier: 1.3,  // Education matters more
      industry_experience_bonus: +15  // Experience in biotech/pharma
    },
    product_expectations: {
      // IP and regulatory approvals matter more than "launched"
      ip_bonus: +20,  // Patents/licenses are huge
      regulatory_bonus: +15,  // FDA approval, etc.
      launched_penalty: 0  // Not having a "launched" product is OK
    },
    market_expectations: {
      // Massive TAM but longer timeframes
      tam_bonus_multiplier: 1.2,
      competition_penalty: -5  // Less penalty for competition (crowded field)
    },
    adjustment_factor: 1.15  // Industry score boost (biotech scoring 40 = 46 industry score)
  },
  
  // AI/ML - Fast-moving, need to show traction quickly, high competition
  'AI': {
    traction_expectations: {
      no_revenue_penalty: -15,  // Should show SOME traction even early
      early_revenue_bonus: +10,
      customer_count_multiplier: 1.2,  // User growth matters more
      growth_rate_multiplier: 1.3  // Fast growth is expected
    },
    team_expectations: {
      technical_bonus: +15,  // Technical cofounder is CRITICAL
      education_multiplier: 1.2,
      industry_experience_bonus: +10  // Experience at OpenAI, Google AI, etc.
    },
    product_expectations: {
      ip_bonus: +5,  // Less important than execution
      launched_bonus: +10,  // Launch velocity matters
      demo_bonus: +8  // Demos are crucial for AI
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -10  // High competition = need to stand out
    },
    adjustment_factor: 0.95  // Industry score reduction (AI scoring 40 = 38 industry score - high bar)
  },
  
  'AI/ML': {
    traction_expectations: {
      no_revenue_penalty: -15,
      early_revenue_bonus: +10,
      customer_count_multiplier: 1.2,
      growth_rate_multiplier: 1.3
    },
    team_expectations: {
      technical_bonus: +15,
      education_multiplier: 1.2,
      industry_experience_bonus: +10
    },
    product_expectations: {
      ip_bonus: +5,
      launched_bonus: +10,
      demo_bonus: +8
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -10
    },
    adjustment_factor: 0.95
  },
  
  // FINTECH - Regulatory hurdles, need compliance, revenue can come faster than biotech
  'Fintech': {
    traction_expectations: {
      no_revenue_penalty: -12,  // Moderate penalty
      early_revenue_bonus: +12,
      customer_count_multiplier: 1.0,
      growth_rate_multiplier: 1.1
    },
    team_expectations: {
      technical_bonus: +8,
      compliance_experience_bonus: +12,  // Regulatory/compliance experience
      industry_experience_bonus: +10  // Banking, payments experience
    },
    product_expectations: {
      regulatory_bonus: +12,  // Licenses, compliance certifications
      security_bonus: +10,  // Security certifications matter
      launched_bonus: +5
    },
    market_expectations: {
      tam_bonus_multiplier: 1.15,
      competition_penalty: -8
    },
    adjustment_factor: 1.05  // Slight boost (fintech scoring 40 = 42 industry score)
  },
  
  'FinTech': {
    traction_expectations: {
      no_revenue_penalty: -12,
      early_revenue_bonus: +12,
      customer_count_multiplier: 1.0,
      growth_rate_multiplier: 1.1
    },
    team_expectations: {
      technical_bonus: +8,
      compliance_experience_bonus: +12,
      industry_experience_bonus: +10
    },
    product_expectations: {
      regulatory_bonus: +12,
      security_bonus: +10,
      launched_bonus: +5
    },
    market_expectations: {
      tam_bonus_multiplier: 1.15,
      competition_penalty: -8
    },
    adjustment_factor: 1.05
  },
  
  // ROBOTICS / HARDWARE - Long R&D, capital intensive, IP matters
  'Robotics': {
    traction_expectations: {
      no_revenue_penalty: -8,  // Very normal to have no revenue early
      early_revenue_bonus: +18,  // Huge bonus if they DO have revenue
      customer_count_multiplier: 0.4,  // Very few customers is normal
      growth_rate_multiplier: 0.6  // Slow growth expected
    },
    team_expectations: {
      technical_bonus: +18,  // Technical team is CRITICAL
      hardware_experience_bonus: +15,  // Robotics/hardware experience
      engineering_multiplier: 1.4  // Engineering credentials matter most
    },
    product_expectations: {
      ip_bonus: +25,  // Patents are HUGE
      prototype_bonus: +15,  // Working prototype matters more than "launch"
      launched_penalty: -3  // Less penalty for not launched
    },
    market_expectations: {
      tam_bonus_multiplier: 1.3,
      competition_penalty: -3  // Less competition in hardware
    },
    adjustment_factor: 1.20  // Significant boost (robotics scoring 40 = 48 industry score)
  },
  
  // HEALTHCARE (non-biotech) - Similar to biotech but faster path to revenue
  'Healthcare': {
    traction_expectations: {
      no_revenue_penalty: -10,
      early_revenue_bonus: +12,
      customer_count_multiplier: 0.7,
      growth_rate_multiplier: 0.9
    },
    team_expectations: {
      technical_bonus: +10,
      clinical_experience_bonus: +12,  // Clinical/medical experience
      education_multiplier: 1.2
    },
    product_expectations: {
      regulatory_bonus: +15,  // FDA, HIPAA compliance
      ip_bonus: +15,
      launched_bonus: +3
    },
    market_expectations: {
      tam_bonus_multiplier: 1.2,
      competition_penalty: -5
    },
    adjustment_factor: 1.12
  },
  
  // HealthTech - Digital health, telemedicine, health software (faster than biotech)
  'HealthTech': {
    traction_expectations: {
      no_revenue_penalty: -12,  // Moderate - can show revenue faster than biotech
      early_revenue_bonus: +10,
      customer_count_multiplier: 0.8,  // More customers than biotech
      growth_rate_multiplier: 1.0  // Standard growth expectations
    },
    team_expectations: {
      technical_bonus: +10,
      clinical_experience_bonus: +10,  // Clinical/medical experience
      education_multiplier: 1.1
    },
    product_expectations: {
      regulatory_bonus: +12,  // HIPAA compliance
      ip_bonus: +8,
      launched_bonus: +8  // Launch matters more than biotech
    },
    market_expectations: {
      tam_bonus_multiplier: 1.15,
      competition_penalty: -7
    },
    adjustment_factor: 1.08
  },
  
  // SaaS - Standard B2B software, fast iteration, predictable revenue
  'SaaS': {
    traction_expectations: {
      no_revenue_penalty: -15,  // Standard - SaaS should show revenue
      early_revenue_bonus: +8,
      customer_count_multiplier: 1.0,
      growth_rate_multiplier: 1.1  // Slight premium for growth
    },
    team_expectations: {
      technical_bonus: +10,
      education_multiplier: 1.0,
      industry_experience_bonus: +5  // B2B experience
    },
    product_expectations: {
      ip_bonus: +3,  // Less important
      launched_bonus: +10,  // Launch matters
      demo_bonus: +8  // Demos are key
    },
    market_expectations: {
      tam_bonus_multiplier: 1.0,
      competition_penalty: -8  // Competitive market
    },
    adjustment_factor: 1.0  // Baseline
  },
  
  // EdTech - Education technology, longer sales cycles, B2B/B2C mix
  'EdTech': {
    traction_expectations: {
      no_revenue_penalty: -13,  // Slightly lenient (B2B sales cycles)
      early_revenue_bonus: +9,
      customer_count_multiplier: 0.9,  // Schools/districts = fewer customers
      growth_rate_multiplier: 0.9  // Slower growth (seasonal)
    },
    team_expectations: {
      technical_bonus: +8,
      education_multiplier: 1.1,  // Education credentials matter
      industry_experience_bonus: +8  // Education industry experience
    },
    product_expectations: {
      ip_bonus: +5,
      launched_bonus: +8,
      demo_bonus: +7
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -6
    },
    adjustment_factor: 1.03
  },
  
  // Sustainability / Climate Tech - Long sales cycles, B2B enterprise, impact focus
  'Sustainability': {
    traction_expectations: {
      no_revenue_penalty: -11,  // Lenient - enterprise sales take time
      early_revenue_bonus: +11,
      customer_count_multiplier: 0.7,  // Enterprise = fewer customers
      growth_rate_multiplier: 0.9  // Slower growth
    },
    team_expectations: {
      technical_bonus: +10,
      education_multiplier: 1.1,
      industry_experience_bonus: +10  // Climate/energy industry experience
    },
    product_expectations: {
      ip_bonus: +10,  // Patents matter for clean tech
      regulatory_bonus: +8,  // Certifications matter
      launched_bonus: +6
    },
    market_expectations: {
      tam_bonus_multiplier: 1.2,  // Massive TAM
      competition_penalty: -5  // Less competitive
    },
    adjustment_factor: 1.10
  },
  
  // E-commerce - Consumer-focused, fast growth possible, high competition
  'E-commerce': {
    traction_expectations: {
      no_revenue_penalty: -14,  // Should show revenue quickly
      early_revenue_bonus: +9,
      customer_count_multiplier: 1.2,  // Customer count matters
      growth_rate_multiplier: 1.2  // Fast growth expected
    },
    team_expectations: {
      technical_bonus: +8,
      education_multiplier: 0.9,
      industry_experience_bonus: +8  // E-commerce/retail experience
    },
    product_expectations: {
      ip_bonus: +3,
      launched_bonus: +10,  // Launch critical
      demo_bonus: +5
    },
    market_expectations: {
      tam_bonus_multiplier: 1.0,
      competition_penalty: -10  // Very competitive
    },
    adjustment_factor: 0.98  // Slight penalty (competitive)
  },
  
  // Cybersecurity - High value, security-focused, enterprise sales
  'Cybersecurity': {
    traction_expectations: {
      no_revenue_penalty: -13,  // Enterprise sales cycles
      early_revenue_bonus: +11,
      customer_count_multiplier: 0.8,  // Enterprise = fewer customers
      growth_rate_multiplier: 1.0
    },
    team_expectations: {
      technical_bonus: +12,  // Security expertise critical
      education_multiplier: 1.1,
      industry_experience_bonus: +12  // Security industry experience
    },
    product_expectations: {
      ip_bonus: +8,  // Security patents matter
      security_bonus: +12,  // Security certifications critical
      launched_bonus: +8
    },
    market_expectations: {
      tam_bonus_multiplier: 1.15,
      competition_penalty: -8
    },
    adjustment_factor: 1.05
  },
  
  // PropTech - Real estate technology, slow-moving industry, enterprise
  'PropTech': {
    traction_expectations: {
      no_revenue_penalty: -12,  // Real estate is slow
      early_revenue_bonus: +10,
      customer_count_multiplier: 0.8,  // Fewer customers (buildings/portfolios)
      growth_rate_multiplier: 0.9  // Slow growth
    },
    team_expectations: {
      technical_bonus: +8,
      education_multiplier: 1.0,
      industry_experience_bonus: +10  // Real estate industry experience
    },
    product_expectations: {
      ip_bonus: +5,
      regulatory_bonus: +6,  // Some compliance matters
      launched_bonus: +7
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -6
    },
    adjustment_factor: 1.04
  },
  
  // FoodTech - Food technology, B2B/B2C mix, logistics complexity
  'FoodTech': {
    traction_expectations: {
      no_revenue_penalty: -12,
      early_revenue_bonus: +10,
      customer_count_multiplier: 0.9,
      growth_rate_multiplier: 1.0
    },
    team_expectations: {
      technical_bonus: +9,
      education_multiplier: 1.0,
      industry_experience_bonus: +9  // Food/restaurant industry experience
    },
    product_expectations: {
      ip_bonus: +6,  // Food tech patents matter
      regulatory_bonus: +8,  // FDA for food products
      launched_bonus: +8
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -7
    },
    adjustment_factor: 1.03
  },
  
  // Developer Tools - Technical audience, fast adoption possible, open source factor
  'Developer Tools': {
    traction_expectations: {
      no_revenue_penalty: -14,  // Devs adopt fast, should see usage
      early_revenue_bonus: +9,
      customer_count_multiplier: 1.1,  // Developer adoption matters
      growth_rate_multiplier: 1.2  // Fast growth in dev tools
    },
    team_expectations: {
      technical_bonus: +15,  // Technical cofounder CRITICAL
      education_multiplier: 1.1,
      industry_experience_bonus: +8  // Tech company experience
    },
    product_expectations: {
      ip_bonus: +5,
      launched_bonus: +10,
      demo_bonus: +10  // Dev tools need demos
    },
    market_expectations: {
      tam_bonus_multiplier: 1.05,
      competition_penalty: -9  // Competitive
    },
    adjustment_factor: 0.97  // Slight penalty (competitive, high bar)
  },
  
  // Marketing - Marketing tech, fast-moving, competitive
  'Marketing': {
    traction_expectations: {
      no_revenue_penalty: -14,
      early_revenue_bonus: +8,
      customer_count_multiplier: 1.1,
      growth_rate_multiplier: 1.1
    },
    team_expectations: {
      technical_bonus: +8,
      education_multiplier: 0.9,
      industry_experience_bonus: +7  // Marketing industry experience
    },
    product_expectations: {
      ip_bonus: +3,
      launched_bonus: +9,
      demo_bonus: +7
    },
    market_expectations: {
      tam_bonus_multiplier: 1.0,
      competition_penalty: -10  // Very competitive
    },
    adjustment_factor: 0.98
  },
  
  // HR/Talent - HR tech, enterprise sales, slower adoption
  'HR/Talent': {
    traction_expectations: {
      no_revenue_penalty: -13,  // Enterprise sales cycles
      early_revenue_bonus: +9,
      customer_count_multiplier: 0.9,  // Enterprise = fewer customers
      growth_rate_multiplier: 0.95  // Slower growth
    },
    team_expectations: {
      technical_bonus: +8,
      education_multiplier: 1.0,
      industry_experience_bonus: +9  // HR/talent industry experience
    },
    product_expectations: {
      ip_bonus: +5,
      regulatory_bonus: +7,  // Compliance matters (EEOC, etc.)
      launched_bonus: +8
    },
    market_expectations: {
      tam_bonus_multiplier: 1.1,
      competition_penalty: -7
    },
    adjustment_factor: 1.02
  },
  
  // Logistics - Supply chain, B2B enterprise, complex sales
  'Logistics': {
    traction_expectations: {
      no_revenue_penalty: -12,  // Enterprise sales cycles
      early_revenue_bonus: +10,
      customer_count_multiplier: 0.8,  // Enterprise = fewer customers
      growth_rate_multiplier: 0.95  // Slower growth
    },
    team_expectations: {
      technical_bonus: +9,
      education_multiplier: 1.0,
      industry_experience_bonus: +10  // Logistics/supply chain experience
    },
    product_expectations: {
      ip_bonus: +6,
      launched_bonus: +8,
      demo_bonus: +6
    },
    market_expectations: {
      tam_bonus_multiplier: 1.15,  // Huge TAM
      competition_penalty: -6
    },
    adjustment_factor: 1.06
  },
  
  // Consumer - Consumer apps, viral growth possible, high competition
  'Consumer': {
    traction_expectations: {
      no_revenue_penalty: -14,  // Should show traction
      early_revenue_bonus: +8,
      customer_count_multiplier: 1.3,  // User count critical
      growth_rate_multiplier: 1.3  // Viral growth expected
    },
    team_expectations: {
      technical_bonus: +9,
      education_multiplier: 0.9,
      industry_experience_bonus: +6  // Consumer app experience
    },
    product_expectations: {
      ip_bonus: +3,
      launched_bonus: +10,  // Launch critical
      demo_bonus: +5
    },
    market_expectations: {
      tam_bonus_multiplier: 1.0,
      competition_penalty: -11  // Very competitive
    },
    adjustment_factor: 0.96  // Penalty (very competitive)
  },
  
  // Gaming - Consumer gaming, viral growth, high competition
  'Gaming': {
    traction_expectations: {
      no_revenue_penalty: -13,  // Can monetize through ads/freemium
      early_revenue_bonus: +9,
      customer_count_multiplier: 1.4,  // User count critical (DAU/MAU)
      growth_rate_multiplier: 1.4  // Viral growth expected
    },
    team_expectations: {
      technical_bonus: +10,
      education_multiplier: 0.9,
      industry_experience_bonus: +8  // Gaming industry experience
    },
    product_expectations: {
      ip_bonus: +5,
      launched_bonus: +10,
      demo_bonus: +8  // Game demos matter
    },
    market_expectations: {
      tam_bonus_multiplier: 1.05,
      competition_penalty: -10  // Very competitive
    },
    adjustment_factor: 0.97
  },
  
  // DEFAULT - Standard SaaS expectations
  'default': {
    traction_expectations: {
      no_revenue_penalty: -15,
      early_revenue_bonus: +8,
      customer_count_multiplier: 1.0,
      growth_rate_multiplier: 1.0
    },
    team_expectations: {
      technical_bonus: +10,
      education_multiplier: 1.0,
      industry_experience_bonus: +5
    },
    product_expectations: {
      ip_bonus: +5,
      launched_bonus: +8,
      demo_bonus: +5
    },
    market_expectations: {
      tam_bonus_multiplier: 1.0,
      competition_penalty: -8
    },
    adjustment_factor: 1.0  // No adjustment
  }
};

/**
 * Get primary industry from startup's sectors
 * Maps various sector names to standardized industry names
 */
function getPrimaryIndustry(startup) {
  const sectors = startup.sectors || [];
  if (!sectors || sectors.length === 0) {
    return 'default';
  }
  
  // Normalize sector names (lowercase, trim)
  const normalizedSectors = sectors.map(s => (s || '').toLowerCase().trim());
  
  // Industry mapping - more specific first (higher priority)
  // Format: [normalized_sector_name, standardized_industry_name]
  const industryMappings = [
    // Healthcare/Bio (check first - most specific)
    ['biotech', 'Biotech'],
    ['biotechnology', 'Biotech'],
    ['healthtech', 'HealthTech'],
    ['health tech', 'HealthTech'],
    ['healthcare', 'HealthTech'],
    ['health care', 'HealthTech'],
    ['medical', 'HealthTech'],
    
    // Hardware/Robotics
    ['robotics', 'Robotics'],
    ['robotic', 'Robotics'],
    ['hardware', 'Robotics'],
    
    // AI/ML
    ['ai/ml', 'AI/ML'],
    ['artificial intelligence', 'AI/ML'],
    ['machine learning', 'AI/ML'],
    ['deep learning', 'AI/ML'],
    ['ai', 'AI/ML'],
    ['ml', 'AI/ML'],
    
    // FinTech
    ['fintech', 'FinTech'],
    ['fin tech', 'FinTech'],
    ['financial technology', 'FinTech'],
    ['banking', 'FinTech'],
    ['payments', 'FinTech'],
    ['crypto', 'FinTech'],
    ['defi', 'FinTech'],
    ['web3', 'FinTech'],
    ['blockchain', 'FinTech'],
    
    // Cybersecurity
    ['cybersecurity', 'Cybersecurity'],
    ['cyber security', 'Cybersecurity'],
    ['security', 'Cybersecurity'],
    
    // Sustainability/Climate
    ['sustainability', 'Sustainability'],
    ['climate tech', 'Sustainability'],
    ['climate', 'Sustainability'],
    ['cleantech', 'Sustainability'],
    ['clean tech', 'Sustainability'],
    ['renewable', 'Sustainability'],
    
    // SaaS
    ['saas', 'SaaS'],
    ['b2b saas', 'SaaS'],
    ['software as a service', 'SaaS'],
    ['enterprise', 'SaaS'],
    
    // Developer Tools
    ['developer tools', 'Developer Tools'],
    ['devtools', 'Developer Tools'],
    ['dev tools', 'Developer Tools'],
    ['infrastructure', 'Developer Tools'],
    ['devops', 'Developer Tools'],
    
    // EdTech
    ['edtech', 'EdTech'],
    ['ed tech', 'EdTech'],
    ['education', 'EdTech'],
    
    // E-commerce
    ['e-commerce', 'E-commerce'],
    ['ecommerce', 'E-commerce'],
    ['retail', 'E-commerce'],
    ['marketplace', 'E-commerce'],
    
    // PropTech
    ['proptech', 'PropTech'],
    ['prop tech', 'PropTech'],
    ['real estate', 'PropTech'],
    ['property', 'PropTech'],
    
    // FoodTech
    ['foodtech', 'FoodTech'],
    ['food tech', 'FoodTech'],
    ['food', 'FoodTech'],
    ['agriculture', 'FoodTech'],
    ['agtech', 'FoodTech'],
    
    // Marketing
    ['marketing', 'Marketing'],
    ['advertising', 'Marketing'],
    
    // HR/Talent
    ['hr/talent', 'HR/Talent'],
    ['hr', 'HR/Talent'],
    ['talent', 'HR/Talent'],
    ['recruiting', 'HR/Talent'],
    
    // Logistics
    ['logistics', 'Logistics'],
    ['supply chain', 'Logistics'],
    ['shipping', 'Logistics'],
    
    // Consumer
    ['consumer', 'Consumer'],
    ['gaming', 'Gaming'],
    ['entertainment', 'Consumer'],
    ['social', 'Consumer'],
  ];
  
  // Check each sector against mappings (order matters - more specific first)
  for (const sector of normalizedSectors) {
    for (const [pattern, industry] of industryMappings) {
      if (sector.includes(pattern) || pattern.includes(sector)) {
        return industry;
      }
    }
  }
  
  // If no match found, check if it's in our INDUSTRY_BENCHMARKS
  for (const sector of normalizedSectors) {
    for (const industryName of Object.keys(INDUSTRY_BENCHMARKS)) {
      if (industryName.toLowerCase() === sector || sector.includes(industryName.toLowerCase())) {
        return industryName;
      }
    }
  }
  
  return 'default';
}

// =============================================================================
// TRACTION SCORE (0-100) - Weight: 35%
// This is the most important - hard numbers don't lie
// =============================================================================
function calculateTractionScore(startup) {
  const stage = startup.stage || 1;
  let score = 0;
  let signals = 0;
  
  // ARR (Annual Recurring Revenue) - THE key metric
  const arr = startup.arr || startup.arr_usd || 0;
  if (arr >= 10000000) { score += 40; signals++; }      // $10M+ ARR = exceptional
  else if (arr >= 5000000) { score += 35; signals++; }  // $5M+ ARR
  else if (arr >= 1000000) { score += 30; signals++; }  // $1M+ ARR = strong
  else if (arr >= 500000) { score += 25; signals++; }   // $500K ARR
  else if (arr >= 100000) { score += 18; signals++; }   // $100K ARR = traction
  else if (arr >= 50000) { score += 12; signals++; }    // $50K ARR = early traction
  else if (arr >= 10000) { score += 6; signals++; }     // $10K ARR = some revenue
  else if (arr > 0) { score += 3; signals++; }          // Any revenue
  
  // MRR as fallback if no ARR
  if (!arr && startup.mrr) {
    const mrr = startup.mrr;
    if (mrr >= 100000) { score += 25; signals++; }
    else if (mrr >= 50000) { score += 20; signals++; }
    else if (mrr >= 20000) { score += 15; signals++; }
    else if (mrr >= 10000) { score += 10; signals++; }
    else if (mrr >= 5000) { score += 6; signals++; }
    else if (mrr > 0) { score += 3; signals++; }
  }
  
  // Check extracted_data for funding amount (early-stage signal)
  if (!arr && !startup.mrr && startup.extracted_data) {
    const ext = startup.extracted_data;
    const fundingAmount = ext.funding_amount || ext.funding || 0;
    // If they raised funding, that's a positive signal even without revenue
    if (typeof fundingAmount === 'string') {
      const match = fundingAmount.match(/\$?([\d.]+)\s*(m|M|k|K|b|B)/i);
      if (match) {
        let amount = parseFloat(match[1]);
        if (match[2].toLowerCase() === 'm') amount *= 1000000;
        else if (match[2].toLowerCase() === 'k') amount *= 1000;
        else if (match[2].toLowerCase() === 'b') amount *= 1000000000;
        
        if (amount >= 1000000) { score += 8; signals++; }  // $1M+ raised
        else if (amount >= 500000) { score += 5; signals++; }  // $500K+ raised
        else if (amount >= 100000) { score += 3; signals++; }  // $100K+ raised
      }
    } else if (typeof fundingAmount === 'number' && fundingAmount > 0) {
      if (fundingAmount >= 1000000) { score += 8; signals++; }
      else if (fundingAmount >= 500000) { score += 5; signals++; }
      else if (fundingAmount >= 100000) { score += 3; signals++; }
    }
  }
  
  // Growth Rate (monthly)
  const growth = startup.growth_rate_monthly || 0;
  if (growth >= 30) { score += 20; signals++; }       // 30%+ MoM = exceptional
  else if (growth >= 20) { score += 16; signals++; }  // 20%+ MoM = great
  else if (growth >= 15) { score += 12; signals++; }  // 15%+ MoM = good
  else if (growth >= 10) { score += 8; signals++; }   // 10%+ MoM = decent
  else if (growth >= 5) { score += 4; signals++; }    // 5%+ MoM = okay
  else if (growth > 0) { score += 2; signals++; }
  
  // Customer Count
  const customers = startup.customer_count || startup.parsed_customers || startup.parsed_users || 0;
  if (customers >= 1000) { score += 15; signals++; }
  else if (customers >= 500) { score += 12; signals++; }
  else if (customers >= 100) { score += 9; signals++; }
  else if (customers >= 50) { score += 6; signals++; }
  else if (customers >= 10) { score += 3; signals++; }
  else if (customers > 0) { score += 1; signals++; }
  
  // LTV/CAC Ratio (unit economics)
  const ltvCac = parseFloat(startup.ltv_cac_ratio) || 0;
  if (ltvCac >= 5) { score += 10; signals++; }        // 5:1+ = excellent
  else if (ltvCac >= 3) { score += 7; signals++; }    // 3:1+ = good
  else if (ltvCac >= 2) { score += 4; signals++; }    // 2:1+ = okay
  else if (ltvCac >= 1) { score += 1; signals++; }    // Break even
  
  // NRR (Net Revenue Retention)
  const nrr = startup.nrr || 0;
  if (nrr >= 150) { score += 8; signals++; }          // 150%+ = exceptional expansion
  else if (nrr >= 120) { score += 6; signals++; }     // 120%+ = great
  else if (nrr >= 100) { score += 3; signals++; }     // 100%+ = no churn
  
  // Engagement (DAU/WAU ratio)
  const dauWau = parseFloat(startup.dau_wau_ratio) || 0;
  if (dauWau >= 0.6) { score += 7; signals++; }       // 60%+ = daily habit
  else if (dauWau >= 0.4) { score += 5; signals++; }  // 40%+ = good engagement
  else if (dauWau >= 0.2) { score += 2; signals++; }
  
  // For early-stage (pre-seed/seed), give base score even without revenue
  // Revenue is NOT expected at these stages
  if (signals === 0) {
    if (stage <= 2) {
      // Pre-seed/Seed: Give base score based on other signals
      score = 25; // Increased from 15 - more generous for early-stage
      
      // Bonus for having product launched
      const ext = startup.extracted_data || {};
      if (startup.is_launched || ext.has_demo || ext.launched || ext.product !== undefined) {
        score += 8; // Increased from 5
      }
      
      // Bonus for having users/engagement signals
      if (startup.customer_count > 0) {
        score += Math.min(12, startup.customer_count / 10); // Up to +12 for users (was 10)
      }
      
      // Bonus if they have funding (from extracted_data)
      if (ext.funding || ext.funding_amount) {
        score += 5; // Having raised funding is a positive signal
      }
      
      return Math.min(40, score); // Increased cap from 30 to 40 for pre-revenue early-stage
    } else {
      // Series A+: Revenue IS expected
      return 8; // Slightly more generous than 5
    }
  }
  
  return Math.min(100, score);
}

// =============================================================================
// TEAM SCORE (0-100) - Weight: 25%
// =============================================================================
function calculateTeamScore(startup) {
  let score = 25; // Base score (increased from 20 to be more generous)
  const stage = startup.stage || 1;
  
  // Technical cofounder - CRITICAL for tech startups
  // Check extracted_data as fallback
  let hasTechnicalCofounder = startup.has_technical_cofounder;
  if (hasTechnicalCofounder === undefined && startup.extracted_data) {
    // Infer from founders data if available
    const founders = startup.extracted_data.founders || startup.extracted_data.team || [];
    if (Array.isArray(founders)) {
      const hasTech = founders.some(f => {
        const role = (f.role || f.title || '').toLowerCase();
        return role.includes('cto') || role.includes('engineer') || role.includes('technical') || 
               role.includes('developer') || role.includes('tech');
      });
      hasTechnicalCofounder = hasTech;
    }
  }
  
  if (hasTechnicalCofounder === true) {
    score += 25;
  } else if (hasTechnicalCofounder === false) {
    score -= 8; // Reduced penalty from -10 to -8
  }
  // If unknown, don't penalize (stay at base)
  
  // Team size - right size for stage
  const teamSize = startup.team_size || startup.team_size_estimate || 0;
  
  if (stage <= 2) { // Pre-seed/Seed
    if (teamSize >= 2 && teamSize <= 10) score += 15;
    else if (teamSize >= 11 && teamSize <= 20) score += 10;
    else if (teamSize === 1) score += 5; // Solo founder
    else if (teamSize > 20) score -= 5; // Too big for stage
  } else { // Series A+
    if (teamSize >= 10 && teamSize <= 50) score += 15;
    else if (teamSize >= 5 && teamSize < 10) score += 10;
    else if (teamSize > 50) score += 12;
  }
  
  // Founder age signals
  const avgAge = startup.founder_avg_age || 0;
  if (avgAge >= 25 && avgAge <= 45) {
    score += 10; // Prime founder age range
  } else if (avgAge >= 20 && avgAge < 25) {
    score += 8; // Young but capable
  } else if (avgAge > 45 && avgAge <= 55) {
    score += 8; // Experienced
  }
  
  // First time founders penalty (slight - they can still succeed)
  if (startup.first_time_founders === true) {
    score -= 5;
  } else if (startup.first_time_founders === false) {
    score += 10; // Repeat founders bonus
  }
  
  // Education signals (from founder_education array)
  const education = startup.founder_education || [];
  const topSchools = ['Stanford', 'MIT', 'Harvard', 'Berkeley', 'CMU', 'Caltech', 'Princeton', 'Yale'];
  const hasTopSchool = education.some(e => 
    topSchools.some(school => (e || '').toLowerCase().includes(school.toLowerCase()))
  );
  if (hasTopSchool) score += 10;
  
  // Advisors and strategic partners
  const advisors = startup.advisors || [];
  const partners = startup.strategic_partners || [];
  if (Array.isArray(advisors) && advisors.length >= 3) score += 8;
  else if (Array.isArray(advisors) && advisors.length >= 1) score += 4;
  if (Array.isArray(partners) && partners.length >= 2) score += 7;
  else if (Array.isArray(partners) && partners.length >= 1) score += 3;
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// MARKET SCORE (0-100) - Weight: 20%
// =============================================================================
function calculateMarketScore(startup) {
  let score = 20; // Base score
  
  // TAM (Total Addressable Market)
  const tam = (startup.tam_estimate || '').toLowerCase();
  if (tam.includes('trillion') || tam.includes('1t') || tam.includes('$1,000b')) {
    score += 30; // Massive market
  } else if (tam.includes('billion') || tam.includes('100b') || tam.includes('$100b')) {
    score += 25;
  } else if (tam.includes('50b') || tam.includes('$50b')) {
    score += 20;
  } else if (tam.includes('10b') || tam.includes('$10b')) {
    score += 15;
  } else if (tam.includes('1b') || tam.includes('$1b')) {
    score += 10;
  } else if (tam.includes('million') || tam.includes('100m')) {
    score += 5; // Small market
  }
  
  // Sector heat multiplier
  const sectors = startup.sectors || [];
  let maxDemand = 50;
  let difficulty = 1.0;
  
  for (const sector of sectors) {
    const data = SECTOR_MULTIPLIERS[sector] || SECTOR_MULTIPLIERS['default'];
    if (data.demand > maxDemand) {
      maxDemand = data.demand;
      difficulty = data.difficulty;
    }
  }
  
  // Add sector demand bonus (0-20 points based on investor demand)
  score += Math.round(maxDemand / 5); // 0-20 points
  
  // Location bonus (certain hubs)
  const location = (startup.location || '').toLowerCase();
  const hotLocations = ['san francisco', 'sf', 'bay area', 'nyc', 'new york', 'austin', 'boston', 'seattle', 'los angeles', 'la'];
  const goodLocations = ['london', 'berlin', 'tel aviv', 'singapore', 'toronto', 'denver', 'miami', 'chicago'];
  
  if (hotLocations.some(loc => location.includes(loc))) {
    score += 10;
  } else if (goodLocations.some(loc => location.includes(loc))) {
    score += 5;
  }
  
  // Why Now signal
  if (startup.why_now && startup.why_now.length > 50) {
    score += 8; // Has articulated market timing
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// PRODUCT SCORE (0-100) - Weight: 15%
// =============================================================================
function calculateProductScore(startup) {
  let score = 20; // Base score (increased from 15)
  
  // Check extracted_data for product signals
  const ext = startup.extracted_data || {};
  
  // Is launched?
  const isLaunched = startup.is_launched || ext.has_demo || ext.launched || ext.product !== undefined;
  if (isLaunched === true) {
    score += 20;
  } else if (isLaunched === false) {
    score -= 5; // Not launched = penalty
  }
  // If unknown, don't penalize (stay at base)
  
  // Has demo?
  const hasDemo = startup.has_demo || ext.has_demo || ext.demo !== undefined;
  if (hasDemo === true) {
    score += 10;
  }
  
  // Speed to MVP
  const daysToMvp = startup.days_from_idea_to_mvp || 0;
  if (daysToMvp > 0 && daysToMvp <= 30) {
    score += 15; // Built MVP in a month = impressive
  } else if (daysToMvp > 30 && daysToMvp <= 90) {
    score += 10;
  } else if (daysToMvp > 90 && daysToMvp <= 180) {
    score += 5;
  }
  
  // Deployment frequency (shipping velocity)
  const deployFreq = (startup.deployment_frequency || '').toLowerCase();
  if (deployFreq.includes('daily') || deployFreq.includes('continuous')) {
    score += 15;
  } else if (deployFreq.includes('weekly')) {
    score += 10;
  } else if (deployFreq.includes('bi-weekly') || deployFreq.includes('biweekly')) {
    score += 7;
  } else if (deployFreq.includes('monthly')) {
    score += 4;
  }
  
  // Features shipped
  const featuresShipped = startup.features_shipped_last_month || 0;
  if (featuresShipped >= 10) score += 10;
  else if (featuresShipped >= 5) score += 7;
  else if (featuresShipped >= 2) score += 4;
  else if (featuresShipped >= 1) score += 2;
  
  // NPS Score
  const nps = startup.nps_score || 0;
  if (nps >= 70) score += 12; // World class
  else if (nps >= 50) score += 9;
  else if (nps >= 30) score += 6;
  else if (nps >= 0) score += 3;
  
  // Users who would be "very disappointed"
  const disappointed = startup.users_who_would_be_very_disappointed || 0;
  if (disappointed >= 40) score += 10; // PMF signal
  else if (disappointed >= 25) score += 6;
  else if (disappointed >= 10) score += 3;
  
  // Ensure minimum score if product exists (has demo or launched)
  if ((isLaunched || hasDemo) && score < 30) {
    score = 30; // Minimum score if they have a working product
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// VISION SCORE (0-100) - Weight: 5%
// Qualitative signals - lowest weight because subjective
// =============================================================================
function calculateVisionScore(startup) {
  let score = 25; // Base score (increased from 20)
  
  // Smell tests (YC style)
  if (startup.smell_test_lean === true) score += 10;
  if (startup.smell_test_user_passion === true) score += 15;
  if (startup.smell_test_learning_public === true) score += 8;
  if (startup.smell_test_inevitable === true) score += 12;
  if (startup.smell_test_massive_if_works === true) score += 15;
  
  // Or use pre-calculated smell test score
  const smellScore = startup.smell_test_score || 0;
  if (smellScore > 0) {
    score = Math.max(score, smellScore);
  }
  
  // Contrarian belief (shows independent thinking)
  if (startup.contrarian_belief && startup.contrarian_belief.length > 30) {
    score += 10;
  }
  
  // Unfair advantage
  if (startup.unfair_advantage && startup.unfair_advantage.length > 30) {
    score += 10;
  }
  
  // Organic referral rate (word of mouth)
  const referral = startup.organic_referral_rate || 0;
  if (referral >= 50) score += 10;
  else if (referral >= 30) score += 7;
  else if (referral >= 15) score += 4;
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// HELPER: Get stage number from startup data
// =============================================================================
function getStageNumber(startup) {
  const stage = (startup.stage || '').toString().toLowerCase();
  
  if (stage.includes('pre-seed') || stage === '1' || stage === 'pre_seed') return 1;
  if (stage.includes('seed') || stage === '2') return 2;
  if (stage.includes('series a') || stage === '3' || stage === 'series_a') return 3;
  if (stage.includes('series b') || stage.includes('series c') || stage.includes('series d') || 
      stage.includes('growth') || stage.includes('late') || stage === '4') return 4;
  
  // Default to stage 2 (Seed) if unclear
  return 2;
}

// =============================================================================
// PRODUCT VELOCITY SCORE (0-100)
// Speed to MVP, deployment frequency, features shipped
// =============================================================================
function calculateProductVelocityScore(startup) {
  let score = 20; // Base score
  
  // Speed to MVP
  const daysToMvp = startup.days_from_idea_to_mvp || 0;
  if (daysToMvp > 0 && daysToMvp <= 30) {
    score += 30; // Built MVP in a month = impressive
  } else if (daysToMvp > 30 && daysToMvp <= 90) {
    score += 25;
  } else if (daysToMvp > 90 && daysToMvp <= 180) {
    score += 15;
  } else if (daysToMvp > 180 && daysToMvp <= 365) {
    score += 8;
  }
  
  // Deployment frequency (shipping velocity)
  const deployFreq = (startup.deployment_frequency || '').toLowerCase();
  if (deployFreq.includes('daily') || deployFreq.includes('continuous')) {
    score += 30;
  } else if (deployFreq.includes('weekly')) {
    score += 20;
  } else if (deployFreq.includes('bi-weekly') || deployFreq.includes('biweekly')) {
    score += 15;
  } else if (deployFreq.includes('monthly')) {
    score += 8;
  }
  
  // Features shipped
  const featuresShipped = startup.features_shipped_last_month || 0;
  if (featuresShipped >= 10) score += 20;
  else if (featuresShipped >= 5) score += 15;
  else if (featuresShipped >= 2) score += 10;
  else if (featuresShipped >= 1) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// MARKET TIMING SCORE (0-100)
// Why Now, sector heat, location
// =============================================================================
function calculateMarketTimingScore(startup) {
  let score = 20; // Base score
  
  // Why Now signal
  if (startup.why_now && startup.why_now.length > 50) {
    score += 30; // Has articulated market timing
  } else if (startup.why_now && startup.why_now.length > 20) {
    score += 15;
  }
  
  // Sector heat multiplier
  const sectors = startup.sectors || [];
  let maxDemand = 50;
  
  for (const sector of sectors) {
    const data = SECTOR_MULTIPLIERS[sector] || SECTOR_MULTIPLIERS['default'];
    if (data.demand > maxDemand) {
      maxDemand = data.demand;
    }
  }
  
  // Add sector demand bonus (0-30 points based on investor demand)
  score += Math.round(maxDemand * 0.3); // 0-30 points
  
  // Location bonus (certain hubs)
  const location = (startup.location || '').toLowerCase();
  const hotLocations = ['san francisco', 'sf', 'bay area', 'nyc', 'new york', 'austin', 'boston', 'seattle', 'los angeles', 'la'];
  const goodLocations = ['london', 'berlin', 'tel aviv', 'singapore', 'toronto', 'denver', 'miami', 'chicago'];
  
  if (hotLocations.some(loc => location.includes(loc))) {
    score += 20;
  } else if (goodLocations.some(loc => location.includes(loc))) {
    score += 10;
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// CUSTOMER VALIDATION SCORE (0-100)
// Early user signals, NPS, engagement
// =============================================================================
function calculateCustomerValidationScore(startup) {
  let score = 15; // Base score
  
  // Is launched?
  if (startup.is_launched === true) {
    score += 25;
  } else {
    score -= 10; // Not launched = penalty
  }
  
  // Has demo?
  if (startup.has_demo === true) {
    score += 15;
  }
  
  // Customer Count (early validation)
  const customers = startup.customer_count || startup.parsed_customers || startup.parsed_users || 0;
  if (customers >= 100) { score += 20; }
  else if (customers >= 50) { score += 15; }
  else if (customers >= 10) { score += 10; }
  else if (customers > 0) { score += 5; }
  
  // NPS Score
  const nps = startup.nps_score || 0;
  if (nps >= 70) score += 20; // World class
  else if (nps >= 50) score += 15;
  else if (nps >= 30) score += 10;
  else if (nps >= 0) score += 5;
  
  // Users who would be "very disappointed" (PMF signal)
  const disappointed = startup.users_who_would_be_very_disappointed || 0;
  if (disappointed >= 40) score += 20; // Strong PMF signal
  else if (disappointed >= 25) score += 12;
  else if (disappointed >= 10) score += 6;
  
  // Engagement (DAU/WAU ratio)
  const dauWau = parseFloat(startup.dau_wau_ratio) || 0;
  if (dauWau >= 0.6) score += 15; // Daily habit
  else if (dauWau >= 0.4) score += 10;
  else if (dauWau >= 0.2) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// SOCIAL BUZZ SCORE (0-100) - Weight: 7-10% (stage-dependent)
// Community validation and social proof
// =============================================================================
async function calculateSocialBuzzScore(startupName) {
  try {
    // Query social signals from database
    const { data: signals, error } = await supabase
      .from('social_signals')
      .select('sentiment, engagement_score, platform')
      .eq('startup_name', startupName);
    
    if (error || !signals || signals.length === 0) {
      return 0; // No social data = 0 points
    }
    
    let score = 0;
    
    // Base score for mentions
    const mentionCount = signals.length;
    if (mentionCount >= 500) score += 30;
    else if (mentionCount >= 200) score += 25;
    else if (mentionCount >= 100) score += 20;
    else if (mentionCount >= 50) score += 15;
    else if (mentionCount >= 20) score += 10;
    else if (mentionCount >= 10) score += 5;
    else score += 2;
    
    // Sentiment analysis
    const praiseCount = signals.filter(s => s.sentiment === 'praise').length;
    const concernCount = signals.filter(s => s.sentiment === 'concern').length;
    const interestCount = signals.filter(s => s.sentiment === 'interest').length;
    const helpCount = signals.filter(s => s.sentiment === 'help').length;
    
    // Praise signals (users love it)
    const praisePct = mentionCount > 0 ? (praiseCount / mentionCount) * 100 : 0;
    if (praisePct >= 20) score += 25; // Exceptional positive sentiment
    else if (praisePct >= 10) score += 20;
    else if (praisePct >= 5) score += 15;
    else if (praisePct >= 2) score += 10;
    
    // Concern penalty (red flags)
    const concernPct = mentionCount > 0 ? (concernCount / mentionCount) * 100 : 0;
    if (concernPct >= 10) score -= 20; // Major red flag
    else if (concernPct >= 5) score -= 10;
    else if (concernPct >= 2) score -= 5;
    
    // Interest signals (people researching)
    if (interestCount >= 10) score += 10;
    else if (interestCount >= 5) score += 5;
    
    // Help signals (founder is respected)
    if (helpCount >= 5) score += 8;
    else if (helpCount >= 2) score += 4;
    
    // Engagement score (viral content)
    const totalEngagement = signals.reduce((sum, s) => sum + (s.engagement_score || 0), 0);
    const avgEngagement = mentionCount > 0 ? totalEngagement / mentionCount : 0;
    if (avgEngagement >= 100) score += 15;
    else if (avgEngagement >= 50) score += 10;
    else if (avgEngagement >= 20) score += 5;
    
    // Platform diversity (shows broad awareness)
    const platforms = new Set(signals.map(s => s.platform));
    if (platforms.size >= 3) score += 5; // On Reddit, HN, and Twitter
    else if (platforms.size >= 2) score += 3;
    
    return Math.min(100, Math.max(0, score));
    
  } catch (error) {
    console.error(`Social buzz error for ${startupName}:`, error.message);
    return 0;
  }
}

// =============================================================================
// CALCULATE TOTAL GOD SCORE (STAGE-ADJUSTED + SOCIAL SIGNALS)
// =============================================================================
async function calculateGodScore(startup) {
  const stage = getStageNumber(startup);
  const weights = STAGE_WEIGHTS[stage] || STAGE_WEIGHTS[2]; // Default to Seed if invalid stage
  
  // Calculate all scores
  const traction = calculateTractionScore(startup);
  const team = calculateTeamScore(startup);
  const market = calculateMarketScore(startup);
  const product = calculateProductScore(startup);
  const vision = calculateVisionScore(startup);
  const productVelocity = calculateProductVelocityScore(startup);
  const marketTiming = calculateMarketTimingScore(startup);
  const customerValidation = calculateCustomerValidationScore(startup);
  const social = await calculateSocialBuzzScore(startup.name); // ✅ NEW!
  
  // Calculate weighted average based on stage
  let total = 0;
  
  if (stage === 1) {
    // Pre-seed: team, product_velocity, market_timing, customer_validation, social, vision
    total = Math.round(
      (team * weights.team / 100) +
      (productVelocity * weights.product_velocity / 100) +
      (marketTiming * weights.market_timing / 100) +
      (customerValidation * weights.customer_validation / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  } else if (stage === 2) {
    // Seed: team, traction, product_velocity, market_timing, customer_validation, social, vision
    total = Math.round(
      (team * weights.team / 100) +
      (traction * weights.traction / 100) +
      (productVelocity * weights.product_velocity / 100) +
      (marketTiming * weights.market_timing / 100) +
      (customerValidation * weights.customer_validation / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  } else if (stage === 3 || stage === 4) {
    // Series A+: traction, team, market, product, social, vision
    total = Math.round(
      (traction * weights.traction / 100) +
      (team * weights.team / 100) +
      (market * weights.market / 100) +
      (product * weights.product / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  }
  
  // Calculate industry-adjusted GOD score
  const primaryIndustry = getPrimaryIndustry(startup);
  const industryBenchmarks = INDUSTRY_BENCHMARKS[primaryIndustry] || INDUSTRY_BENCHMARKS['default'];
  
  // Apply industry-specific adjustments to component scores
  let industryTraction = traction;
  let industryTeam = team;
  let industryProduct = product;
  let industryMarket = market;
  
  // Check if startup has no revenue for traction adjustment
  const hasNoRevenue = (startup.arr || 0) === 0 && !startup.mrr && (!startup.customer_count || startup.customer_count === 0);
  
  // Adjust traction based on industry expectations
  const tractionExp = industryBenchmarks.traction_expectations;
  if (hasNoRevenue && stage <= 2) {
    // Early-stage with no revenue - adjust penalty based on industry
    // Default penalty is -15, so adjust from that baseline
    const adjustment = tractionExp.no_revenue_penalty - (-15);
    industryTraction = Math.max(0, Math.min(100, traction + adjustment));
  }
  
  // Adjust team score based on industry
  const teamExp = industryBenchmarks.team_expectations;
  // Re-check technical cofounder (same logic as team score)
  let hasTechCofounder = startup.has_technical_cofounder;
  if (hasTechCofounder === undefined && startup.extracted_data) {
    const founders = startup.extracted_data.founders || startup.extracted_data.team || [];
    if (Array.isArray(founders)) {
      const hasTech = founders.some(f => {
        const role = (f.role || f.title || '').toLowerCase();
        return role.includes('cto') || role.includes('engineer') || role.includes('technical') || 
               role.includes('developer') || role.includes('tech');
      });
      hasTechCofounder = hasTech;
    }
  }
  
  if (hasTechCofounder === true) {
    industryTeam = Math.min(100, team + teamExp.technical_bonus);
  }
  
  // Adjust product score based on industry
  const productExp = industryBenchmarks.product_expectations;
  const ext = startup.extracted_data || {};
  // Check for IP (patents, licenses)
  if (ext.patents || ext.licenses || ext.ip || startup.patents) {
    industryProduct = Math.min(100, product + productExp.ip_bonus);
  }
  // Check for regulatory approvals
  if (ext.regulatory_approval || ext.fda_approval || ext.licenses || startup.regulatory_approval) {
    industryProduct = Math.min(100, industryProduct + productExp.regulatory_bonus);
  }
  
  // Recalculate total with industry-adjusted components
  let industryTotal = 0;
  if (stage === 1) {
    industryTotal = Math.round(
      (industryTeam * weights.team / 100) +
      (productVelocity * weights.product_velocity / 100) +
      (marketTiming * weights.market_timing / 100) +
      (customerValidation * weights.customer_validation / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  } else if (stage === 2) {
    industryTotal = Math.round(
      (industryTeam * weights.team / 100) +
      (industryTraction * weights.traction / 100) +
      (productVelocity * weights.product_velocity / 100) +
      (marketTiming * weights.market_timing / 100) +
      (customerValidation * weights.customer_validation / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  } else if (stage === 3 || stage === 4) {
    industryTotal = Math.round(
      (industryTraction * weights.traction / 100) +
      (industryTeam * weights.team / 100) +
      (industryMarket * weights.market / 100) +
      (industryProduct * weights.product / 100) +
      (social * weights.social / 100) +
      (vision * weights.vision / 100)
    );
  }
  
  // Apply final industry adjustment factor
  industryTotal = Math.round(industryTotal * industryBenchmarks.adjustment_factor);
  
  // Return scores - always include all components for database compatibility
  return {
    total: Math.min(100, Math.max(0, total)),  // Overall GOD score
    industry_total: Math.min(100, Math.max(0, industryTotal)),  // ✅ Industry-adjusted GOD score
    primary_industry: primaryIndustry,  // ✅ Primary industry identified
    traction_score: traction,
    team_score: team,
    market_score: market,
    product_score: product,
    social_score: social,
    vision_score: vision,
    stage: stage // Include stage for debugging
  };
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================
async function main() {
  console.log('🎯 GOD SCORE V6.1 - WITH SOCIAL SIGNALS + INDUSTRY SCORING');
  console.log('===========================================================');
  console.log('No AI API calls - pure math and logic');
  console.log('Stage-appropriate scoring: Pre-seed → Seed → Series A → Series B+');
  console.log('✅ Social buzz scoring integrated (7-10% weight)');
  console.log('✅ Industry-specific GOD scoring (18 industries supported)\n');
  
  // Parse args
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) || 100 : null;
  
  const batchSize = 1000;
  let updated = 0;
  let errors = 0;
  let processed = 0;
  const scoreDistribution = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  
  while (true) {
    const remaining = limit ? limit - processed : null;
    if (remaining !== null && remaining <= 0) break;
    
    const fetchSize = remaining !== null ? Math.min(batchSize, remaining) : batchSize;
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(processed, processed + fetchSize - 1);
    
    if (error) {
      console.error('❌ Error fetching startups:', error.message);
      process.exit(1);
    }
    
    if (!startups?.length) break;
    
    if (processed === 0) {
      console.log(`📊 Processing startups in batches of ${batchSize}${limit ? ` (limit ${limit})` : ''}...\n`);
    }
    console.log(`--- Batch ${Math.floor(processed / batchSize) + 1}: ${startups.length} startups ---\n`);
  
  for (const startup of startups) {
    try {
      const scores = await calculateGodScore(startup); // ✅ Now async
      
      // Track distribution
      if (scores.total < 20) scoreDistribution['0-19']++;
      else if (scores.total < 40) scoreDistribution['20-39']++;
      else if (scores.total < 60) scoreDistribution['40-59']++;
      else if (scores.total < 80) scoreDistribution['60-79']++;
      else scoreDistribution['80-100']++;
      
      // Update database
      const updateData = {
          total_god_score: scores.total,
          traction_score: scores.traction_score,
          team_score: scores.team_score,
          market_score: scores.market_score,
          product_score: scores.product_score,
          social_score: scores.social_score,
          vision_score: scores.vision_score,
          updated_at: new Date().toISOString()
      };
      
      // Try to include industry columns (migration may not have run yet)
      // We'll detect if columns don't exist and retry without them
      if (scores.industry_total !== undefined) {
        updateData.industry_god_score = scores.industry_total;
      }
      if (scores.primary_industry) {
        updateData.primary_industry = scores.primary_industry;
      }
      
      let { error: updateError } = await supabase
        .from('startup_uploads')
        .update(updateData)
        .eq('id', startup.id);
      
      // If update fails due to missing column, retry without industry fields
      if (updateError && (updateError.message.includes('industry_god_score') || updateError.message.includes('primary_industry'))) {
        // Remove industry fields and retry with just standard scores
        const standardUpdateData = {
          total_god_score: scores.total,
          traction_score: scores.traction_score,
          team_score: scores.team_score,
          market_score: scores.market_score,
          product_score: scores.product_score,
          social_score: scores.social_score,
          vision_score: scores.vision_score,
          updated_at: new Date().toISOString()
        };
        const { error: retryError } = await supabase
          .from('startup_uploads')
          .update(standardUpdateData)
          .eq('id', startup.id);
        if (retryError) {
          throw retryError;
        }
        // Note: Industry scores were calculated but not saved (migration needed)
      } else if (updateError) {
        throw updateError;
      }
      
      if (updateError) {
        console.error(`❌ ${startup.name}: ${updateError.message}`);
        errors++;
      } else {
        const emoji = scores.total >= 70 ? '🔥' : scores.total >= 50 ? '✅' : scores.total >= 30 ? '📊' : '⚠️';
        const stageLabel = ['', 'Pre-Seed', 'Seed', 'Series A', 'Series B+'][scores.stage] || `Stage ${scores.stage}`;
        const industryNote = scores.primary_industry && scores.primary_industry !== 'default' ? ` [${scores.primary_industry}:${scores.industry_total}]` : '';
        console.log(`${emoji} [${stageLabel}] ${startup.name}: ${scores.total}${industryNote} (T:${scores.traction_score} Te:${scores.team_score} M:${scores.market_score} P:${scores.product_score} S:${scores.social_score} V:${scores.vision_score})`);
        updated++;
      }
      
    } catch (err) {
      console.error(`❌ ${startup.name}: ${err.message}`);
      errors++;
    }
  }
  
    processed += startups.length;
    if (startups.length < fetchSize) break;
  }
  
  console.log('\n=====================================');
  console.log('📈 SCORE DISTRIBUTION:');
  console.log(`   0-19:  ${scoreDistribution['0-19']} startups`);
  console.log(`   20-39: ${scoreDistribution['20-39']} startups`);
  console.log(`   40-59: ${scoreDistribution['40-59']} startups`);
  console.log(`   60-79: ${scoreDistribution['60-79']} startups`);
  console.log(`   80-100: ${scoreDistribution['80-100']} startups`);
  console.log('=====================================');
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);

