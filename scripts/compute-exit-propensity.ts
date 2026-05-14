/**
 * Batch-compute exit / strategic acquisition propensity → startup_uploads.exit_propensity_*
 *
 *   npx tsx scripts/compute-exit-propensity.ts           # dry-run (sample 5)
 *   npx tsx scripts/compute-exit-propensity.ts --apply
 *   npx tsx scripts/compute-exit-propensity.ts --apply --limit=2000
 *   npx tsx scripts/compute-exit-propensity.ts --apply --concurrency=40
 *   npx tsx scripts/compute-exit-propensity.ts --apply --repair-gaps   # only rows with exit_propensity_at IS NULL
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { computeExitPropensity } from '../server/services/exitPropensityService';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const APPLY = process.argv.includes('--apply');
const REPAIR_GAPS = process.argv.includes('--repair-gaps');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const concArg = process.argv.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = Math.min(
  80,
  Math.max(5, concArg ? parseInt(concArg.split('=')[1], 10) || 25 : 25),
);

const PAGE = 500;
const MAX_RETRIES = 4;

function shortErr(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);
  if (s.length > 160) return `${s.slice(0, 160)}…`;
  return s;
}

function isRetriable(msg: string): boolean {
  return /fetch failed|502|503|504|522|timeout|Bad Gateway|ECONNRESET|ETIMEDOUT|socket hang up|NetworkError/i.test(
    msg,
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchApprovedRows(): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from('startup_uploads')
      .select(
        'id, name, company_status, entity_gate, website, company_website, stage, maturity_level, extracted_data, total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus, arr_usd, arr, revenue_usd, parsed_customers, customer_count, growth_rate_monthly',
      )
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (REPAIR_GAPS) {
      q = q.is('exit_propensity_at', null);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (LIMIT != null && out.length >= LIMIT) break;
  }
  if (LIMIT != null && out.length > LIMIT) return out.slice(0, LIMIT);
  return out;
}

async function updateOneWithRetry(row: Record<string, unknown>): Promise<boolean> {
  const r = computeExitPropensity(row as Record<string, unknown>);
  const payload = {
    exit_propensity_score: r.score,
    exit_propensity_confidence: r.confidence,
    exit_propensity_breakdown: r.breakdown as unknown as Record<string, unknown>,
    exit_propensity_tier: r.tier,
    exit_propensity_at: new Date().toISOString(),
  };
  const id = row.id as string;
  let lastMsg = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await supabase.from('startup_uploads').update(payload).eq('id', id);
    if (!error) return true;
    lastMsg = error.message || String(error);
    const retriable = isRetriable(lastMsg) && attempt < MAX_RETRIES;
    if (retriable) {
      await sleep(400 * attempt);
      continue;
    }
    console.warn(`  ⚠️  ${id}: ${shortErr(lastMsg)}`);
    return false;
  }
  console.warn(`  ⚠️  ${id}: ${shortErr(lastMsg)}`);
  return false;
}

async function main() {
  console.log('\n🎯 Exit propensity batch');
  console.log(`   Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  if (REPAIR_GAPS) console.log('   Filter: --repair-gaps (only exit_propensity_at IS NULL)');
  if (APPLY) console.log(`   Concurrency: ${CONCURRENCY} (set --concurrency=N to tune)`);
  const rows = await fetchApprovedRows();
  console.log(`   Rows: ${rows.length}\n`);

  const sample = rows.slice(0, 5);

  if (!APPLY) {
    for (const row of sample) {
      const r = computeExitPropensity(row as Record<string, unknown>);
      console.log(`  ${row.name}: score=${r.score ?? '—'} tier=${r.tier} conf=${r.confidence}`);
    }
    console.log('\n  Pass --apply to write columns.\n');
    return;
  }

  const t0 = Date.now();
  const PROGRESS_EVERY = 2000;
  let lastLog = 0;

  let updated = 0;
  let done = 0;
  const failed: { id: string; name: string }[] = [];

  for (let start = 0; start < rows.length; start += CONCURRENCY) {
    const chunk = rows.slice(start, start + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => {
        const ok = await updateOneWithRetry(row);
        if (!ok) failed.push({ id: row.id as string, name: String(row.name || '') });
        return ok;
      }),
    );
    updated += results.filter(Boolean).length;
    done += chunk.length;
    if (done - lastLog >= PROGRESS_EVERY || done === rows.length) {
      lastLog = done;
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  … ${done} / ${rows.length} rows (${sec}s elapsed)`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Updated ${updated} / ${rows.length} startups in ${elapsed}s`);

  if (failed.length > 0) {
    console.log(`\n❌ Still missing after retries (${failed.length}):`);
    for (const f of failed) {
      console.log(`   ${f.id}  ${f.name ? `«${f.name.slice(0, 60)}»` : ''}`);
    }
    console.log('\n   Repair: npx tsx scripts/compute-exit-propensity.ts --apply --repair-gaps\n');
    console.log(
      '   SQL (Supabase): SELECT id, name FROM startup_uploads WHERE status = \'approved\' AND exit_propensity_at IS NULL;\n',
    );
  } else {
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
