#!/usr/bin/env node
/**
 * Investor portfolio weekly delta — "N of your 10 picks moved this week"
 *
 * Usage:
 *   node scripts/investor-portfolio-delta-digest.mjs --to signed-up
 *   node scripts/investor-portfolio-delta-digest.mjs --to investor@firm.com
 *   node scripts/investor-portfolio-delta-digest.mjs --dry-run --to signed-up
 *
 * Cron: Monday 08:45 UTC (after dealflow digest)
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';
import { Resend } from 'resend';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { recordFunnelEvent } = require('../server/lib/funnelTelemetry.js');

const args = process.argv.slice(2);
const argVal = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (f) => args.includes(f);

const TO_ARG = argVal('--to');
const DRY_RUN = hasFlag('--dry-run');
const SKIP_RECENT = !hasFlag('--force');

const SITE_BASE = (process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'Pythh Portfolio <notifications@pythh.ai>';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const LIST_NAME = 'Virtual portfolio';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

if (!TO_ARG) {
  console.error('Usage: node scripts/investor-portfolio-delta-digest.mjs --to <email|signed-up>');
  process.exit(1);
}

if (!DRY_RUN && !RESEND_KEY) {
  console.error('RESEND_API_KEY is required (or use --dry-run)');
  process.exit(1);
}

function portfolioOwnerId(investorId) {
  return `inv_${investorId}`;
}

async function loadRecipients(mode) {
  if (mode !== 'signed-up') return [{ email: mode, name: mode.split('@')[0], id: null }];

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const investorIds = new Set();

  const { data: events } = await sb
    .from('growth_experiment_events')
    .select('payload')
    .eq('event_name', 'investor_signup_completed')
    .gte('created_at', since)
    .limit(2000);

  for (const row of events || []) {
    const id = row.payload?.investor_id;
    if (id) investorIds.add(id);
  }

  let query = sb
    .from('investors')
    .select('id, name, email')
    .not('email', 'is', null)
    .not('email', 'eq', '')
    .limit(500);

  if (investorIds.size > 0) {
    query = query.in('id', [...investorIds]);
  } else {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) throw error;

  const seen = new Set();
  return (data || []).filter((inv) => {
    const email = (inv.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

async function getPortfolioItems(ownerId) {
  const { data: lists } = await sb
    .from('investor_curated_lists')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('name', LIST_NAME)
    .limit(1);

  const listId = lists?.[0]?.id;
  if (!listId) return [];

  const { data: items } = await sb
    .from('investor_curated_list_items')
    .select('startup_id, added_at, notes')
    .eq('list_id', listId)
    .order('added_at', { ascending: false })
    .limit(10);

  if (!items?.length) return [];

  const startupIds = items.map((i) => i.startup_id);
  const { data: startups } = await sb
    .from('startup_uploads')
    .select('id, name, total_god_score, sectors, website')
    .in('id', startupIds);

  const byId = Object.fromEntries((startups || []).map((s) => [s.id, s]));
  const weekAgo = Date.now() - 7 * 86_400_000;

  const enriched = [];
  for (const item of items) {
    const s = byId[item.startup_id];
    if (!s) continue;

    let entryGod = null;
    try {
      const notes = item.notes ? JSON.parse(item.notes) : null;
      entryGod = notes?.entry_god_score ?? null;
    } catch {
      entryGod = null;
    }

    const currentGod = s.total_god_score != null ? Math.round(s.total_god_score) : null;
    let delta7d = null;

    const { data: hist } = await sb
      .from('startup_signal_score_history')
      .select('signals_total, captured_at')
      .eq('startup_id', item.startup_id)
      .order('captured_at', { ascending: false })
      .limit(2);

    if (hist?.length >= 2) {
      const latest = Number(hist[0].signals_total);
      const prior = Number(hist[1].signals_total);
      if (Number.isFinite(latest) && Number.isFinite(prior)) {
        delta7d = Math.round((latest - prior) * 10) / 10;
      }
    }

    const addedRecently = item.added_at && new Date(item.added_at).getTime() >= weekAgo;
    const godDeltaFromEntry =
      entryGod != null && currentGod != null ? currentGod - entryGod : null;

    enriched.push({
      startup_id: item.startup_id,
      name: s.name,
      website: s.website,
      current_god: currentGod,
      entry_god: entryGod,
      god_delta_from_entry: godDeltaFromEntry,
      signal_delta_7d: delta7d,
      added_recently: addedRecently,
      moved: Boolean(
        addedRecently ||
          (godDeltaFromEntry != null && godDeltaFromEntry !== 0) ||
          (delta7d != null && delta7d !== 0),
      ),
    });
  }

  return enriched;
}

function buildEmailHtml({ recipientName, items, movedCount, pickCount }) {
  const moved = items.filter((i) => i.moved);
  const cards = moved
    .slice(0, 5)
    .map((p) => {
      const delta =
        p.god_delta_from_entry != null && p.god_delta_from_entry !== 0
          ? `GOD ${p.entry_god} → ${p.current_god} (${p.god_delta_from_entry > 0 ? '+' : ''}${p.god_delta_from_entry})`
          : p.current_god != null
            ? `GOD ${p.current_god}`
            : '';
      return `<div style="border:1px solid #1e1e1e;border-radius:8px;padding:12px;margin-bottom:8px;background:#111;">
        <p style="margin:0 0 4px;color:#fff;font-weight:600;font-size:14px;">${p.name}</p>
        <p style="margin:0;font-size:12px;color:#888;">${delta}${p.added_recently ? ' · new pick this week' : ''}</p>
        <p style="margin:6px 0 0;"><a href="${SITE_BASE}/investor/portfolio" style="color:#f59e0b;font-size:11px;">View in portfolio →</a></p>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><body style="background:#080808;color:#eee;font-family:sans-serif;padding:24px;">
    <div style="max-width:560px;margin:0 auto;">
      <p style="color:#f59e0b;font-weight:800;">[pyth] Portfolio Delta</p>
      <h1 style="font-size:20px;color:#fff;">Hi ${recipientName} — ${movedCount} of your ${pickCount} picks moved this week</h1>
      <p style="color:#888;font-size:13px;">Your virtual portfolio tracks GOD signals and funding for up to 10 startups.</p>
      ${cards || '<p style="color:#666;">No major moves detected — your picks are stable.</p>'}
      <p style="margin-top:20px;">
        <a href="${SITE_BASE}/investor/portfolio?utm_source=portfolio_delta&utm_medium=email" style="display:inline-block;background:#f59e0b;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Open my portfolio</a>
      </p>
      <p style="font-size:11px;color:#444;margin-top:24px;">Pythh investor portfolio · up to 10 tracked picks</p>
    </div>
  </body></html>`;
}

async function recentlyEmailed(email) {
  if (!SKIP_RECENT) return false;
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const { data } = await sb
    .from('ai_logs')
    .select('id')
    .eq('operation', 'investor_portfolio_delta_sent')
    .gte('created_at', since)
    .contains('output', { recipient_email: email })
    .limit(1);
  return (data || []).length > 0;
}

async function sendToInvestor(investor) {
  const email = (investor.email || '').trim().toLowerCase();
  const ownerId = portfolioOwnerId(investor.id);
  const items = await getPortfolioItems(ownerId);

  if (items.length === 0) {
    console.log(`  ⏭️  ${email} — no portfolio picks`);
    return { sent: false, skipped: true, reason: 'no_picks' };
  }

  if (await recentlyEmailed(email)) {
    console.log(`  ⏭️  ${email} — delta sent in last 6 days`);
    return { sent: false, skipped: true, reason: 'recent' };
  }

  const movedCount = items.filter((i) => i.moved).length;
  const pickCount = items.length;
  const name = investor.name || email.split('@')[0];
  const subject = `[Pythh] ${movedCount} of your ${pickCount} picks moved this week`;
  const html = buildEmailHtml({ recipientName: name, items, movedCount, pickCount });

  if (DRY_RUN) {
    console.log(`  📧 DRY — ${email}: ${movedCount}/${pickCount} moved`);
    return { sent: false, dryRun: true };
  }

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    html,
  });

  if (error) {
    console.error(`  ❌ ${email}:`, error.message);
    return { sent: false, error: error.message };
  }

  await recordFunnelEvent(
    sb,
    'investor_portfolio_delta_sent',
    {
      investor_id: investor.id,
      recipient_email: email,
      pick_count: pickCount,
      moved_count: movedCount,
      resend_id: data?.id || null,
    },
    { source: 'investor_portfolio_delta_digest' },
  );

  console.log(`  ✅ ${email} — ${movedCount}/${pickCount} moved (id: ${data?.id})`);
  return { sent: true };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Investor Portfolio Delta Digest', DRY_RUN ? '(DRY RUN)' : '');
  console.log('═══════════════════════════════════════════════════════════════');

  const recipients =
    TO_ARG === 'signed-up' ? await loadRecipients('signed-up') : await loadRecipients(TO_ARG);

  let sent = 0;
  let skipped = 0;

  for (const inv of recipients) {
    if (!inv.id && TO_ARG !== 'signed-up') {
      console.log(`  ⚠️  Single-email mode without investor id — skipping ${inv.email}`);
      continue;
    }
    const result = await sendToInvestor(inv);
    if (result.sent) sent += 1;
    else if (result.skipped) skipped += 1;
  }

  console.log(`\nDone: ${sent} sent, ${skipped} skipped, ${recipients.length} recipients checked\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
