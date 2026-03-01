import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const buckets = [0, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 101];
console.log('GOD Score distribution (approved startups):');
for (let i = 0; i < buckets.length - 1; i++) {
  const lo = buckets[i], hi = buckets[i + 1];
  const { count } = await sb.from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('total_god_score', lo)
    .lt('total_god_score', hi);
  console.log(`  [${String(lo).padStart(3)}-${String(hi).padStart(3)}): ${count ?? 0}`);
}
const { count: nullCount } = await sb.from('startup_uploads')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'approved')
  .is('total_god_score', null);
console.log(`  NULL score:   ${nullCount ?? 0}`);
