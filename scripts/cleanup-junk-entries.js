#!/usr/bin/env node
/**
 * CLEANUP: Reject startup entries that are clearly news article titles,
 * test data, or otherwise not real companies.
 * 
 * Safe: sets status='rejected' (not deleted), so they can be reviewed if needed.
 * 
 * Usage:
 *   node scripts/cleanup-junk-entries.js --dry-run   # show what would be rejected
 *   node scripts/cleanup-junk-entries.js             # actually reject them
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// Article headline verbs that prove a name came from an RSS article title
const ARTICLE_VERB_PATTERNS = [
  /\b(has|have)\s+(raised|secured|closed|launched|is|announced|partnered|acquired|expanded|won|received)/i,
  /\b(raises?|raised)\s+(\$|€|£|[0-9])/i,
  /\b(secures?|secured)\s+(\$|€|£|[0-9])/i,
  /\b(closes?|closed)\s+(funding|round|deal|series|a|b|c)\b/i,
  /\b(announces?|announced)\s+(new|launch|partnership|funding|raise|close)/i,
  /\b(acquires?|acquired)\s+\w/i,
];

// Test/dev entries
const TEST_PATTERNS = [
  /^test[-_]?\d{4,}/i,
  /^cleantest/i,
  /^quicktest/i,
  /^testmatch/i,
  /^newstartup$/i,
];

// Generic non-company names (these appear in our low scorers)
const GENERIC_PATTERNS = [
  /^post\s+\w+$/i,       // "Post Alora", "Post Mightyfly" - scraped article format
  /^in\s+round\s*/i,     // "In Round..."
  /^receives?\s/i,       // "Receives funding..."
  /^\d+\s+million/i,     // "$10 million..."
];

function isJunk(name) {
  if (!name || name.trim().length < 2) return { junk: true, reason: 'too short' };
  
  for (const p of ARTICLE_VERB_PATTERNS) {
    if (p.test(name)) return { junk: true, reason: 'article headline verb' };
  }
  for (const p of TEST_PATTERNS) {
    if (p.test(name)) return { junk: true, reason: 'test entry' };
  }
  for (const p of GENERIC_PATTERNS) {
    if (p.test(name)) return { junk: true, reason: 'generic non-company pattern' };
  }
  
  return { junk: false };
}

(async () => {
  console.log(DRY_RUN ? '\n🔍 DRY RUN — no changes will be made\n' : '\n🧹 CLEANUP MODE — will reject junk entries\n');

  const { data } = await sb.from('startup_uploads')
    .select('id, name, website, total_god_score')
    .eq('status', 'approved')
    .limit(10000);

  const toReject = [];
  for (const s of data) {
    const { junk, reason } = isJunk(s.name);
    if (junk) toReject.push({ ...s, reason });
  }

  console.log(`Found ${toReject.length} junk entries out of ${data.length} approved startups\n`);
  
  // Group by reason
  const byReason = {};
  for (const s of toReject) {
    byReason[s.reason] = (byReason[s.reason] || 0) + 1;
  }
  console.log('By reason:');
  Object.entries(byReason).forEach(([r, n]) => console.log(`  ${r}: ${n}`));

  console.log('\nSamples:');
  toReject.slice(0, 20).forEach(s => {
    console.log(`  [${s.total_god_score}] "${s.name}" (${s.reason})`);
  });

  if (DRY_RUN) {
    console.log(`\n✅ DRY RUN complete. Would reject ${toReject.length} entries.`);
    console.log('Run without --dry-run to apply.\n');
    return;
  }

  // Reject in batches
  const ids = toReject.map(s => s.id);
  const BATCH = 100;
  let rejected = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb.from('startup_uploads')
      .update({ status: 'rejected', rejection_reason: 'automated: junk/article-title entry' })
      .in('id', batch);
    if (error) {
      console.error(`Batch error: ${error.message}`);
    } else {
      rejected += batch.length;
      console.log(`  Rejected ${rejected}/${ids.length}...`);
    }
  }

  console.log(`\n✅ Done. Rejected ${rejected} junk entries.`);
  console.log('Re-run recalculate-scores.ts to update score distribution.\n');
})();
