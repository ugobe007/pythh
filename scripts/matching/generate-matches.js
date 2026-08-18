#!/usr/bin/env node

/**
 * Generate Startup-Investor Matches
 * 
 * Creates matches between startups and investors based on:
 * - Industry/sector alignment
 * - Funding stage fit
 * - Investment thesis match
 * - Geographic preferences
 */

const { createClient } = require('@supabase/supabase-js');
const { normalizeEntityName } = require('../../server/lib/fundingEvidenceLedger.js');
const { buildInvestorHistoricalFeatures, scoreHistoricalFit, scoreRecentActivity } = require('../../server/lib/investorHistoricalFeatures.js');
const { normalizeSectors, expandRelatedSectors } = require('../../server/lib/sectorTaxonomy.js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function normalizeStartupStage(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const stage = String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (!stage) return 2;
  if (stage.includes('pre seed') || stage.includes('preseed') || stage.includes('angel')) return 1;
  if (stage === 'seed' || stage.includes('seed stage')) return 2;
  if (stage.includes('series a')) return 3;
  if (stage.includes('series b')) return 4;
  if (stage.includes('series c') || stage.includes('growth') || stage.includes('late')) return 5;
  return 2;
}

function sectorValues(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function calculateSectorFit(startupSectors, investorSectors, investmentThesis = '') {
  const startupCanonical = normalizeSectors(sectorValues(startupSectors));
  const investorCanonical = normalizeSectors(
    sectorValues(investorSectors).length ? sectorValues(investorSectors) : [investmentThesis],
  );
  if (!startupCanonical.length || !investorCanonical.length) {
    return { points: 0, direct_matches: [], related_matches: [] };
  }

  const directMatches = startupCanonical.filter(sector => investorCanonical.includes(sector));
  const expandedStartup = expandRelatedSectors(startupCanonical);
  const relatedMatches = investorCanonical.filter(sector =>
    !directMatches.includes(sector) && expandedStartup.includes(sector),
  );
  return {
    points: Math.min(20, directMatches.length * 7 + relatedMatches.length * 3),
    direct_matches: directMatches,
    related_matches: relatedMatches,
  };
}

  // Enhanced matching algorithm using GOD scores
function calculateMatch(startup, investor) {
  let score = 0;
  let reasons = [];
  
  // Base score from GOD score (55 points max) - INCREASED from 40%
  const godScore = startup.total_god_score || 50;
  score += Math.floor(godScore * 0.55);
  reasons.push(`GOD score: ${godScore}`);
  
  // BONUS for high GOD scores - ensures quality startups get better matches
  if (godScore >= 80) {
    score += 15;
    reasons.push('Elite startup bonus (+15)');
  } else if (godScore >= 75) {
    score += 10;
    reasons.push('High-quality startup bonus (+10)');
  } else if (godScore >= 70) {
    score += 5;
    reasons.push('Quality startup bonus (+5)');
  }
  const startupQualityPoints = score;
  const investorFitComponents = {};
  let componentStart = score;

  // A documented prior relationship is a strong, causal candidate-generation
  // signal for follow-on participation. It must come from the startup record,
  // not from the outcome event being evaluated.
  const recordedInvestors = [
    ...(Array.isArray(startup.extracted_data?.investors) ? startup.extracted_data.investors : []),
    ...(Array.isArray(startup.extracted_data?.resolver_investors) ? startup.extracted_data.resolver_investors : []),
    ...(Array.isArray(startup.backed_by) ? startup.backed_by : []),
  ].map(normalizeEntityName).filter(Boolean);
  const investorIdentityKeys = [investor.firm, investor.name].map(normalizeEntityName).filter(Boolean);
  const featureCutoff = startup.feature_cutoff_at ? new Date(startup.feature_cutoff_at) : null;
  const relationshipObservedAt = startup.extracted_data?.scraped_at
    ? new Date(startup.extracted_data.scraped_at)
    : null;
  const relationshipWasObservable = !featureCutoff
    || (relationshipObservedAt && relationshipObservedAt < featureCutoff);
  if (relationshipWasObservable && investorIdentityKeys.some(key => recordedInvestors.includes(key))) {
    score += 20;
    reasons.push('Documented prior investor relationship (+20)');
  }
  const historicalFit = scoreHistoricalFit(startup, investor.historical_features, featureCutoff || new Date());
  if (historicalFit.points > 0) {
    score += historicalFit.points;
    reasons.push(...historicalFit.reasons.map(reason => `${reason} (+history)`));
  }
  investorFitComponents.relationship_history = score - componentStart;
  componentStart = score;
  
  // Stage fit (15 points) - REDUCED from 20 to make room for GOD score
  const startupStage = normalizeStartupStage(startup.stage);
  // Handle both array and string formats for investor stages
  let investorStages = '';
  if (Array.isArray(investor.stage)) {
    investorStages = investor.stage.map(s => s.toString().toLowerCase()).join(' ');
  } else {
    investorStages = (investor.stage || '').toString().toLowerCase();
  }
  
  let stageFitPoints = 0;
  if (startupStage === 1 && investorStages.includes('pre')) {
    stageFitPoints = 15;
    reasons.push('Stage fit: Pre-seed');
  } else if (startupStage === 2 && investorStages.includes('seed')) {
    stageFitPoints = 15;
    reasons.push('Stage fit: Seed');
  } else if (startupStage >= 3 && investorStages.includes('series')) {
    stageFitPoints = 15;
    reasons.push('Stage fit: Series');
  } else if (investorStages.includes('early')) {
    stageFitPoints = 10;
    reasons.push('Stage fit: Early stage');
  } else if (investorStages.includes('any') || investorStages.includes('all')) {
    stageFitPoints = 8; // Partial credit for flexible investors
    reasons.push('Stage fit: Flexible investor');
  }
  score += stageFitPoints;
  investorFitComponents.stage = score - componentStart;
  componentStart = score;
  
  // Canonical sector fit avoids substring false positives (for example AI ↔ Retail)
  // while preserving lower-weight adjacency such as Developer Tools ↔ AI/ML.
  const sectorFit = calculateSectorFit(startup.sectors, investor.sectors, investor.investment_thesis);
  score += sectorFit.points;
  reasons.push(...sectorFit.direct_matches.map(sector => `Sector match: ${sector.toLowerCase()}`));
  reasons.push(...sectorFit.related_matches.map(sector => `Related sector fit: ${sector.toLowerCase()} (+3)`));
  investorFitComponents.sector = score - componentStart;
  componentStart = score;
  
  // Geography fit (5 points) - REDUCED from 10
  if (startup.location) {
    const startupLoc = startup.location.toLowerCase();
    // Check geography_focus array or string
    let investorGeos = [];
    if (Array.isArray(investor.geography_focus)) {
      investorGeos = investor.geography_focus.map(g => g.toString().toLowerCase());
    } else if (investor.geography_focus) {
      investorGeos = [investor.geography_focus.toString().toLowerCase()];
    }
    
    // Check if startup location matches any investor geography preference
    const hasMatch = investorGeos.some(geo => 
      startupLoc.includes(geo) || geo.includes(startupLoc) ||
      startupLoc.includes(geo.replace(/\s+/g, '')) || geo.includes(startupLoc.replace(/\s+/g, ''))
    );
    
    if (hasMatch) {
      score += 5;
      reasons.push('Geography match');
    }
  }
  investorFitComponents.geography = score - componentStart;
  componentStart = score;
  
  // Investor quality bonus (5 points) - NEW
  const investorScore = investor.investor_score || investor.quality_score || 5;
  if (investorScore >= 8) {
    score += 5;
    reasons.push('Elite investor bonus');
  } else if (investorScore >= 6) {
    score += 3;
    reasons.push('Quality investor bonus');
  }
  investorFitComponents.investor_quality = score - componentStart;
  componentStart = score;
  
  // Check Size Fit (5-10 points) - NEW
  const startupRaiseAmount = startup.raise_amount || startup.extracted_data?.raise_amount;
  const investorCheckMin = investor.check_size_min;
  const investorCheckMax = investor.check_size_max;
  
  if (startupRaiseAmount && investorCheckMin && investorCheckMax) {
    // Parse raise amount (could be "$5M", "5000000", etc.)
    let raiseValue = 0;
    if (typeof startupRaiseAmount === 'string') {
      const match = startupRaiseAmount.match(/(\d+\.?\d*)/);
      if (match) {
        raiseValue = parseFloat(match[1]);
        if (startupRaiseAmount.toLowerCase().includes('m') || startupRaiseAmount.toLowerCase().includes('million')) {
          raiseValue *= 1000000;
        } else if (startupRaiseAmount.toLowerCase().includes('k') || startupRaiseAmount.toLowerCase().includes('thousand')) {
          raiseValue *= 1000;
        } else if (startupRaiseAmount.toLowerCase().includes('b') || startupRaiseAmount.toLowerCase().includes('billion')) {
          raiseValue *= 1000000000;
        }
      }
    } else if (typeof startupRaiseAmount === 'number') {
      raiseValue = startupRaiseAmount;
    }
    
    if (raiseValue > 0) {
      // Check if raise amount fits within investor's check size range
      if (raiseValue >= investorCheckMin && raiseValue <= investorCheckMax) {
        // Perfect fit - in the middle of range gets bonus
        const rangeMid = (investorCheckMin + investorCheckMax) / 2;
        const distanceFromMid = Math.abs(raiseValue - rangeMid);
        const rangeSize = investorCheckMax - investorCheckMin;
        const fitRatio = 1 - (distanceFromMid / rangeSize);
        
        if (fitRatio > 0.7) {
          score += 10;
          reasons.push('Perfect check size fit (+10)');
        } else if (fitRatio > 0.4) {
          score += 7;
          reasons.push('Good check size fit (+7)');
        } else {
          score += 5;
          reasons.push('Check size fit (+5)');
        }
      } else if (raiseValue < investorCheckMin) {
        // Too small - might still work if close
        const ratio = raiseValue / investorCheckMin;
        if (ratio > 0.7) {
          score += 3;
          reasons.push('Check size close fit (+3)');
        }
      } else if (raiseValue > investorCheckMax) {
        // Too large - might still work if close
        const ratio = investorCheckMax / raiseValue;
        if (ratio > 0.7) {
          score += 3;
          reasons.push('Check size close fit (+3)');
        }
      }
    }
  } else {
    // Fallback: Use stage to estimate check size
    const stage = normalizeStartupStage(startup.stage);
    const estimatedRaise = stage === 1 ? 500000 : stage === 2 ? 2000000 : stage === 3 ? 5000000 : 10000000;
    
    if (investorCheckMin && investorCheckMax) {
      if (estimatedRaise >= investorCheckMin && estimatedRaise <= investorCheckMax) {
        score += 5;
        reasons.push('Estimated check size fit (+5)');
      }
    }
  }
  investorFitComponents.check_size = score - componentStart;
  componentStart = score;
  
  // Investment Activity/Recency (3-5 points) - NEW
  if (investor.last_investment_date) {
    const activity = scoreRecentActivity(investor.last_investment_date, featureCutoff || new Date());
    score += activity.points;
    if (activity.reason) reasons.push(activity.reason);
  }
  
  // Investment pace bonus
  const investmentPace = investor.investment_pace_per_year || 0;
  if (investmentPace >= 10) {
    score += 2;
    reasons.push('High investment pace (+2)');
  } else if (investmentPace >= 5) {
    score += 1;
    reasons.push('Active investor (+1)');
  }
  investorFitComponents.activity = score - componentStart;
  componentStart = score;
  
  // Lead investor bonus
  if (investor.leads_rounds === true) {
    score += 2;
    reasons.push('Lead investor (+2)');
  }
  investorFitComponents.leadership = score - componentStart;
  componentStart = score;
  
  // Portfolio Fit Analysis (5-10 points) - NEW Phase 2
  const portfolioObservedAt = investor.portfolio_observed_at ? new Date(investor.portfolio_observed_at) : null;
  const portfolioWasObservable = !featureCutoff
    || (portfolioObservedAt && portfolioObservedAt < featureCutoff);
  if (portfolioWasObservable && investor.portfolio_companies && Array.isArray(investor.portfolio_companies) && investor.portfolio_companies.length > 0) {
    const portfolio = investor.portfolio_companies.map(c => c.toString().toLowerCase());
    const startupName = (startup.name || '').toLowerCase();
    const startupDesc = (startup.description || '').toLowerCase();
    const startupSectorsText = Array.isArray(startup.sectors) 
      ? startup.sectors.join(' ').toLowerCase()
      : (startup.sectors || '').toString().toLowerCase();
    
    // Check for similar companies (same sector/stage)
    let similarCount = 0;
    portfolio.forEach(company => {
      // Check if portfolio company is in similar sector
      if (startupSectorsText && company) {
        const commonSectors = ['ai', 'fintech', 'saas', 'healthcare', 'ecommerce', 'marketplace', 'b2b', 'enterprise'];
        commonSectors.forEach(sector => {
          if (company.includes(sector) && startupSectorsText.includes(sector)) {
            similarCount++;
          }
        });
      }
    });
    
    if (similarCount > 0) {
      score += 5;
      reasons.push(`Portfolio fit: Similar companies (+5)`);
    } else {
      // Check for complementary companies (adjacent sectors)
      let complementaryCount = 0;
      portfolio.forEach(company => {
        // Adjacent sector logic (e.g., fintech + payments, healthcare + biotech)
        if ((company.includes('fintech') || company.includes('payments')) && 
            (startupSectorsText.includes('fintech') || startupSectorsText.includes('payments'))) {
          complementaryCount++;
        }
        if ((company.includes('healthcare') || company.includes('biotech')) && 
            (startupSectorsText.includes('healthcare') || startupSectorsText.includes('biotech'))) {
          complementaryCount++;
        }
      });
      
      if (complementaryCount > 0) {
        score += 3;
        reasons.push(`Portfolio fit: Complementary companies (+3)`);
      } else {
        // Portfolio gap - investor doesn't have companies in this sector (new opportunity)
        score += 2;
        reasons.push(`Portfolio gap: New opportunity (+2)`);
      }
    }
  } else if (portfolioWasObservable && investor.notable_investments && Array.isArray(investor.notable_investments) && investor.notable_investments.length > 0) {
    // Use notable_investments as fallback
    const notable = investor.notable_investments.map(c => c.toString().toLowerCase());
    const startupSectorsText = Array.isArray(startup.sectors) 
      ? startup.sectors.join(' ').toLowerCase()
      : (startup.sectors || '').toString().toLowerCase();
    
    let hasSimilar = false;
    notable.forEach(company => {
      const commonSectors = ['ai', 'fintech', 'saas', 'healthcare', 'ecommerce', 'marketplace'];
      commonSectors.forEach(sector => {
        if (company.includes(sector) && startupSectorsText.includes(sector)) {
          hasSimilar = true;
        }
      });
    });
    
    if (hasSimilar) {
      score += 5;
      reasons.push(`Portfolio fit: Notable investments (+5)`);
    }
  }
  investorFitComponents.portfolio = score - componentStart;
  componentStart = score;
  
  // Investor Tier-Based Matching (5 points) - NEW Phase 2
  const investorTier = investor.investor_tier || 'emerging';
  if (investorTier === 'elite' && godScore >= 75) {
    score += 5;
    reasons.push('Elite investor + elite startup (+5)');
  } else if (investorTier === 'strong' && godScore >= 65) {
    score += 3;
    reasons.push('Strong investor + quality startup (+3)');
  } else if (investorTier === 'emerging') {
    // Emerging investors see all startups (no penalty, but no bonus either)
    // This helps emerging investors get deal flow
  }
  investorFitComponents.tier = score - componentStart;
  componentStart = score;
  
  // Traction Metrics Bonus (5-10 points) - NEW Phase 2
  const growthRate = startup.growth_rate_monthly || startup.extracted_data?.growth_rate_monthly || 0;
  const mrr = startup.mrr || startup.extracted_data?.mrr || 0;
  const arr = startup.arr || startup.extracted_data?.arr || 0;
  const customerCount = startup.customer_count || startup.extracted_data?.customer_count || 0;
  const teamSize = startup.team_size || startup.extracted_data?.team_size || 0;
  
  // High growth bonus
  if (growthRate > 20) {
    score += 5;
    reasons.push(`High growth (${growthRate}% MoM) (+5)`);
  } else if (growthRate > 10) {
    score += 3;
    reasons.push(`Strong growth (${growthRate}% MoM) (+3)`);
  } else if (growthRate > 5) {
    score += 1;
    reasons.push(`Positive growth (${growthRate}% MoM) (+1)`);
  }
  
  // Revenue bonus
  if (arr > 120000 || mrr > 10000) {
    score += 3;
    reasons.push(`Revenue traction (+3)`);
  } else if (arr > 60000 || mrr > 5000) {
    score += 2;
    reasons.push(`Early revenue (+2)`);
  }
  
  // Customer base bonus
  if (customerCount > 100) {
    score += 2;
    reasons.push(`Customer base (${customerCount}+) (+2)`);
  } else if (customerCount > 50) {
    score += 1;
    reasons.push(`Growing customer base (+1)`);
  }
  
  // Team size bonus (more established)
  if (teamSize > 10) {
    score += 2;
    reasons.push(`Established team (${teamSize}+) (+2)`);
  } else if (teamSize > 5) {
    score += 1;
    reasons.push(`Growing team (+1)`);
  }
  investorFitComponents.traction = score - componentStart;
  
  // GOD measures whether the startup deserves attention; it is constant for every
  // investor and therefore must not dominate investor ordering. Normalize the
  // investor-specific fit points separately to avoid hundreds of 100-point ties.
  const investorFitPoints = Math.max(0, score - startupQualityPoints);
  const investorFitPercent = Math.min(100, (investorFitPoints / 65) * 100);
  const calibratedScore = Math.round(((godScore * 0.25) + (investorFitPercent * 0.75)) * 10) / 10;
  const confidence = calibratedScore >= 70 ? 'high' : calibratedScore >= 50 ? 'medium' : 'low';
  
  return {
    score: calibratedScore,
    investor_fit_score: Math.round(investorFitPercent * 10) / 10,
    legacy_raw_score: score,
    startup_quality_score: godScore,
    investor_fit_components: investorFitComponents,
    confidence,
    reason: reasons.join('; ') || 'Basic compatibility match',
    stage_fit: stageFitPoints > 0,
    sector_fit: sectorFit.points > 0
  };
}

function fallbackFirmKey(investor) {
  const parenthetical = String(investor.name || '').match(/\(([^)]+)\)\s*$/)?.[1];
  const label = String(investor.firm || parenthetical || investor.name || investor.id || '')
    .trim().replace(/^at\s+/i, '');
  return `label:${normalizeEntityName(label)}`;
}

