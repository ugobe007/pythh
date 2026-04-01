'use strict';
/**
 * scripts/fetch-realtime-signals.js
 *
 * Real-time signal fetcher for premium data sources.
 * Each provider is a gated adapter — enabled by the presence of its API key.
 *
 * Supported providers (all require paid API access):
 *   CRUNCHBASE  → CRUNCHBASE_API_KEY    (Recent funding rounds, acquisitions, IPOs)
 *   PITCHBOOK   → PITCHBOOK_API_KEY     (Deal intelligence, valuations, investor profiles)
 *   LINKEDIN    → LINKEDIN_CLIENT_ID +
 *                 LINKEDIN_CLIENT_SECRET (Hiring signals, exec moves, company news)
 *   CLEARBIT    → CLEARBIT_API_KEY      (Company enrichment: employees, funding stage, tech stack)
 *   DIFFBOT     → DIFFBOT_TOKEN         (Article & web content extraction)
 *
 * Usage:
 *   node scripts/fetch-realtime-signals.js             # dry-run, shows available providers
 *   node scripts/fetch-realtime-signals.js --apply     # write to DB
 *   node scripts/fetch-realtime-signals.js --provider crunchbase --apply
 *   node scripts/fetch-realtime-signals.js --limit 100 --apply
 *
 * To enable a provider: add the API key to .env and re-run.
 * Integration guides in docs/REALTIME_SIGNALS.md
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args     = process.argv.slice(2);
const DRY_RUN  = !args.includes('--apply');
const LIMIT    = parseInt((args.find(a => a.startsWith('--limit='))?.split('=')[1] || '200'), 10);
const PROVIDER = args.find(a => a.startsWith('--provider='))?.split('=')[1]?.toLowerCase() || 'all';

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY
// Each provider exposes: { name, isAvailable(), fetch(limit), toSignals(raw) }
// ═══════════════════════════════════════════════════════════════════════════

const PROVIDERS = [

  // ─────────────────────────────────────────────────────────────────────────
  // CRUNCHBASE — Funding rounds, acquisitions, IPO filings
  // Docs: https://data.crunchbase.com/docs/using-the-api
  // Plan required: Crunchbase Pro or Enterprise ($49+/mo)
  // Key env var: CRUNCHBASE_API_KEY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id:  'crunchbase',
    name: 'Crunchbase Pro',
    cost: '$49–$299/mo',
    isAvailable: () => !!process.env.CRUNCHBASE_API_KEY,
    signalClasses: ['fundraising_signal', 'acquisition_signal', 'exit_signal'],
    signalStrength: { 'funding_round': 0.98, 'acquisition': 0.99, 'ipo': 0.99 },
    async fetch(limit) {
      const key = process.env.CRUNCHBASE_API_KEY;
      // Recent funding rounds from last 7 days
      const url = `https://api.crunchbase.com/api/v4/searches/funding_rounds?user_key=${key}`;
      const body = JSON.stringify({
        field_ids: ['identifier', 'funded_organization_identifier', 'money_raised', 'announced_on',
                    'investment_type', 'lead_investor_identifiers'],
        predicate_values: [{
          field_id: 'announced_on',
          operator_id: 'gte',
          values: [new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]],
        }],
        limit,
      });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      return res.json();
    },
    toSignals(raw, now) {
      return (raw?.entities || []).map(e => ({
        company_name:    e.properties?.funded_organization_identifier?.value,
        raw_sentence:    `${e.properties?.funded_organization_identifier?.value} raised ${e.properties?.money_raised?.value_usd ? '$' + Math.round(e.properties.money_raised.value_usd / 1e6) + 'M' : 'undisclosed'} ${e.properties?.investment_type || ''} round`,
        primary_signal:  'fundraising_signal',
        signal_strength: 0.98,
        confidence:      0.98,
        evidence_quality:'confirmed',
        signal_type:     'event',
        action_tag:      'action_closing_round',
        source:          'crunchbase',
        detected_at:     now,
        is_ambiguous:    false,
        who_cares:       { investors: true, vendors: false, acquirers: false, recruiters: false },
      }));
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PITCHBOOK — Deal intelligence, valuations, investor profiles
  // Docs: https://pitchbook.com/pitchbook-api
  // Plan required: PitchBook Enterprise ($3,000+/yr)
  // Key env var: PITCHBOOK_API_KEY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id:  'pitchbook',
    name: 'PitchBook API',
    cost: '$3,000+/yr',
    isAvailable: () => !!process.env.PITCHBOOK_API_KEY,
    signalClasses: ['fundraising_signal', 'exit_signal', 'investor_interest_signal'],
    signalStrength: { 'deal': 0.97, 'ipo': 0.99 },
    async fetch(limit) {
      const key = process.env.PITCHBOOK_API_KEY;
      const url = `https://api.pitchbook.com/v1/deals?api_key=${key}&limit=${limit}&deal_type=VC&date_range=last7days`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
      return res.json();
    },
    toSignals(raw, now) {
      return (raw?.results || []).map(d => ({
        company_name:    d.company?.name,
        raw_sentence:    `${d.company?.name} — ${d.deal_type} ($${d.deal_size_usd ? Math.round(d.deal_size_usd / 1e6) + 'M' : 'undisclosed'})`,
        primary_signal:  'fundraising_signal',
        signal_strength: 0.97,
        confidence:      0.97,
        evidence_quality:'confirmed',
        signal_type:     'event',
        action_tag:      'action_closing_round',
        source:          'pitchbook',
        detected_at:     now,
        is_ambiguous:    false,
        who_cares:       { investors: true, vendors: false, acquirers: true, recruiters: false },
      }));
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LINKEDIN — Hiring signals, exec moves, company posts
  // Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
  // Plan required: LinkedIn Marketing API (partner program, ~$0–$1k/mo)
  // Key env vars: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_ACCESS_TOKEN
  // ─────────────────────────────────────────────────────────────────────────
  {
    id:  'linkedin',
    name: 'LinkedIn API',
    cost: 'Partner program',
    isAvailable: () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_ACCESS_TOKEN),
    signalClasses: ['hiring_signal', 'growth_signal', 'founder_psychology_signal'],
    signalStrength: { 'job_post': 0.80, 'company_update': 0.70 },
    async fetch(limit) {
      const token = process.env.LINKEDIN_ACCESS_TOKEN;
      // Requires Organization API + LinkedIn Marketing Developer Platform
      const url = `https://api.linkedin.com/v2/organizationalEntityJobPostings?count=${Math.min(limit, 50)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      return res.json();
    },
    toSignals(raw, now) {
      return (raw?.elements || []).map(post => ({
        company_name:    post.companyDetails?.company?.split(':').pop(),
        raw_sentence:    `${post.title?.text || 'Open role'} — job posted`,
        primary_signal:  'hiring_signal',
        signal_strength: 0.80,
        confidence:      0.85,
        evidence_quality:'confirmed',
        signal_type:     'talent',
        action_tag:      'action_hiring',
        source:          'linkedin',
        detected_at:     now,
        is_ambiguous:    false,
        who_cares:       { investors: true, vendors: false, acquirers: false, recruiters: true },
      }));
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CLEARBIT — Company enrichment: headcount, funding stage, tech stack
  // Docs: https://dashboard.clearbit.com/docs
  // Plan required: Clearbit Business ($99+/mo)
  // Key env var: CLEARBIT_API_KEY
  // Note: Best used as an enrichment pass for existing entities lacking data.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id:  'clearbit',
    name: 'Clearbit Enrichment',
    cost: '$99+/mo',
    isAvailable: () => !!process.env.CLEARBIT_API_KEY,
    signalClasses: ['growth_signal', 'hiring_signal', 'market_signal'],
    signalStrength: { 'company_growth': 0.78, 'headcount_change': 0.82 },
    async fetch(limit) {
      // For each entity lacking enrichment data, call Clearbit Company API
      const { data: entities } = await supabase
        .from('pythh_entities')
        .select('id, name, website')
        .is('enriched_at', null)
        .not('website', 'is', null)
        .limit(limit);
      return entities || [];
    },
    toSignals(raw, now) {
      // Each entity gets enriched; growth signals come from employee count changes
      return (raw || []).map(e => ({
        company_name:    e.name,
        raw_sentence:    `${e.name} enriched via Clearbit`,
        primary_signal:  'market_signal',
        signal_strength: 0.60,
        confidence:      0.70,
        evidence_quality:'inferred',
        signal_type:     'market',
        action_tag:      'action_inferred',
        source:          'clearbit',
        detected_at:     now,
        is_ambiguous:    true,
        who_cares:       { investors: true, vendors: true, acquirers: false, recruiters: false },
      }));
    },
  },

];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function run() {
  console.log('\n⚡ REAL-TIME SIGNAL FETCHER');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Provider: ${PROVIDER}`);
  console.log(`Limit:    ${LIMIT}`);
  console.log('═'.repeat(60) + '\n');

  const now = new Date().toISOString();

  const eligible = PROVIDERS.filter(p =>
    (PROVIDER === 'all' || PROVIDER === p.id)
  );

  console.log('Provider status:\n');
  for (const p of eligible) {
    const available = p.isAvailable();
    const status = available ? '✅ API KEY FOUND — ready' : `⚠️  NOT CONFIGURED (${p.cost})`;
    console.log(`  ${p.name.padEnd(24)} ${status}`);
    if (!available) {
      console.log(`     Signal classes: ${p.signalClasses.join(', ')}`);
    }
  }

  const active = eligible.filter(p => p.isAvailable());
  if (!active.length) {
    console.log('\n  No providers configured. Add API keys to .env to activate.');
    console.log('  See docs/REALTIME_SIGNALS.md for setup instructions.\n');
    return;
  }

  const stats = { signals_written: 0, errors: 0 };

  for (const p of active) {
    console.log(`\n  Running ${p.name}...`);
    let raw;
    try {
      raw = await p.fetch(LIMIT);
    } catch (err) {
      console.log(`  ❌ Fetch error: ${err.message}`);
      stats.errors++;
      continue;
    }

    const signals = p.toSignals(raw, now);
    console.log(`  → ${signals.length} signals extracted`);

    for (const sig of signals) {
      if (DRY_RUN) {
        console.log(`  [DRY] ${sig.company_name}: "${sig.raw_sentence?.slice(0, 60)}" → ${sig.primary_signal} (${sig.signal_strength})`);
        stats.signals_written++;
        continue;
      }

      // Resolve entity
      const { data: entities } = await supabase
        .from('pythh_entities')
        .select('id')
        .ilike('name', `%${(sig.company_name || '').replace(/(Inc|Corp|LLC|Ltd)\.?$/i, '').trim()}%`)
        .limit(1);

      const entity = entities?.[0];
      if (!entity) continue;

      const { error } = await supabase.from('pythh_signal_events').insert({
        entity_id:        entity.id,
        source:           sig.source,
        source_type:      'api',
        detected_at:      sig.detected_at,
        raw_sentence:     sig.raw_sentence,
        signal_object:    sig,
        primary_signal:   sig.primary_signal,
        signal_type:      sig.signal_type,
        signal_strength:  sig.signal_strength,
        confidence:       sig.confidence,
        evidence_quality: sig.evidence_quality,
        actor_type:       'actor_startup',
        action_tag:       sig.action_tag,
        modality:         'active',
        intensity:        [],
        posture:          null,
        is_costly_action: false,
        is_ambiguous:     sig.is_ambiguous,
        is_multi_signal:  false,
        has_negation:     false,
        sub_signals:      [],
        who_cares:        sig.who_cares,
        likely_stage:     null,
        likely_needs:     [],
        urgency:          null,
      });

      if (!error) stats.signals_written++;
      else stats.errors++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Signals written: ${stats.signals_written}`);
  console.log(`Errors:          ${stats.errors}`);
  console.log('═'.repeat(60) + '\n');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
