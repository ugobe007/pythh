// Bulk-approve pending startups — with URL quality gate
// Only approves entries that have a website or company_website.
// No-URL entries (scraper noise, article fragments) are left pending
// so they don't pollute the SSOT startup_uploads table.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  // 1. Count what's pending
  const { data: pending } = await sb
    .from('startup_uploads')
    .select('id, name, website, company_website, source_type')
    .eq('status', 'pending');

  if (!pending || pending.length === 0) {
    console.log('No pending startups');
  } else {
    const withUrl = pending.filter(s => s.website || s.company_website);
    const noUrl = pending.filter(s => !s.website && !s.company_website);

    console.log(`Pending: ${pending.length} total | ${withUrl.length} have URL | ${noUrl.length} no URL (will skip)`);

    // Approve only those with a URL
    if (withUrl.length > 0) {
      const ids = withUrl.map(s => s.id);
      const { data: approved, error: approveError } = await sb
        .from('startup_uploads')
        .update({ status: 'approved' })
        .in('id', ids)
        .select('id, name');

      if (approveError) {
        console.error('Bulk-approve failed:', approveError.message);
      } else {
        console.log(`Approved ${approved?.length || 0} startups with URLs:`);
        approved?.slice(0, 5).forEach(s => console.log(' +', s.name));
        if ((approved?.length || 0) > 5) console.log(`  ... and ${(approved?.length || 0) - 5} more`);
      }
    }

    // Log skipped no-URL entries (don't approve — leave as pending for admin review)
    if (noUrl.length > 0) {
      console.log(`Skipped ${noUrl.length} entries with no URL (scraper noise / article fragments):`);
      noUrl.slice(0, 8).forEach(s => console.log(` - [${s.source_type}] ${s.name}`));
      if (noUrl.length > 8) console.log(`  ... and ${noUrl.length - 8} more`);
    }
  }

  // 2. Seed god_algorithm_config with baseline if empty
  const { count: configCount } = await sb
    .from('god_algorithm_config')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (!configCount || configCount === 0) {
    const { error: seedError } = await sb.from('god_algorithm_config').insert({
      normalization_divisor: 19.0,
      base_boost_minimum: 2.8,
      vibe_bonus_cap: 1.0,
      is_active: true,
      applied_by: 'system',
      description: 'Production baseline — calibrated Feb 20, 2026'
    });
    if (seedError) console.error('Config seed failed:', seedError.message);
    else console.log('Seeded god_algorithm_config with baseline');
  } else {
    console.log('god_algorithm_config already has', configCount, 'active row(s)');
  }

  // 3. Final state
  const { count: stillPending } = await sb
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  const { count: nowApproved } = await sb
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  console.log(`Final state: approved=${nowApproved} | still pending=${stillPending}`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
