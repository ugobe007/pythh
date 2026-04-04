#!/usr/bin/env node
/**
 * Reject startup_uploads that are still pending/review but fail name quality checks
 * (same rules as scripts/cleanup-garbage.js — patterns + lib/startupNameValidator),
 * PLUS article-title / RSS headline heuristics (aligned with cleanup-junk-entries.js).
 *
 * Usage:
 *   node scripts/cleanup-pending-junk-names.js                    # dry run
 *   node scripts/cleanup-pending-junk-names.js --execute          # apply default rules
 *   node scripts/cleanup-pending-junk-names.js --aggressive       # dry run: + long titles / RSS noise
 *   node scripts/cleanup-pending-junk-names.js --aggressive --execute
 *   node scripts/cleanup-pending-junk-names.js --ontology          # + lib/pendingNameOntology (parseSignal)
 *   node scripts/cleanup-pending-junk-names.js --ontology --execute
 *
 * After the first pass, default mode often finds 0 rows — use --aggressive for a second sweep.
 * Use --ontology for parseSignal-based checks: rumor/exploratory grammar, multi-signal headlines,
 * non-unclassified event signals (M&A, launch, distress, …), guarded hiring/fundraising headlines.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbage } = require('./cleanup-garbage');
const { ontologyJunkReason } = require('../lib/pendingNameOntology');

// ── Headline / scraper fragments (pending queue only — RSS entity extraction noise) ──
const ARTICLE_VERB_PATTERNS = [
  /\b(has|have)\s+(raised|secured|closed|launched|is|announced|partnered|acquired|expanded|won|received)/i,
  /\b(raises?|raised)\s+(\$|€|£|[0-9])/i,
  /\b(secures?|secured)\s+(\$|€|£|[0-9])/i,
  /\b(closes?|closed)\s+(funding|round|deal|series|a|b|c)\b/i,
  /\b(announces?|announced)\s+(new|launch|partnership|funding|raise|close)/i,
  /\b(acquires?|acquired)\s+\w/i,
];

const TEST_PATTERNS = [
  /^test[-_]?\d{4,}/i,
  /^cleantest/i,
  /^quicktest/i,
  /^testmatch/i,
  /^newstartup$/i,
];

const GENERIC_PATTERNS = [
  /^post\s+\w+$/i,
  /^in\s+round\s*/i,
  /^receives?\s/i,
  /^\d+\s+million/i,
];

/** Truncated headline: "Amazon Is", "Google And", "Exactly When Apple Will" */
const HEADLINE_TAIL = /\b(is|has|and|will|says|said)\s*$/i;
const HEADLINE_START = /^(exactly\s+when|that\s+it|capital\s+firms\s+are)/i;

function isArticleTitleJunk(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (t.length < 3) return true;
  for (const p of ARTICLE_VERB_PATTERNS) {
    if (p.test(t)) return true;
  }
  for (const p of TEST_PATTERNS) {
    if (p.test(t)) return true;
  }
  for (const p of GENERIC_PATTERNS) {
    if (p.test(t)) return true;
  }
  if (HEADLINE_START.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 6 && HEADLINE_TAIL.test(t)) return true;
  return false;
}

/**
 * Stricter heuristics for pending only — catches headline-like strings that still pass isValidStartupName.
 * Use with --aggressive (review dry-run output before --execute).
 */
const HEADLINE_SUBSTRINGS = [
  /\b(in talks to|in talks with)\b/i,
  /\bceo\s+praises\b/i,
  /\bapple\s+ceo\b/i,
  /\breveals?\s+ps\d/i,
  /\bopenai\s+plans\b/i,
  /\blook\s+for\s+when\s+you\b/i,
  /\bupload\s+your\b/i,
  /\bbut\s+is\s+it\b/i,
  /\boscar\s+nominee\b/i,
  /\bhigher\s+rotten\s+tomatoes\b/i,
  /\bout\s+after\s+whoop\b/i,
  /\bquiz\s+that\b/i,
  /\bdrone\s+delivery\s+startup\b/i, // descriptor pile-on
  /\bpartners\s+linux\s+foundation\b/i, // odd RSS subject
  /\bcopilot\s+for\s+gaming\b/i,
];

/** Truncated RSS headline: ends on a function word ("… Electric To", "… When You") */
function isBadEndingFragment(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 8) return false;
  const last = words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/gi, '');
  const badLast = new Set(['to', 'you', 'that', 'when', 'your', 'for', 'it', 'the', 'a', 'an', 'is']);
  if (badLast.has(last)) return true;
  return false;
}

