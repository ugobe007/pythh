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

const { count: totalMatches } = await sb.from('startup_investor_matches').select('id', { count: 'exact', head: true });
const { count: suggestedMatches } = await sb.from('startup_investor_matches').select('id', { count: 'exact', head: true }).eq('status', 'suggested');
const { count: approvedStartups } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved');
const { count: approvedGte35 } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('total_god_score', 35);

console.log('=== Match System Health ===');
console.log(`Total matches:        ${totalMatches}`);
console.log(`Suggested matches:    ${suggestedMatches}`);
console.log(`Approved startups:    ${approvedStartups}`);
console.log(`Startups ≥35 (pool):  ${approvedGte35}`);
console.log(`Startups filtered:    ${approvedStartups - approvedGte35} (${(((approvedStartups - approvedGte35) / approvedStartups) * 100).toFixed(1)}%)`);
