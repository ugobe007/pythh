#!/usr/bin/env node
/**
 * Investor Dealflow Digest — weekly thesis-matched startups for signed-up investors.
 *
 * Usage:
 *   node scripts/investor-dealflow-digest.mjs --to investor@firm.com
 *   node scripts/investor-dealflow-digest.mjs --to signed-up          # investors who completed signup (default batch)
 *   node scripts/investor-dealflow-digest.mjs --to all                # any investor row with email
 *   node scripts/investor-dealflow-digest.mjs --dry-run --to test@example.com
 *
 * Cron (Mondays 8am UTC):
 *   0 8 * * 1 cd /path/to/hot-honey && npm run digest:investor >> logs/investor-digest.log 2>&1
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
const SECTORS_ARG = argVal('--sectors');
const STAGES_ARG = argVal('--stages');
const TOP_N = parseInt(argVal('--top', '5'), 10);
const DRY_RUN = hasFlag('--dry-run');
const SKIP_RECENT = !hasFlag('--force');

const SITE_BASE = (process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'Peter at Pythh <pythia@pythh.ai>';
const RESEND_KEY = process.env.RESEND_API_KEY || '';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

if (!TO_ARG) {
  console.error('Usage: node scripts/investor-dealflow-digest.mjs --to <email|signed-up|all>');
  process.exit(1);
}

if (!DRY_RUN && !RESEND_KEY) {
  console.error('RESEND_API_KEY is required (or use --dry-run)');
  process.exit(1);
}

const SIGNAL_LABELS = {
  fundraising_signal: 'Fundraising',
  acquisition_signal: 'Acquisition',
  exit_signal: 'Exit Prep',
  distress_signal: 'Distress',
  revenue_signal: 'Revenue',
  hiring_signal: 'Hiring',
  enterprise_signal: 'Enterprise',
  expansion_signal: 'Expansion',
  gtm_signal: 'GTM Build',
  demand_signal: 'Demand',
  growth_signal: 'Growth',
  product_signal: 'Product',
  partnership_signal: 'Partnership',
  buyer_signal: 'Buying',
};

const TRAJ_LABELS = {
  fundraising_active: 'Fundraising',
  gtm_expansion: 'GTM Expansion',
  growth: 'Growth',
  product_maturation: 'Product Build',
  exit_preparation: 'Exit Prep',
  distress_survival: 'Distress',
  repositioning: 'Repositioning',
  expansion: 'Expansion',
};

const URGENCY_EMOJI = { high: '🔴', medium: '🟡', low: '🟢' };
const URGENCY_RANK = { high: 3, medium: 2, low: 1 };

function compareMatchRows(a, b) {
  const ua = URGENCY_RANK[a.urgency] || 0;
  const ub = URGENCY_RANK[b.urgency] || 0;
  if (ub !== ua) return ub - ua;
  return (b.match_score || 0) - (a.match_score || 0);
}

/** One row per startup — pythh_top_matches has one row per entity×candidate pair. */
function dedupeMatchesByEntity(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = String(row.entity_name || '')
      .trim()
      .toLowerCase();
    if (!key) continue;
    const existing = best.get(key);
    if (!existing || compareMatchRows(row, existing) > 0) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort(compareMatchRows);
}

async function fetchTopMatches({ sectors = [], stages = [], topN = 5 }) {
  const { data, error } = await sb
    .from('pythh_top_matches')
    .select('*')
    .eq('match_type', 'capital_match')
    .order('match_score', { ascending: false })
    .limit(500);

  if (error) throw error;

  let rows = data || [];

  if (sectors.length > 0) {
    rows = rows.filter((m) =>
      (m.entity_sectors || []).some((s) =>
        sectors.some((p) => s.toLowerCase().includes(p.toLowerCase())),
      ),
    );
  }

  if (stages.length > 0) {
    rows = rows.filter((m) =>
      stages.some((s) => (m.entity_stage || '').toLowerCase().includes(s.toLowerCase())),
    );
  }

  rows.sort(compareMatchRows);

  return dedupeMatchesByEntity(rows).slice(0, topN);
}

