/**
 * Freshman Audit - What data do Freshman-tier (40-44) startups have?
 * Identifies "promising student" signals even in sparse data.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function audit() {
  console.log('=== FRESHMAN TIER AUDIT (40-44) ===\n');

  const allFreshman: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, extracted_data, pitch, description, tagline, website, stage, sectors, is_launched, has_demo, has_revenue, has_customers, growth_rate, team_signals, execution_signals, credential_signals, lead_investor, latest_funding_amount, latest_funding_round, latest_funding_date, created_at, followon_investors, is_oversubscribed, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, advisors, strategic_partners, founders, founder_avg_age, has_technical_cofounder, customer_count, arr, mrr, contrarian_belief, why_now, unfair_advantage')
      .eq('status', 'approved')
      .gte('total_god_score', 40)
      .lte('total_god_score', 44)
      .order('total_god_score', { ascending: false })
      .range(from, from + batchSize - 1);
    
    if (error) { console.error('Error:', error); break; }
    if (!data || data.length === 0) break;
    allFreshman.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  const total = allFreshman.length;
  console.log(`Total Freshman (40-44): ${total}\n`);

  // === Data availability ===
  console.log('=== DATA FIELD AVAILABILITY ===');
  const checks = [
    { label: 'tagline', fn: (s: any) => s.tagline && s.tagline.length > 5 },
    { label: 'pitch', fn: (s: any) => s.pitch && s.pitch.length > 10 },
    { label: 'description', fn: (s: any) => s.description && s.description.length > 10 },
    { label: 'sectors', fn: (s: any) => s.sectors && s.sectors.length > 0 },
    { label: 'website', fn: (s: any) => !!s.website },
    { label: 'is_launched', fn: (s: any) => !!s.is_launched },
    { label: 'has_revenue', fn: (s: any) => !!s.has_revenue },
    { label: 'has_customers', fn: (s: any) => !!s.has_customers },
    { label: 'has_technical_cofounder', fn: (s: any) => !!s.has_technical_cofounder },
    { label: 'team_signals', fn: (s: any) => s.team_signals && s.team_signals.length > 0 },
    { label: 'execution_signals', fn: (s: any) => s.execution_signals && s.execution_signals.length > 0 },
    { label: 'credential_signals', fn: (s: any) => s.credential_signals && s.credential_signals.length > 0 },
    { label: 'lead_investor', fn: (s: any) => !!s.lead_investor },
    { label: 'latest_funding_amount', fn: (s: any) => !!s.latest_funding_amount },
    { label: 'latest_funding_round', fn: (s: any) => !!s.latest_funding_round },
    { label: 'growth_rate', fn: (s: any) => s.growth_rate > 0 },
    { label: 'customer_count', fn: (s: any) => s.customer_count > 0 },
    { label: 'ed.value_proposition', fn: (s: any) => (s.extracted_data?.value_proposition || '').length > 10 },
    { label: 'ed.problem', fn: (s: any) => (s.extracted_data?.problem || '').length > 10 },
    { label: 'ed.solution', fn: (s: any) => (s.extracted_data?.solution || '').length > 10 },
    { label: 'ed.funding_amount', fn: (s: any) => !!s.extracted_data?.funding_amount },
    { label: 'ed.funding_stage', fn: (s: any) => !!s.extracted_data?.funding_stage },
    { label: 'ed.has_revenue', fn: (s: any) => !!s.extracted_data?.has_revenue },
    { label: 'ed.is_launched', fn: (s: any) => !!s.extracted_data?.is_launched },
    { label: 'ed.investors_mentioned', fn: (s: any) => (s.extracted_data?.investors_mentioned || []).length > 0 },
    { label: 'ed.team.founders', fn: (s: any) => (s.extracted_data?.team?.founders || []).length > 0 },
    { label: 'ed.team_signals', fn: (s: any) => (s.extracted_data?.team_signals || []).length > 0 },
    { label: 'ed.credential_signals', fn: (s: any) => (s.extracted_data?.credential_signals || []).length > 0 },
    { label: 'ed.execution_signals', fn: (s: any) => (s.extracted_data?.execution_signals || []).length > 0 },
  ];

  for (const c of checks) {
    const count = allFreshman.filter(c.fn).length;
    if (count > 0) {
      console.log(`  ${c.label}: ${count} (${(count/total*100).toFixed(1)}%)`);
    }
  }

  // === Hot sector analysis ===
  console.log('\n=== SECTOR ANALYSIS ===');
  const sectorCounts: Record<string, number> = {};
  const hotSectors = ['ai', 'fintech', 'biotech', 'climate', 'healthcare', 'saas', 'crypto', 'web3', 'deep tech', 'cybersecurity', 'edtech'];
  
  for (const s of allFreshman) {
    const sectors = s.sectors || [];
    for (const sec of sectors) {
      const key = sec.toLowerCase();
      sectorCounts[key] = (sectorCounts[key] || 0) + 1;
    }
  }
  
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [sec, count] of topSectors) {
    const isHot = hotSectors.some(h => sec.includes(h));
    console.log(`  ${sec}: ${count} (${(count/total*100).toFixed(1)}%)${isHot ? ' 🔥' : ''}`);
  }

  // === Promising signal detection ===
  console.log('\n=== PROMISING STUDENT SIGNALS ===');
  
  // For Freshman, "promising" means they show signs of potential despite sparse data
  const ROCKSTAR_COMPANIES = ['google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'tesla', 'spacex', 'openai', 'stripe', 'airbnb', 'uber', 'netflix', 'palantir', 'coinbase'];
  const ROCKSTAR_SCHOOLS = ['stanford', 'mit', 'harvard', 'yale', 'princeton', 'caltech', 'carnegie mellon', 'berkeley', 'wharton'];
  
  let hasHotSector = 0;
  let hasProductSignal = 0;
  let hasFundingSignal = 0;
  let hasTeamQuality = 0;
  let hasClearVP = 0;
  let hasWebsite = 0;
  let hasAnythingSpecial = 0;
  let multiPromising = 0;

  const candidates: any[] = [];

  for (const s of allFreshman) {
    const ed = s.extracted_data || {};
    const allText = [
      s.pitch || '', s.tagline || '', s.description || '',
      ed.value_proposition || '', ed.problem || '', ed.solution || '',
      s.name || '', ...(ed.fivePoints || [])
    ].join(' ').toLowerCase();
    
    let signals = 0;
    const flags: string[] = [];

    // P1: Hot Sector (AI, fintech, biotech, etc.)
    const sectors = (s.sectors || []).map((x: string) => x.toLowerCase());
    const inHotSector = hotSectors.some(h => sectors.some((sec: string) => sec.includes(h))) ||
      allText.match(/\b(artificial intelligence|machine learning|fintech|biotech|climate tech|cybersecurity)\b/);
    if (inHotSector) { hasHotSector++; signals++; flags.push('🔥Sector'); }

    // P2: Product exists (even early)
    const hasProduct = s.is_launched || s.has_demo || ed.is_launched ||
      allText.match(/\b(launched|live|mvp|beta|prototype|working product|shipped)\b/);
    if (hasProduct) { hasProductSignal++; signals++; flags.push('🚀Product'); }

    // P3: Any funding signal
    const hasFunding = s.latest_funding_amount || s.latest_funding_round || ed.funding_amount || ed.funding_stage ||
      allText.match(/\b(raised|funded|seed|series|pre-seed|angel|backed)\b/);
    if (hasFunding) { hasFundingSignal++; signals++; flags.push('💰Funded'); }

    // P4: Team quality
    const teamText = [
      JSON.stringify(s.team_signals || []),
      JSON.stringify(s.credential_signals || []),
      JSON.stringify(s.founders || []),
      JSON.stringify(ed.team || {}),
      JSON.stringify(ed.team_signals || []),
      JSON.stringify(ed.credential_signals || [])
    ].join(' ').toLowerCase();
    
    const hasTeam = ROCKSTAR_COMPANIES.some(c => teamText.includes(c)) ||
      ROCKSTAR_SCHOOLS.some(sc => teamText.includes(sc)) ||
      s.has_technical_cofounder ||
      teamText.match(/\b(serial founder|ex-founder|phd|mba)\b/);
    if (hasTeam) { hasTeamQuality++; signals++; flags.push('⭐Team'); }

    // P5: Clear value proposition (shows thinking maturity)
    const vpLength = (ed.value_proposition || '').length + (s.pitch || '').length;
    const hasClearStory = vpLength > 80 || (ed.problem && ed.problem.length > 30 && ed.solution && ed.solution.length > 30);
    if (hasClearStory) { hasClearVP++; signals++; flags.push('📝Story'); }
    
    // P6: Has website (minimum bar of seriousness)
    if (s.website) { hasWebsite++; }

    if (signals >= 2) {
      multiPromising++;
      candidates.push({ name: s.name, god: s.total_god_score, signals, flags });
    }
  }

  console.log(`  🔥 Hot Sector: ${hasHotSector} (${(hasHotSector/total*100).toFixed(1)}%)`);
  console.log(`  🚀 Product Signal: ${hasProductSignal} (${(hasProductSignal/total*100).toFixed(1)}%)`);
  console.log(`  💰 Funding Signal: ${hasFundingSignal} (${(hasFundingSignal/total*100).toFixed(1)}%)`);
  console.log(`  ⭐ Team Quality: ${hasTeamQuality} (${(hasTeamQuality/total*100).toFixed(1)}%)`);
  console.log(`  📝 Clear Story: ${hasClearVP} (${(hasClearVP/total*100).toFixed(1)}%)`);
  console.log(`  🌐 Has Website: ${hasWebsite} (${(hasWebsite/total*100).toFixed(1)}%)`);
  console.log(`\n  Multi-Promising (2+): ${multiPromising} (${(multiPromising/total*100).toFixed(1)}%)`);

  // Signal count distribution
  console.log('\n=== PROMISING SIGNAL COUNT DISTRIBUTION ===');
  for (let i = 5; i >= 0; i--) {
    const count = i >= 2 
      ? candidates.filter(c => c.signals === i).length
      : (i === 1 ? total - multiPromising - allFreshman.filter(s => {
          // count zero-signal startups
          const ed = s.extracted_data || {};
          const allText = [s.pitch || '', s.tagline || '', s.description || '', ed.value_proposition || '', s.name || ''].join(' ').toLowerCase();
          const sectors = (s.sectors || []).map((x: string) => x.toLowerCase());
          return !(hotSectors.some(h => sectors.some((sec: string) => sec.includes(h)))) &&
            !(s.is_launched || s.has_demo || ed.is_launched) &&
            !(s.latest_funding_amount || ed.funding_amount || ed.funding_stage);
        }).length : 0);
    if (i >= 2) {
      const c = candidates.filter(x => x.signals === i).length;
      if (c > 0) console.log(`  ${i} signals: ${c} (${(c/total*100).toFixed(1)}%)`);
    }
  }
  console.log(`  0-1 signals: ${total - multiPromising} (${((total-multiPromising)/total*100).toFixed(1)}%)`);

  // Top candidates
  console.log('\n=== TOP PROMISING FRESHMEN (3+ signals, top 20) ===');
  const top = candidates.filter(c => c.signals >= 3).sort((a, b) => b.signals - a.signals || b.god - a.god).slice(0, 20);
  for (const c of top) {
    console.log(`  ${c.name} | GOD: ${c.god} | Signals: ${c.signals} | ${c.flags.join(' ')}`);
  }

  // Impact simulation
  console.log('\n=== PROMISING BONUS IMPACT SIMULATION ===');
  console.log('Formula: promisingBonus = min(signalCount, 4) points');
  console.log('Only applied to Freshman with 2+ promising signals\n');
  
  let wouldPromoteToBachelor = 0;
  let wouldStay = 0;
  
  for (const c of candidates) {
    const bonus = Math.min(c.signals, 4);
    const newScore = c.god + bonus;
    if (newScore >= 45) wouldPromoteToBachelor++;
    else wouldStay++;
  }
  
  console.log(`  Would promote to Bachelor (45+): ${wouldPromoteToBachelor}`);
  console.log(`  Would stay Freshman (improved): ${wouldStay}`);
  console.log(`  Unaffected (0-1 signals): ${total - multiPromising}`);

  // Score distribution
  console.log('\n=== SCORE BREAKDOWN ===');
  for (let score = 44; score >= 40; score--) {
    const count = allFreshman.filter(s => s.total_god_score === score).length;
    const apCount = candidates.filter(c => c.god === score).length;
    console.log(`  GOD ${score}: ${count} total, ${apCount} promising (${count > 0 ? (apCount/count*100).toFixed(1) : 0}%)`);
  }
}

audit().catch(console.error);
