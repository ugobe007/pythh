/**
 * One-time cleanup: delete all startup_investor_matches for startups with GOD score < 35.
 * Run once after deploying the sub-35 filter to match-regenerator.js.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Fetch sub-35 approved startup IDs
const { data: sub35Startups, error: sErr } = await supabase
  .from('startup_uploads')
  .select('id')
  .lt('total_god_score', 35)
  .eq('status', 'approved');

if (sErr) { console.error('Error fetching sub-35 startups:', sErr); process.exit(1); }
console.log(`Found ${sub35Startups.length} approved startups with GOD score < 35`);

if (!sub35Startups.length) { console.log('Nothing to purge.'); process.exit(0); }

const sub35Ids = sub35Startups.map(s => s.id);

// Count matches to purge
const { count: matchCount, error: cErr } = await supabase
  .from('startup_investor_matches')
  .select('id', { count: 'exact', head: true })
  .in('startup_id', sub35Ids);

if (cErr) { console.error('Count error:', cErr); process.exit(1); }
console.log(`Matches to purge: ${matchCount}`);

if (!matchCount) { console.log('Match table already clean.'); process.exit(0); }

// Delete in batches of 500 startup IDs at a time (Supabase IN clause limit)
let totalDeleted = 0;
const batchSize = 500;
for (let i = 0; i < sub35Ids.length; i += batchSize) {
  const batch = sub35Ids.slice(i, i + batchSize);
  const { error: dErr, count } = await supabase
    .from('startup_investor_matches')
    .delete({ count: 'exact' })
    .in('startup_id', batch);
  if (dErr) { console.error(`Delete error at batch ${i}:`, dErr); }
  else { totalDeleted += (count || 0); process.stdout.write('.'); }
}
console.log(`\nDone. Deleted ${totalDeleted} matches for sub-35 startups.`);