function isAggressivePendingJunk(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  const words = t.split(/\s+/).filter(Boolean);

  for (const re of HEADLINE_SUBSTRINGS) {
    if (re.test(t)) return true;
  }

  if (isBadEndingFragment(name)) return true;

  // Very long — almost always a scraped headline, not a trading name
  if (words.length >= 10) return true;
  if (t.length >= 72) return true;

  // Title punctuation / blog patterns
  if (/\s\|\s/.test(t)) return true;
  if (/\s[–—]\s/.test(t) && words.length >= 5) return true;
  if (/\?/.test(t)) return true;

  // Question-style / explainer headlines
  if (/^(why|how|what|when|where|which)\s+/i.test(t) && words.length >= 5) return true;

  // Wire / blog attribution
  if (/\baccording to\b/i.test(t)) return true;
  if (/\b(sources?|reportedly)\s*:/i.test(t)) return true;
  if (/\b(read more|full story|editor'?s note)\b/i.test(t)) return true;

  // Funding sentence fragments (broader than isArticleTitleJunk)
  if (/\b(valued at|now worth|market cap of)\b/i.test(t)) return true;
  if (/\b(ipo|spac)\s+(in|at|for)\b/i.test(t) && words.length >= 6) return true;

  // Government / regulator mistaken as startup (short phrases)
  if (/^(the fbi|the eu|nsw health|arizona ag)$/i.test(t)) return true;

  return false;
}

function junkReason(name, aggressive, ontology) {
  if (isGarbage(name)) return 'validator/garbage';
  if (isArticleTitleJunk(name)) return 'headline/article-title';
  if (aggressive && isAggressivePendingJunk(name)) return 'aggressive/headline-like';
  if (ontology) {
    const o = ontologyJunkReason(name);
    if (o) return o;
  }
  return null;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const EXECUTE = process.argv.includes('--execute');
const AGGRESSIVE = process.argv.includes('--aggressive');
const ONTOLOGY = process.argv.includes('--ontology');
const NOTE_PREFIX = 'auto-rejected: junk/invalid startup name (cleanup-pending-junk-names.js)';

const PENDING_STATUSES = ['pending', 'reviewing'];

async function main() {
  console.log('\n🧹 PENDING QUEUE — JUNK NAME CLEANUP');
  console.log('═'.repeat(60));
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (will reject rows)' : 'DRY RUN'}`);
  console.log(`Aggressive: ${AGGRESSIVE ? 'ON (extra headline-like rules)' : 'OFF'}`);
  console.log(`Ontology: ${ONTOLOGY ? 'ON (parseSignal: rumor, events, fundraising/hiring guards)' : 'OFF'}`);
  console.log(`Statuses: ${PENDING_STATUSES.join(', ')}\n`);

  let all = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, status, created_at')
      .in('status', PENDING_STATUSES)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    page++;
  }

  console.log(`Rows in pending/reviewing: ${all.length}`);

  const junk = all
    .map((s) => ({ ...s, _reason: junkReason(s.name, AGGRESSIVE, ONTOLOGY) }))
    .filter((s) => s._reason);
  junk.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const byReason = {};
  for (const s of junk) {
    byReason[s._reason] = (byReason[s._reason] || 0) + 1;
  }
  console.log(`Junk names flagged: ${junk.length}`);
  console.log('By rule:', JSON.stringify(byReason, null, 0));
  console.log('');

  junk.slice(0, 200).forEach((s) => {
    console.log(`  [${s._reason}] [${s.status}] ${(s.name || '(empty)').slice(0, 64)}`);
  });
  if (junk.length > 200) {
    console.log(`  ... and ${junk.length - 200} more`);
  }

  if (!EXECUTE) {
    console.log('\n💡 Run with --execute to reject these rows (status=rejected + admin_notes).');
    if (!AGGRESSIVE && !ONTOLOGY && junk.length === 0) {
      console.log('   (No matches — try: --aggressive and/or --ontology)');
    }
    if (AGGRESSIVE && junk.length > 0) {
      console.log('   Review the list above, then: same command with --execute');
    }
    console.log('═'.repeat(60));
    return;
  }

  if (junk.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const now = new Date().toISOString();
  const CHUNK = 50;
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < junk.length; i += CHUNK) {
    const batch = junk.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from('startup_uploads')
          .update({
            status: 'rejected',
            admin_notes: `${NOTE_PREFIX} (${row._reason})`,
            reviewed_at: now,
          })
          .eq('id', row.id)
          .in('status', PENDING_STATUSES)
      )
    );
    for (const r of results) {
      if (r.error) {
        console.error('Update failed:', r.error.message);
        fail++;
      } else {
        ok++;
      }
    }
    process.stdout.write(`  updated ${Math.min(i + CHUNK, junk.length)}/${junk.length}\r`);
  }
  console.log(`\n\n✅ Rejected: ${ok} rows${fail ? `, errors: ${fail}` : ''}`);
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
