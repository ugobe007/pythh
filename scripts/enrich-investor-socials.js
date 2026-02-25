#!/usr/bin/env node
/**
 * INVESTOR SOCIAL HANDLE ENRICHMENT
 * =============================================================================
 * Populates twitter_handle, twitter_url, linkedin_url, crunchbase_url for
 * investors that are missing social data.
 *
 * Strategy (in order):
 *  1. Curated lookup table — instant, zero API cost for ~80 top VCs
 *  2. AI inference via GPT-4o-mini — for investors not in the lookup table,
 *     ask the model to infer the most likely Twitter handle / LinkedIn slug
 *  3. Crunchbase URL construction — built from firm slug (no API needed)
 *
 * Run:
 *   node scripts/enrich-investor-socials.js              # top 100 missing
 *   node scripts/enrich-investor-socials.js --limit=500  # larger batch
 *   node scripts/enrich-investor-socials.js --dry-run    # preview only
 *   node scripts/enrich-investor-socials.js --curated-only  # curated table only
 * =============================================================================
 */

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const args = process.argv.slice(2);
const LIMIT        = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');
const DRY_RUN      = args.includes('--dry-run');
const CURATED_ONLY = args.includes('--curated-only');

// ─── Curated top-VC handle lookup ─────────────────────────────────────────────
// Key = lowercased name fragment that should match `investors.name` or `investors.firm`
// Values: twitter_handle (bare, no @), linkedin slug, crunchbase slug
const CURATED = [
  // Tier-1 US VCs
  { match: 'sequoia',           twitter: 'sequoia',          linkedin: 'sequoia-capital',       crunchbase: 'sequoia-capital' },
  { match: 'andreessen horowitz', twitter: 'a16z',           linkedin: 'andreessen-horowitz',   crunchbase: 'andreessen-horowitz' },
  { match: 'a16z',              twitter: 'a16z',             linkedin: 'andreessen-horowitz',   crunchbase: 'andreessen-horowitz' },
  { match: 'benchmark',         twitter: 'benchmark',        linkedin: 'benchmark-capital',     crunchbase: 'benchmark' },
  { match: 'accel',             twitter: 'accelhq',          linkedin: 'accel-partners',        crunchbase: 'accel-partners' },
  { match: 'kleiner perkins',   twitter: 'kpcb',             linkedin: 'kleiner-perkins',       crunchbase: 'kleiner-perkins-caufield-byers' },
  { match: 'greylock',          twitter: 'greylockvc',       linkedin: 'greylock-partners',     crunchbase: 'greylock-partners' },
  { match: 'lightspeed',        twitter: 'lightspeedvp',     linkedin: 'lightspeed-venture-partners', crunchbase: 'lightspeed-venture-partners' },
  { match: 'general catalyst',  twitter: 'gcatalyst',        linkedin: 'general-catalyst',      crunchbase: 'general-catalyst' },
  { match: 'founders fund',     twitter: 'foundersfund',     linkedin: 'founders-fund',         crunchbase: 'founders-fund' },
  { match: 'tiger global',      twitter: 'tigerglobal',      linkedin: 'tiger-global-management', crunchbase: 'tiger-global-management' },
  { match: 'softbank',          twitter: 'softbank',         linkedin: 'softbank',              crunchbase: 'softbank-group' },
  { match: 'insight partners',  twitter: 'insightpartners',  linkedin: 'insight-partners',      crunchbase: 'insight-venture-partners' },
  { match: 'bessemer',          twitter: 'bvp',              linkedin: 'bessemer-venture-partners', crunchbase: 'bessemer-venture-partners' },
  { match: 'new enterprise associates', twitter: 'nea',      linkedin: 'new-enterprise-associates', crunchbase: 'new-enterprise-associates' },
  { match: 'nea ',              twitter: 'nea',              linkedin: 'new-enterprise-associates', crunchbase: 'new-enterprise-associates' },
  { match: 'battery ventures',  twitter: 'batteryventures',  linkedin: 'battery-ventures',      crunchbase: 'battery-ventures' },
  { match: 'index ventures',    twitter: 'indexventures',    linkedin: 'index-ventures',        crunchbase: 'index-ventures' },
  { match: 'union square',      twitter: 'usv',              linkedin: 'union-square-ventures', crunchbase: 'union-square-ventures' },
  { match: 'first round',       twitter: 'firstround',       linkedin: 'first-round-capital',   crunchbase: 'first-round-capital' },
  { match: 'spark capital',     twitter: 'sparkcapital',     linkedin: 'spark-capital',         crunchbase: 'spark-capital' },
  { match: 'flatiron',          twitter: 'flatiron',         linkedin: 'flatiron-health',       crunchbase: 'flatiron-health' },
  { match: 'felicis',           twitter: 'felicisventures',  linkedin: 'felicis-ventures',      crunchbase: 'felicis-ventures' },
  { match: 'initialized',       twitter: 'garrytan',         linkedin: 'initialized-capital',   crunchbase: 'initialized-capital' },
  { match: 'coatue',            twitter: 'coatue',           linkedin: 'coatue-management',     crunchbase: 'coatue-management' },
  { match: 'dst global',        twitter: 'dstglobal',        linkedin: 'dst-global',            crunchbase: 'dst-global' },
  { match: 'social capital',    twitter: 'chamath',          linkedin: 'social-capital',        crunchbase: 'social-capital' },
  { match: 'y combinator',      twitter: 'ycombinator',      linkedin: 'y-combinator',          crunchbase: 'y-combinator' },
  { match: 'techstars',         twitter: 'techstars',        linkedin: 'techstars',             crunchbase: 'techstars' },
  { match: '500 startups',      twitter: '500startups',      linkedin: '500startups',           crunchbase: '500-startups' },
  { match: 'plug and play',     twitter: 'pnptc',            linkedin: 'plug-and-play',         crunchbase: 'plug-and-play' },
  { match: 'andreessen',        twitter: 'a16z',             linkedin: 'andreessen-horowitz',   crunchbase: 'andreessen-horowitz' },
  { match: 'lux capital',       twitter: 'luxcapital',       linkedin: 'lux-capital',           crunchbase: 'lux-capital' },
  { match: 'ribbit capital',    twitter: 'ribbitcap',        linkedin: 'ribbit-capital',        crunchbase: 'ribbit-capital' },
  { match: 'greenoaks',         twitter: 'greenoakscap',     linkedin: 'greenoaks-capital-partners', crunchbase: 'greenoaks-capital' },
  { match: 'iconiq',            twitter: 'iconiqcapital',    linkedin: 'iconiq-capital',        crunchbase: 'iconiq-capital' },
  { match: 'ivu',               twitter: 'iVU_VC',           linkedin: null,                    crunchbase: null },
  { match: 'khosla',            twitter: 'khoslaventures',   linkedin: 'khosla-ventures',       crunchbase: 'khosla-ventures' },
  { match: 'draper',            twitter: 'timdrapervc',      linkedin: 'draper-associates',     crunchbase: 'draper-associates' },
  { match: 'dcm ventures',       twitter: 'dcm_vc',          linkedin: 'dcm-ventures',          crunchbase: 'dcm-ventures' },
  { match: 'redpoint',          twitter: 'redpointvc',       linkedin: 'redpoint-ventures',     crunchbase: 'redpoint-ventures' },
  { match: 'matrix partners',   twitter: 'matrixpartners',   linkedin: 'matrix-partners',       crunchbase: 'matrix-partners' },
  { match: 'meritech',          twitter: 'meritechcap',      linkedin: 'meritech-capital-partners', crunchbase: 'meritech-capital' },
  { match: 'lowercase capital', twitter: 'lowercase',        linkedin: 'lowercase-capital',     crunchbase: 'lowercase-capital' },
  { match: 'canvas ventures',   twitter: 'canvasventures',   linkedin: 'canvas-ventures',       crunchbase: 'canvas-ventures' },
  { match: 'amplify partners',  twitter: 'amplifylp',        linkedin: 'amplify-partners',      crunchbase: 'amplify-partners' },
  { match: 'emergence capital', twitter: 'emergencecap',     linkedin: 'emergence-capital-partners', crunchbase: 'emergence-capital' },
  { match: 'storm ventures',    twitter: 'stormventures',    linkedin: 'storm-ventures',        crunchbase: 'storm-ventures' },
  { match: 'boldstart',         twitter: 'boldstartvc',      linkedin: 'boldstart-ventures',    crunchbase: 'boldstart-ventures' },
  { match: 'unusual ventures',  twitter: 'unusualvc',        linkedin: 'unusual-ventures',      crunchbase: 'unusual-ventures' },
  { match: 'collaborative fund', twitter: 'collabfund',      linkedin: 'collaborative-fund',    crunchbase: 'collaborative-fund' },
  { match: 'obvious ventures',  twitter: 'obviousvc',        linkedin: 'obvious-ventures',      crunchbase: 'obvious-ventures' },
  { match: 'e.ventures',        twitter: 'eventures_vc',     linkedin: 'e-ventures',            crunchbase: 'e-ventures' },
  { match: 'signal fire',       twitter: 'signalfire',       linkedin: 'signalfire',            crunchbase: 'signalfire' },
  { match: 'neo',               twitter: 'neoadvisor',       linkedin: 'neo-c',                 crunchbase: 'neo-1' },
  { match: 'cherry ventures',   twitter: 'cherryventures',   linkedin: 'cherry-ventures',       crunchbase: 'cherry-ventures' },
  { match: 'point nine',        twitter: 'pointninecap',     linkedin: 'point-nine-capital',    crunchbase: 'point-nine-capital' },
  { match: 'earlybird',         twitter: 'earlybirdfund',    linkedin: 'earlybird-venture-capital', crunchbase: 'earlybird' },
  { match: 'hummingbird',       twitter: 'hbventures',       linkedin: 'hummingbird-ventures',  crunchbase: 'hummingbird-ventures' },
  { match: 'balderton',         twitter: 'balderton',        linkedin: 'balderton-capital',     crunchbase: 'balderton-capital' },
  { match: 'atomico',           twitter: 'atomico',          linkedin: 'atomico',               crunchbase: 'atomico' },
  { match: 'lakestar',          twitter: 'lakestar',         linkedin: 'lakestar',              crunchbase: 'lakestar' },
  { match: 'northzone',         twitter: 'northzone',        linkedin: 'northzone',             crunchbase: 'northzone' },
  { match: 'partech',           twitter: 'partechvc',        linkedin: 'partech-ventures',      crunchbase: 'partech-ventures' },
  { match: 'creandum',          twitter: 'creandum',         linkedin: 'creandum',              crunchbase: 'creandum' },
  { match: 'hv capital',        twitter: 'hvcapital',        linkedin: 'hv-capital',            crunchbase: 'hv-holtzbrinck-ventures' },
  { match: 'idinvest',          twitter: 'eurazeo_sb',       linkedin: 'idinvest-partners',     crunchbase: 'idinvest-partners' },
  { match: 'tiger venture',     twitter: 'tigerglobal',      linkedin: 'tiger-global-management', crunchbase: 'tiger-global-management' },
  { match: 'angellist',         twitter: 'angellist',        linkedin: 'angellist',             crunchbase: 'angellist' },
  { match: 'sequoia capital india', twitter: 'surjit_s',     linkedin: 'sequoia-capital-india', crunchbase: 'sequoia-capital-india' },
  { match: 'peak xv',          twitter: 'peakxvpartners',    linkedin: 'peak-xv-partners',      crunchbase: 'sequoia-capital-india' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCrunchbaseUrl(slug) {
  return slug ? `https://www.crunchbase.com/organization/${slug}` : null;
}

function buildLinkedinUrl(slug) {
  return slug ? `https://www.linkedin.com/company/${slug}` : null;
}

function buildTwitterUrl(handle) {
  return handle ? `https://twitter.com/${handle}` : null;
}

function lookupCurated(name, firm) {
  const haystack = `${(name || '').toLowerCase()} ${(firm || '').toLowerCase()}`;
  for (const entry of CURATED) {
    if (haystack.includes(entry.match)) {
      return {
        twitter_handle: entry.twitter || null,
        twitter_url:    entry.twitter ? buildTwitterUrl(entry.twitter) : null,
        linkedin_url:   entry.linkedin ? buildLinkedinUrl(entry.linkedin) : null,
        crunchbase_url: entry.crunchbase ? buildCrunchbaseUrl(entry.crunchbase) : null,
      };
    }
  }
  return null;
}

// ─── AI inference for unknown VCs ─────────────────────────────────────────────
async function inferHandlesWithAI(batch) {
  if (!openai) {
    console.warn('[socials] OpenAI not configured — skipping AI inference step');
    return {};
  }

  const firmList = batch.map((inv, i) => `${i + 1}. "${inv.firm || inv.name}" (person: "${inv.name}")`).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a venture capital database expert. Given a list of VC firms or individual investors, return their known social media handles as a JSON object.
Return ONLY the JSON — no explanation.
Format:
{
  "results": [
    {
      "index": 1,
      "twitter_handle": "handleWithoutAt or null",
      "linkedin_slug": "company-slug or null",
      "crunchbase_slug": "org-slug or null",
      "confidence": "high|medium|low"
    }
  ]
}
Only include handles you are confident exist. Use null for unknown. Do NOT invent handles.`,
      },
      {
        role: 'user',
        content: `Find Twitter/X handles, LinkedIn company slugs, and Crunchbase organization slugs for these investors:\n\n${firmList}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content);
    const map = {};
    for (const r of parsed.results || []) {
      const inv = batch[r.index - 1];
      if (!inv) continue;
      if (r.confidence === 'low') continue; // skip uncertain guesses
      map[inv.id] = {
        twitter_handle: r.twitter_handle || null,
        twitter_url:    r.twitter_handle ? buildTwitterUrl(r.twitter_handle) : null,
        linkedin_url:   r.linkedin_slug ? buildLinkedinUrl(r.linkedin_slug) : null,
        crunchbase_url: r.crunchbase_slug ? buildCrunchbaseUrl(r.crunchbase_slug) : null,
      };
    }
    return map;
  } catch (e) {
    console.error('[socials] AI parse error:', e.message);
    return {};
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔗 INVESTOR SOCIAL HANDLE ENRICHMENT');
  console.log('=====================================');
  if (DRY_RUN)      console.log('DRY RUN — no database writes');
  if (CURATED_ONLY) console.log('CURATED ONLY — skipping AI inference');
  console.log(`Batch limit: ${LIMIT}\n`);

  // Load investors missing social data
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, twitter_handle, twitter_url, linkedin_url, crunchbase_url, socials_updated_at')
    .or('twitter_handle.is.null,linkedin_url.is.null')
    .is('socials_updated_at', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!investors?.length) { console.log('✅ All investors already have social data.'); return; }

  console.log(`Found ${investors.length} investors missing social handles\n`);

  let curatedHits = 0;
  let aiHits = 0;
  let updated = 0;

  // ── Step 1: Apply curated lookup ──
  const needsAI = [];
  const curatedPatches = {};

  for (const inv of investors) {
    const hit = lookupCurated(inv.name, inv.firm);
    if (hit) {
      curatedPatches[inv.id] = hit;
      curatedHits++;
    } else {
      needsAI.push(inv);
    }
  }
  console.log(`📚 Curated lookup: ${curatedHits} matches`);

  // ── Step 2: AI inference for unknowns ──
  let aiPatches = {};
  if (!CURATED_ONLY && needsAI.length > 0 && openai) {
    console.log(`🤖 AI inference for ${needsAI.length} unknown investors...`);
    const BATCH_SIZE = 25;
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      const batch = needsAI.slice(i, i + BATCH_SIZE);
      process.stdout.write(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needsAI.length / BATCH_SIZE)}... `);
      try {
        const batchResult = await inferHandlesWithAI(batch);
        Object.assign(aiPatches, batchResult);
        const hits = Object.keys(batchResult).length;
        aiHits += hits;
        console.log(`${hits}/${batch.length} matched`);
      } catch (e) {
        console.log(`⚠️ ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1000)); // rate limit
    }
  }

  // ── Step 3: Merge + apply patches ──
  const allPatches = { ...curatedPatches, ...aiPatches };

  for (const inv of investors) {
    const patch = allPatches[inv.id];
    if (!patch) continue;

    // Only update fields that are currently null/empty
    const update = {};
    if (patch.twitter_handle && !inv.twitter_handle) update.twitter_handle = patch.twitter_handle;
    if (patch.twitter_url    && !inv.twitter_url)    update.twitter_url    = patch.twitter_url;
    if (patch.linkedin_url   && !inv.linkedin_url)   update.linkedin_url   = patch.linkedin_url;
    if (patch.crunchbase_url && !inv.crunchbase_url) update.crunchbase_url = patch.crunchbase_url;

    if (Object.keys(update).length === 0) continue;
    update.socials_updated_at = new Date().toISOString();

    const source = curatedPatches[inv.id] ? '📚' : '🤖';
    console.log(`${source} ${inv.name} (${inv.firm || ''}) → ${Object.entries(update).filter(([k]) => k !== 'socials_updated_at').map(([k, v]) => `${k}=${v}`).join(', ')}`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('investors')
        .update(update)
        .eq('id', inv.id);
      if (updateError) console.error(`  ❌ ${updateError.message}`);
      else updated++;
    } else {
      updated++; // count as if updated for dry run reporting
    }
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`   Curated matches: ${curatedHits}`);
  console.log(`   AI matches:      ${aiHits}`);
  console.log(`   Updated in DB:   ${DRY_RUN ? 0 : updated} (${DRY_RUN ? 'DRY RUN' : 'live'})`);
  console.log(`   No match found:  ${investors.length - Object.keys(allPatches).length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
