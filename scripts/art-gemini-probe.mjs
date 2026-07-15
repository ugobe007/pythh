#!/usr/bin/env node
/**
 * Probe Gemini image API — fail fast when billing/key blocks Signal Art.
 *
 * Usage:
 *   node scripts/art-gemini-probe.mjs
 *   node scripts/art-gemini-probe.mjs --json
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const { generateGeminiRaster, getGeminiApiKey } = require('../server/lib/signalArtGemini');

const JSON_OUT = process.argv.includes('--json');

async function main() {
  const key = getGeminiApiKey();
  if (!key) {
    const out = { ok: false, reason: 'missing_api_key', hint: 'Set GEMINI_API_KEY in GitHub secrets / .env' };
    if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
    else console.error('[art-gemini-probe] GEMINI_API_KEY missing');
    process.exit(1);
  }

  const result = await generateGeminiRaster({
    visualPrompt:
      'Test probe: flowing violet aurora ribbons across a dark oracle void, sci-fi energy in motion, full bleed',
    accentHex: '#a78bfa',
  });

  const payload = {
    ok: result.ok,
    reason: result.reason || null,
    model: result.model || null,
    error: result.error || null,
    hint: result.hint || null,
    checked_at: new Date().toISOString(),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (result.ok) {
    console.log(`[art-gemini-probe] OK — ${result.model}`);
  } else {
    console.error(`[art-gemini-probe] BLOCKED (${result.reason})`);
    if (result.error) console.error(`  ${result.error.split('\n')[0]}`);
    if (result.hint) console.error(`  ${result.hint}`);
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[art-gemini-probe] Fatal:', e.message || e);
  process.exit(1);
});