function matchLink(entityName) {
  if (entityName) return `${SITE_BASE}/investors?q=${encodeURIComponent(entityName)}`;
  return `${SITE_BASE}/investors`;
}

function buildEmail(matches, recipientName = 'Investor', prefs = {}) {
  const week = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const hotCount = matches.filter((m) => m.urgency === 'high').length;

  const prefsLine = [
    prefs.sectors?.length ? `Sectors: ${prefs.sectors.join(', ')}` : null,
    prefs.stages?.length ? `Stage: ${prefs.stages.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const matchCards = matches
    .map((m, i) => {
      const scorePct = Math.round((m.match_score || 0) * 100);
      const timingPct = Math.round((m.timing_score || 0) * 100);
      const confPct = Math.round((m.confidence || 0) * 100);
      const urgencyEmoji = URGENCY_EMOJI[m.urgency] || '⚪';
      const signals = (m.supporting_signals || [])
        .slice(0, 3)
        .map((s) => SIGNAL_LABELS[s] || s.replace(/_/g, ' '))
        .join(' · ');
      const traj =
        TRAJ_LABELS[m.trajectory_used] ||
        (m.trajectory_used || '—').replace(/_/g, ' ');
      const reasons = (m.explanation || []).slice(0, 2);
      const needs = (m.predicted_need || []).slice(0, 3).join(', ');
      const sectors = (m.entity_sectors || []).slice(0, 3).join(', ');
      const stage = m.entity_stage || '';
      const bgColor = i % 2 === 0 ? '#111111' : '#0e0e0e';
      const href = matchLink(m.entity_name);
      const fitInvestor = m.candidate_name
        ? `<span style="font-size:11px;color:#666;margin-left:8px;">↔ ${m.candidate_name}</span>`
        : '';

      return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:${bgColor};border:1px solid #222;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:17px;font-weight:700;color:#ffffff;">${m.entity_name || '—'}</span>${fitInvestor}
                    ${stage ? `<span style="font-size:11px;background:#1a1a1a;border:1px solid #333;color:#888;padding:2px 8px;border-radius:20px;margin-left:8px;">${stage}</span>` : ''}
                    ${m.urgency === 'high' ? '<span style="font-size:11px;background:#422;border:1px solid #633;color:#f97316;padding:2px 8px;border-radius:20px;margin-left:4px;">🔥 Hot</span>' : ''}
                  </td>
                  <td align="right" style="white-space:nowrap;">
                    <span style="font-size:22px;font-weight:800;color:${scorePct >= 75 ? '#10b981' : scorePct >= 55 ? '#f59e0b' : '#f97316'};">${scorePct}%</span>
                    <span style="font-size:11px;color:#555;margin-left:4px;">fit</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:8px;">
                ${sectors ? `<span style="font-size:11px;color:#f59e0b;margin-right:8px;">${sectors}</span>` : ''}
                ${traj ? `<span style="font-size:11px;color:#888;background:#1a1a1a;padding:2px 6px;border-radius:4px;">${traj}</span>` : ''}
              </div>
              <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  ${[
                    ['Score', `${scorePct}%`, '#f59e0b'],
                    ['Timing', `${timingPct}%`, '#22d3ee'],
                    ['Confidence', `${confPct}%`, '#a78bfa'],
                    ['Urgency', `${urgencyEmoji} ${m.urgency || '—'}`, m.urgency === 'high' ? '#f97316' : '#888'],
                  ]
                    .map(
                      ([label, val, color]) => `
                    <td style="padding-right:20px;">
                      <div style="font-size:13px;font-weight:700;color:${color};">${val}</div>
                      <div style="font-size:10px;color:#555;">${label}</div>
                    </td>
                  `,
                    )
                    .join('')}
                </tr>
              </table>
              ${signals ? `<div style="margin-top:12px;font-size:11px;color:#555;">Signals: <span style="color:#888;">${signals}</span></div>` : ''}
              ${
                reasons.length > 0
                  ? `<ul style="margin:10px 0 0 0;padding:0 0 0 16px;">${reasons.map((r) => `<li style="font-size:12px;color:#777;margin-bottom:4px;">${r}</li>`).join('')}</ul>`
                  : ''
              }
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px;">
                <tr>
                  <td style="font-size:11px;color:#555;">${needs ? `<strong style="color:#888;">Needs:</strong> ${needs}` : ''}</td>
                  <td align="right">
                    <a href="${href}" style="display:inline-block;background:#f59e0b;color:#000;font-size:12px;font-weight:700;padding:7px 16px;border-radius:8px;text-decoration:none;">View startup →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#080808;padding:40px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;">
      <tr><td style="padding:0 0 28px 0;border-bottom:1px solid #1a1a1a;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <span style="font-size:22px;font-weight:800;color:#f59e0b;">Peter</span>
              <span style="font-size:18px;font-weight:700;color:#ffffff;"> · Dealflow Digest</span>
            </td>
            <td align="right" style="font-size:11px;color:#444;">${week}</td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:13px;color:#555;">
          Hi ${recipientName} — Peter here. ${matches.length} thesis-matched startups deploying in spaces aligned with your portfolio this week.
        </p>
        ${prefsLine ? `<p style="margin:4px 0 0;font-size:11px;color:#3a3a3a;">${prefsLine}</p>` : ''}
      </td></tr>
      <tr><td style="padding:16px 0 20px 0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#111;border:1px solid #1e1e1e;border-radius:10px;">
          <tr>
            ${[
              ['Matches', matches.length.toString(), '#f59e0b'],
              ['Hot signals', hotCount.toString(), '#f97316'],
              [
                'Avg score',
                `${Math.round((matches.reduce((s, m) => s + (m.match_score || 0), 0) / Math.max(matches.length, 1)) * 100)}%`,
                '#10b981',
              ],
            ]
              .map(
                ([label, val, color]) => `
              <td align="center" style="padding:12px;">
                <div style="font-size:20px;font-weight:800;color:${color};">${val}</div>
                <div style="font-size:10px;color:#555;">${label}</div>
              </td>
            `,
              )
              .join('')}
          </tr>
        </table>
      </td></tr>
      <tr><td><table cellpadding="0" cellspacing="0" width="100%">${matchCards}</table></td></tr>
      <tr><td style="padding:20px 0 0;border-top:1px solid #1a1a1a;text-align:center;">
        <a href="${SITE_BASE}/investors?utm_source=dealflow_digest&utm_medium=email"
           style="display:inline-block;background:#f59e0b;color:#000;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;margin-bottom:12px;">
          Browse full dealflow →
        </a>
        <p style="font-size:11px;color:#333;margin:0;">
          You're receiving this because you signed up as an investor on Pythh.
          <a href="${SITE_BASE}/investor/profile" style="color:#444;">Manage profile</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function recentlyEmailed(email) {
  if (!SKIP_RECENT) return false;
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const { data } = await sb
    .from('ai_logs')
    .select('id')
    .eq('operation', 'investor_dealflow_digest_sent')
    .gte('created_at', since)
    .contains('output', { recipient_email: email })
    .limit(1);
  return (data || []).length > 0;
}

async function logDigestSent({ investorId, email, matchCount, hotCount, resendId }) {
  await recordFunnelEvent(
    sb,
    'investor_dealflow_digest_sent',
    {
      investor_id: investorId || null,
      recipient_email: email,
      match_count: matchCount,
      hot_count: hotCount,
      resend_id: resendId || null,
      source: 'investor_dealflow_digest',
    },
    { source: 'investor_dealflow_digest' },
  );
}

function normalizeSectors(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

async function sendToInvestor({ id, email, name, sectors, stages }) {
  const prefSectors = normalizeSectors(sectors);
  const prefStages = normalizeSectors(stages);

  if (await recentlyEmailed(email)) {
    console.log(`  ⏭️  Skipped ${email} — digest sent in last 6 days`);
    return { sent: false, skipped: true };
  }

  const matches = await fetchTopMatches({
    sectors: prefSectors,
    stages: prefStages,
    topN: TOP_N,
  });

  // Fallback: narrow prefs often eliminate all rows (null entity_stage, sector tag mismatch)
  let resolved = matches;
  if (resolved.length === 0 && prefStages.length > 0) {
    resolved = await fetchTopMatches({ sectors: prefSectors, stages: [], topN: TOP_N });
  }
  if (resolved.length === 0 && prefSectors.length > 0) {
    resolved = await fetchTopMatches({ sectors: [], stages: [], topN: TOP_N });
  }

  if (resolved.length === 0) {
    console.log(`  ⚠️  No matches for ${email} — skipping`);
    return { sent: false, skipped: true };
  }

  const html = buildEmail(resolved, name || email.split('@')[0], {
    sectors: prefSectors,
    stages: prefStages,
  });
  const hotCount = resolved.filter((m) => m.urgency === 'high').length;
  const subject = `[Pythh] ${resolved.length} thesis-matched startups this week${hotCount ? ' 🔥' : ''}`;

  if (DRY_RUN) {
    console.log(`  📧 DRY RUN — would send to: ${email}`);
    console.log(`     Subject: ${subject}`);
    console.log(`     Matches: ${resolved.length} (hot: ${hotCount})`);
    return { sent: false, skipped: false, dryRun: true };
  }

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    html,
  });

  if (error) {
    console.error(`  ❌ Failed ${email}:`, error.message);
    return { sent: false, skipped: false, error: error.message };
  }

  await logDigestSent({
    investorId: id,
    email,
    matchCount: resolved.length,
    hotCount,
    resendId: data?.id,
  });

  console.log(`  ✅ Sent to ${email} (id: ${data?.id}) — ${resolved.length} matches, ${hotCount} hot`);
  return { sent: true, skipped: false };
}

async function loadRecipients(mode) {
  if (mode !== 'all' && mode !== 'signed-up') return null;

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  let investorIds = new Set();

  if (mode === 'signed-up') {
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
  }

  let query = sb
    .from('investors')
    .select('id, name, email, sectors, stage, geography_focus, status, created_at')
    .not('email', 'is', null)
    .not('email', 'eq', '')
    .limit(1000);

  if (mode === 'signed-up' && investorIds.size > 0) {
    query = query.in('id', [...investorIds]);
  } else if (mode === 'signed-up') {
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

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Pythh Investor Dealflow Digest', DRY_RUN ? '(DRY RUN)' : '');
  console.log(
    ' Date:',
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  );
  console.log('═══════════════════════════════════════════════════════════════');

  if (TO_ARG === 'all' || TO_ARG === 'signed-up') {
    const investors = await loadRecipients(TO_ARG);
    console.log(`\n📧 Batch mode (${TO_ARG}): ${investors.length} recipients\n`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const inv of investors) {
      try {
        const result = await sendToInvestor({
          id: inv.id,
          email: inv.email,
          name: inv.name,
          sectors: inv.sectors,
          stages: inv.stage,
        });
        if (result.sent) sent++;
        else if (result.skipped) skipped++;
        else if (result.error) failed++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error(`  ⚠️  Error for ${inv.email}:`, e.message);
        failed++;
      }
    }

    console.log(`\n✅ Batch complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
    return;
  }

  await sendToInvestor({
    id: null,
    email: TO_ARG,
    name: argVal('--name', ''),
    sectors: SECTORS_ARG || '',
    stages: STAGES_ARG || '',
  });

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