function selectTopInvestorCandidates(scored, membershipByInvestor = new Map(), limit = 50) {
  const ranked = [...scored].sort((a, b) =>
    b.match.score - a.match.score || String(a.investor.id).localeCompare(String(b.investor.id))
  );
  const seenOrganizations = new Set();
  const selected = [];
  for (const item of ranked) {
    const organizationId = membershipByInvestor.get(item.investor.id);
    const firmKey = organizationId ? `organization:${organizationId}` : fallbackFirmKey(item.investor);
    if (!firmKey || seenOrganizations.has(firmKey)) continue;
    seenOrganizations.add(firmKey);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

async function fetchAllInvestors(client, selectColumns, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('investors')
      .select(selectColumns)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchAllRows(client, table, selectColumns, configure = query => query, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const query = configure(client.from(table).select(selectColumns)).range(offset, offset + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadVerifiedHistoricalFeatures(client, membershipByInvestor, cutoffAt = new Date()) {
  const events = await fetchAllRows(client, 'funding_evidence_events',
    'id,startup_id,canonical_round_key,round_type,announced_at,occurred_at,verification_status',
    query => query.in('verification_status', ['corroborated', 'verified']).lt('announced_at', new Date(cutoffAt).toISOString()));
  if (!events.length) return new Map();
  const eventIds = events.map(row => row.id);
  const participants = [];
  for (let offset = 0; offset < eventIds.length; offset += 200) {
    const { data, error } = await client.from('funding_evidence_participants')
      .select('funding_event_id,investor_id,investor_organization_id,participant_role,participation_relation')
      .in('funding_event_id', eventIds.slice(offset, offset + 200));
    if (error) throw error;
    participants.push(...(data || []));
  }
  const startupIds = [...new Set(events.map(row => row.startup_id).filter(Boolean))];
  const startups = [];
  for (let offset = 0; offset < startupIds.length; offset += 200) {
    const { data, error } = await client.from('startup_uploads').select('id,sectors,stage').in('id', startupIds.slice(offset, offset + 200));
    if (error) throw error;
    startups.push(...(data || []));
  }
  return buildInvestorHistoricalFeatures({ events, participants, startups, membershipByInvestor, cutoffAt });
}

async function generateMatches() {
  console.log('🎯 Generating Startup-Investor Matches...\n');
  
  // Get all approved startups with GOD scores (ready for matching)
  const { data: startups, error: startupsError } = await supabase
    .from('startup_uploads')
    .select('id, name, description, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score, location, website, raise_amount, mrr, arr, growth_rate_monthly, customer_count, team_size, extracted_data')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .gt('total_god_score', 0);
  
  if (startupsError) {
    console.error('❌ Error fetching startups:', startupsError);
    return;
  }
  
  if (!startups || startups.length === 0) {
    console.log('⚠️  No scored startups found. Run GOD scoring first.');
    return;
  }
  
  // Get all investors with relevant fields for matching
  let investors;
  try {
    investors = await fetchAllInvestors(supabase, 'id, name, firm, url, sectors, stage, check_size_min, check_size_max, geography_focus, investor_score, investor_tier, last_investment_date, investment_pace_per_year, leads_rounds, follows_rounds, portfolio_companies, notable_investments, investment_thesis');
  } catch (investorsError) {
    console.error('❌ Error fetching investors:', investorsError);
    return;
  }
  
  console.log(`📊 Found ${startups.length} startups and ${investors.length} investors`);
  console.log('🔄 Calculating matches...\n');

  const membershipByInvestor = new Map();
  for (let offset = 0; offset < investors.length; offset += 200) {
    const ids = investors.slice(offset, offset + 200).map(row => row.id);
    const { data: memberships, error: membershipError } = await supabase
      .from('investor_organization_memberships')
      .select('investor_id,organization_id')
      .in('investor_id', ids);
    if (membershipError) {
      console.warn(`⚠️ Organization membership lookup failed; using firm labels: ${membershipError.message}`);
      break;
    }
    for (const row of memberships || []) membershipByInvestor.set(row.investor_id, row.organization_id);
  }
  const { data: organizationAliases, error: aliasError } = await supabase
    .from('investor_organization_aliases').select('organization_id,normalized_alias');
  if (aliasError) {
    console.warn(`⚠️ Organization alias lookup failed; using reviewed memberships only: ${aliasError.message}`);
  } else {
    const organizationByAlias = new Map((organizationAliases || []).map(row => [row.normalized_alias, row.organization_id]));
    for (const investor of investors) {
      if (membershipByInvestor.has(investor.id)) continue;
      const organizationId = [investor.firm, investor.name]
        .map(normalizeEntityName).filter(Boolean)
        .map(value => organizationByAlias.get(value)).find(Boolean);
      if (organizationId) membershipByInvestor.set(investor.id, organizationId);
    }
  }
  let historicalFeatures = new Map();
  try {
    historicalFeatures = await loadVerifiedHistoricalFeatures(supabase, membershipByInvestor, new Date());
  } catch (historyError) {
    console.warn(`⚠️ Verified funding history unavailable; continuing without it: ${historyError.message}`);
  }
  for (const investor of investors) {
    const organizationId = membershipByInvestor.get(investor.id);
    investor.historical_features = historicalFeatures.get(organizationId ? `organization:${organizationId}` : `investor:${investor.id}`) || null;
  }
  
  const matches = [];
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  
  // Generate matches for each startup (increased for ML training)
  let processedStartups = 0;
  const startupsWithMatches = new Set();
  
  for (const startup of startups) {
    // Dynamic threshold based on startup quality - NEW
    const godScore = startup.total_god_score || 50;
    let minMatchScore = 15; // Default
    if (godScore >= 80) {
      minMatchScore = 25; // Elite startups get higher threshold
    } else if (godScore >= 70) {
      minMatchScore = 20; // High-quality startups
    } else if (godScore >= 60) {
      minMatchScore = 18; // Good startups
    } else if (godScore < 50) {
      minMatchScore = 10; // Lower startups can have lower threshold
    }
    
    const scoredCandidates = investors.map(investor => ({
      investor,
      match: calculateMatch(startup, investor),
    })).filter(item => item.match.score > minMatchScore);
    const selectedCandidates = selectTopInvestorCandidates(scoredCandidates, membershipByInvestor, 50);

    for (const { investor, match } of selectedCandidates) {
        matches.push({
          startup_id: startup.id,
          investor_id: investor.id,
          match_score: match.score,
          confidence_level: match.confidence,
          reasoning: match.reason, // Use 'reasoning' instead of 'match_reason'
          status: 'suggested'
        });
        
        if (match.confidence === 'high') highConfidence++;
        else if (match.confidence === 'medium') mediumConfidence++;
        else lowConfidence++;
        
        startupsWithMatches.add(startup.id);
    }
    processedStartups++;
    
    // Log progress every 100 startups
    if (processedStartups % 100 === 0) {
      console.log(`   Processed ${processedStartups}/${startups.length} startups, ${matches.length} matches so far...`);
    }
  }
  
  console.log(`\n✅ Processed all ${processedStartups} startups`);
  console.log(`   ${startupsWithMatches.size} startups will have matches`);
  
  console.log(`✅ Generated ${matches.length} potential matches:`);
  console.log(`   🟢 High confidence: ${highConfidence}`);
  console.log(`   🟡 Medium confidence: ${mediumConfidence}`);
  console.log(`   🔴 Low confidence: ${lowConfidence}`);
  
  if (matches.length === 0) {
    console.log('\n⚠️  No matches found. Check your data.');
    return;
  }
  
  // Insert matches into database (use upsert to avoid duplicates)
  console.log('\n💾 Saving matches to database...');
  
  // Batch insert in chunks of 1000 to avoid timeout
  const BATCH_SIZE = 1000;
  let totalSaved = 0;
  
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .upsert(batch, { 
        onConflict: 'startup_id,investor_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error(`❌ Error saving batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message);
      continue;
    }
    
    totalSaved += data?.length || 0;
    console.log(`   ✅ Saved batch ${Math.floor(i/BATCH_SIZE) + 1}: ${data?.length || 0} matches`);
  }
  
  console.log(`\n✅ Successfully saved ${totalSaved} total matches!\n`);
  
  // Show statistics
  const { data: stats } = await supabase
    .from('match_statistics')
    .select('*')
    .single();
  
  if (stats) {
    console.log('📊 MATCH STATISTICS:');
    console.log(`   Total matches: ${stats.total_matches}`);
    console.log(`   Unique startups matched: ${stats.unique_startups_matched}`);
    console.log(`   Unique investors matched: ${stats.unique_investors_matched}`);
    console.log(`   Average match score: ${stats.avg_match_score?.toFixed(2)}`);
    console.log(`   High confidence matches: ${stats.high_confidence_matches}`);
  }
  
  // Show top matches
  const { data: topMatches } = await supabase
    .from('startup_investor_matches')
    .select(`
      *,
      startup_uploads!startup_investor_matches_startup_id_fkey(name),
      investors!startup_investor_matches_investor_id_fkey(name)
    `)
    .order('match_score', { ascending: false })
    .limit(5);
  
  if (topMatches && topMatches.length > 0) {
    console.log('\n🏆 TOP 5 MATCHES:');
    topMatches.forEach((match, i) => {
      const startupName = match.startup_uploads?.name || 'Unknown';
      const investorName = match.investors?.name || 'Unknown';
      const reason = match.reasoning || match.match_reason || 'No reason provided';
      console.log(`   ${i + 1}. ${startupName} ↔ ${investorName}`);
      console.log(`      Score: ${match.match_score} | Confidence: ${match.confidence_level}`);
      console.log(`      Reason: ${reason.substring(0, 80)}${reason.length > 80 ? '...' : ''}`);
    });
  }
}

// Run the matching
if (require.main === module) generateMatches().catch(console.error);

module.exports = { calculateMatch, calculateSectorFit, normalizeStartupStage, fallbackFirmKey, selectTopInvestorCandidates, fetchAllInvestors, loadVerifiedHistoricalFeatures };
