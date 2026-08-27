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
import {
  describeSupabaseEnv,
  resolveSupabaseRestUrl,
  resolveSupabaseServiceKey,
} from '../lib/supabaseEnv.mjs';

const JSON_OUT = process.argv.includes('--json');

function formatFetchError(error) {
  const parts = [];
  let e = error;
  for (let i = 0; i < 8 && e; i++) {
    parts.push(e.message || String(e));
    if (e.code) parts.push(`code=${e.code}`);
    e = e.cause;
  }
  return parts.filter(Boolean).join(' — ');
}

async function main() {
  let url;
  let urlSource;
  let key;
  try {
    ({ url, source: urlSource } = resolveSupabaseRestUrl());
    key = resolveSupabaseServiceKey();
  } catch (configError) {
    const out = {
      ok: false,
      reason: 'bad_config',
      env: describeSupabaseEnv(),
      error: configError.message,
      hint: 'npm run env:open — SUPABASE_URL must be https://<ref>.supabase.co (not DATABASE_URL)',
    };
    if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
    else {
      console.error('[supabase-probe] Config error');
      for (const line of out.env) console.error(`  ${line}`);
      console.error(`  ${out.error}`);
      console.error(`  ${out.hint}`);
    }
    process.exit(1);
  }

  if (!JSON_OUT) {
    console.log(`[supabase-probe] using ${urlSource} → ${new URL(url).host}`);
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
      url_source: urlSource,
      sample_rows: (data || []).length,
      checked_at: new Date().toISOString(),
    };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else console.log(`[supabase-probe] OK — ${payload.host}`);
  } catch (error) {
    const payload = {
      ok: false,
      reason: 'fetch_failed',
      host: new URL(url).host,
      url_source: urlSource,
      env: describeSupabaseEnv(),
      error: formatFetchError(error),
      hint: 'Check Wi‑Fi/VPN; confirm SUPABASE_URL is https://<ref>.supabase.co (not postgres pooler)',
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
