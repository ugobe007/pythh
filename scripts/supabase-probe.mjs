#!/usr/bin/env node
/**
 * Probe Supabase REST connectivity — fail fast before long Hit@5 ops batches.
 *
 * Usage:
 *   node scripts/supabase-probe.mjs
 *   node scripts/supabase-probe.mjs --json
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { withNetworkRetry } from '../lib/supabaseNetworkRetry.mjs';

const JSON_OUT = process.argv.includes('--json');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function formatFetchError(error) {
  const parts = [error?.message || String(error)];
  if (error?.cause) {
    const c = error.cause;
    parts.push(`cause: ${c.code || ''} ${c.message || c}`.trim());
  }
  return parts.join(' — ');
}

async function main() {
  if (!url || !key) {
    const out = { ok: false, reason: 'missing_credentials', hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env' };
    if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
    else console.error('[supabase-probe] Missing SUPABASE_URL or service key');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    const result = await withNetworkRetry('supabase investors', async () => {
      const r = await db.from('investors').select('id').limit(1);
      if (r.error) throw r.error;
      return r;
    });
    const data = result.data;
    const payload = {
      ok: true,
      host: new URL(url).host,
      sample_rows: (data || []).length,
      checked_at: new Date().toISOString(),
    };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else console.log(`[supabase-probe] OK — ${payload.host}`);
  } catch (error) {
    const payload = {
      ok: false,
      reason: 'fetch_failed',
      host: url ? new URL(url).host : null,
      error: formatFetchError(error),
      hint: 'Retry in 30s; check Wi‑Fi/VPN; verify SUPABASE_URL in .env (npm run env:open)',
    };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else {
      console.error(`[supabase-probe] FAIL — ${payload.error}`);
      console.error(`  ${payload.hint}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[supabase-probe] Fatal:', e.message || e);
  process.exit(1);
});
