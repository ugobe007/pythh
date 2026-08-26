#!/usr/bin/env node
/**
 * Probe Gemini text/search model — fail fast when model name is deprecated.
 *
 * Usage:
 *   node scripts/gemini-search-probe.mjs
 *   node scripts/gemini-search-probe.mjs --json
 */

import 'dotenv/config';

const JSON_OUT = process.argv.includes('--json');
const model = process.env.GEMINI_SEARCH_MODEL || 'gemini-3.6-flash';
const key = (process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || '').trim();

async function main() {
  if (!key) {
    const out = { ok: false, reason: 'missing_api_key', model, hint: 'Set GEMINI_API_KEY in .env' };
    if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
    else console.error('[gemini-search-probe] GEMINI_API_KEY missing');
    process.exit(1);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: ok' }] }],
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  const body = await res.text();
  if (!res.ok) {
    const payload = {
      ok: false,
      reason: 'api_error',
      model,
      status: res.status,
      error: body.slice(0, 400),
      hint:
        res.status === 404
          ? 'Update GEMINI_SEARCH_MODEL to gemini-3.6-flash in .env (npm run env:open)'
          : 'Check GEMINI_API_KEY and billing',
    };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else {
      console.error(`[gemini-search-probe] FAIL (${res.status}) — ${model}`);
      console.error(`  ${body.split('\n')[0]}`);
      if (payload.hint) console.error(`  ${payload.hint}`);
    }
    process.exit(1);
  }

  const payload = { ok: true, model, checked_at: new Date().toISOString() };
  if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
  else console.log(`[gemini-search-probe] OK — ${model}`);
}

main().catch((e) => {
  console.error('[gemini-search-probe] Fatal:', e.message || e);
  process.exit(1);
});
