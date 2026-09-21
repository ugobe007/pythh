#!/usr/bin/env node
/**
 * Rewrite stored Peter VC draft bodies to the current analyst copy.
 * Does not rematch or send. Safe for admin preview.
 *
 *   node scripts/refresh-peter-vc-drafts.mjs
 *   node scripts/refresh-peter-vc-drafts.mjs --apply
 */
import { config } from 'dotenv';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

config();
const require = createRequire(import.meta.url);
const { isStalePeterVcCopy, refreshPeterVcDraft } = require('../lib/refreshPeterVcDraft.js');

const APPLY = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await db
  .from('pythh_prospecting_log')
  .select('id, email_type, subject, html_body, text_body, target_name, status, campaign_slug')
  .eq('status', 'draft')
  .eq('email_type', 'vc_leads')
  .order('sent_at', { ascending: false })
  .limit(200);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
let stale = 0;
for (const draft of data ?? []) {
  if (!isStalePeterVcCopy(draft.html_body, draft.text_body, draft.subject)) continue;
  stale += 1;
  const next = refreshPeterVcDraft(draft);
  if (!next?.changed) continue;
  if (!APPLY) {
    updated += 1;
    continue;
  }
  const { error: upErr } = await db
    .from('pythh_prospecting_log')
    .update({
      subject: next.subject,
      html_body: next.html_body,
      text_body: next.text_body,
    })
    .eq('id', draft.id)
    .eq('status', 'draft');
  if (upErr) {
    console.error(`update failed: ${upErr.message}`);
    continue;
  }
  updated += 1;
}

console.log(JSON.stringify({
  scanned: data?.length ?? 0,
  stale,
  updated,
  apply: APPLY,
}, null, 2));
