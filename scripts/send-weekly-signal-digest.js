#!/usr/bin/env node
/**
 * PYTHH WEEKLY SIGNAL DIGEST
 * ════════════════════════════════════════════════════════════════════
 * Sends a curated weekly email digest to investors showing their
 * top signal-matched startups, ranked by score + urgency.
 *
 * Usage:
 *   node scripts/send-weekly-signal-digest.js --to investor@firm.com
 *   node scripts/send-weekly-signal-digest.js --to investor@firm.com --sectors "AI/ML,SaaS" --stages "Seed,Series A"
 *   node scripts/send-weekly-signal-digest.js --to all                    # batch send to all active investors
 *   node scripts/send-weekly-signal-digest.js --dry-run --to test@test.com
 *
 * Scheduled via cron (every Monday 8am):
 *   0 8 * * 1 cd /path/to/hot-honey && node scripts/send-weekly-signal-digest.js --to all >> logs/digest.log 2>&1
 * ════════════════════════════════════════════════════════════════════
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend   = new Resend(process.env.RESEND_API_KEY);

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = f => args.includes(f);

const TO_ARG      = argVal('--to');
const SECTORS_ARG = argVal('--sectors');
const STAGES_ARG  = argVal('--stages');
const TOP_N       = parseInt(argVal('--top', '10'), 10);
const DRY_RUN     = hasFlag('--dry-run');

if (!TO_ARG) {
  console.error('Usage: node scripts/send-weekly-signal-digest.js --to <email|all>');
  process.exit(1);
}

// ── Signal class labels ─────────────────────────────────────────────────────
const SIGNAL_LABELS = {
  fundraising_signal: 'Fundraising', acquisition_signal: 'Acquisition',
  exit_signal: 'Exit Prep',          distress_signal: 'Distress',
  revenue_signal: 'Revenue',         hiring_signal: 'Hiring',
  enterprise_signal: 'Enterprise',   expansion_signal: 'Expansion',
  gtm_signal: 'GTM Build',           demand_signal: 'Demand',
  growth_signal: 'Growth',           product_signal: 'Product',
  partnership_signal: 'Partnership', buyer_signal: 'Buying',
};

const TRAJ_LABELS = {
  fundraising_active: 'Fundraising',   gtm_expansion: 'GTM Expansion',
  growth: 'Growth',                    product_maturation: 'Product Build',
  exit_preparation: 'Exit Prep',       distress_survival: 'Distress',
  repositioning: 'Repositioning',      expansion: 'Expansion',
};

const URGENCY_EMOJI = { high: '🔴', medium: '🟡', low: '🟢' };

// ── Fetch top matches ────────────────────────────────────────────────────────
async function fetchTopMatches({ sectors = [], stages = [], topN = 10 }) {
  let query = supabase
    .from('pythh_top_matches')
    .select('*')
    .eq('match_type', 'capital_match')
    .order('match_score', { ascending: false })
    .limit(500);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];

  // Filter by sector preference
  if (sectors.length > 0) {
    rows = rows.filter(m =>
      (m.entity_sectors || []).some(s =>
        sectors.some(p => s.toLowerCase().includes(p.toLowerCase()))
      )
    );
  }

  // Filter by stage preference
  if (stages.length > 0) {
    rows = rows.filter(m =>
      stages.some(s => (m.entity_stage || '').toLowerCase().includes(s.toLowerCase()))
    );
  }

  // Sort: hot signals first, then by score
  rows.sort((a, b) => {
    const urgencyRank = { high: 3, medium: 2, low: 1 };
    const ua = urgencyRank[a.urgency] || 0;
    const ub = urgencyRank[b.urgency] || 0;
    if (ub !== ua) return ub - ua;
    return (b.match_score || 0) - (a.match_score || 0);
  });

  return rows.slice(0, topN);
}

// ── Build HTML email ─────────────────────────────────────────────────────────
function buildEmail(matches, recipientName = 'Investor', prefs = {}) {
  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hotCount = matches.filter(m => m.urgency === 'high').length;

  const prefsLine = [
    prefs.sectors?.length ? `Sectors: ${prefs.sectors.join(', ')}` : null,
    prefs.stages?.length  ? `Stage: ${prefs.stages.join(', ')}`    : null,
  ].filter(Boolean).join(' · ');

  const matchCards = matches.map((m, i) => {
    const scorePct      = Math.round((m.match_score || 0) * 100);
    const timingPct     = Math.round((m.timing_score || 0) * 100);
    const confPct       = Math.round((m.confidence || 0) * 100);
    const urgencyEmoji  = URGENCY_EMOJI[m.urgency] || '⚪';
    const signals       = (m.supporting_signals || []).slice(0, 3).map(s => SIGNAL_LABELS[s] || s.replace(/_/g, ' ')).join(' · ');
    const traj          = TRAJ_LABELS[m.trajectory_used] || (m.trajectory_used || '—').replace(/_/g, ' ');
    const reasons       = (m.explanation || []).slice(0, 2);
    const needs         = (m.predicted_need || []).slice(0, 3).join(', ');
    const sectors       = (m.entity_sectors || []).slice(0, 3).join(', ');
    const stage         = m.entity_stage || '';
    const bgColor       = i % 2 === 0 ? '#111111' : '#0e0e0e';

    return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:${bgColor};border:1px solid #222;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;">
              <!-- Header row -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:17px;font-weight:700;color:#ffffff;">${m.entity_name || '—'}</span>
                    ${stage ? `<span style="font-size:11px;background:#1a1a1a;border:1px solid #333;color:#888;padding:2px 8px;border-radius:20px;margin-left:8px;">${stage}</span>` : ''}
                    ${m.urgency === 'high' ? '<span style="font-size:11px;background:#422;border:1px solid #633;color:#f97316;padding:2px 8px;border-radius:20px;margin-left:4px;">🔥 Hot</span>' : ''}
                  </td>
                  <td align="right" style="white-space:nowrap;">
                    <span style="font-size:22px;font-weight:800;color:${scorePct >= 75 ? '#10b981' : scorePct >= 55 ? '#f59e0b' : '#f97316'};">${scorePct}%</span>
                    <span style="font-size:11px;color:#555;margin-left:4px;">match</span>
                  </td>
                </tr>
              </table>

              <!-- Sectors + trajectory -->
              <div style="margin-top:8px;">
                ${sectors ? `<span style="font-size:11px;color:#f59e0b;margin-right:8px;">${sectors}</span>` : ''}
                ${traj ? `<span style="font-size:11px;color:#888;background:#1a1a1a;padding:2px 6px;border-radius:4px;">${traj}</span>` : ''}
              </div>

              <!-- Score sub-metrics -->
              <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  ${[
                    ['Score', scorePct + '%', '#f59e0b'],
                    ['Timing', timingPct + '%', '#22d3ee'],
                    ['Confidence', confPct + '%', '#a78bfa'],
                    ['Urgency', `${urgencyEmoji} ${m.urgency || '—'}`, m.urgency === 'high' ? '#f97316' : '#888'],
                  ].map(([label, val, color]) => `
                    <td style="padding-right:20px;">
                      <div style="font-size:13px;font-weight:700;color:${color};">${val}</div>
                      <div style="font-size:10px;color:#555;">${label}</div>
                    </td>
                  `).join('')}
                </tr>
              </table>

              <!-- Signals detected -->
              ${signals ? `
              <div style="margin-top:12px;font-size:11px;color:#555;">
                Signals: <span style="color:#888;">${signals}</span>
              </div>` : ''}

              <!-- Why this match -->
              ${reasons.length > 0 ? `
              <ul style="margin:10px 0 0 0;padding:0 0 0 16px;">
                ${reasons.map(r => `<li style="font-size:12px;color:#777;margin-bottom:4px;">${r}</li>`).join('')}
              </ul>` : ''}

              <!-- Predicted needs + action -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px;">
                <tr>
                  <td style="font-size:11px;color:#555;">
                    ${needs ? `<strong style="color:#888;">Needs:</strong> ${needs}` : ''}
                  </td>
                  <td align="right">
                    <a href="https://www.pythh.ai/investor/signal-matches?q=${encodeURIComponent(m.entity_name || '')}"
                       style="display:inline-block;background:#f59e0b;color:#000;font-size:12px;font-weight:700;padding:7px 16px;border-radius:8px;text-decoration:none;">
                      View Match →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#080808;padding:40px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;">

      <!-- Header -->
      <tr><td style="padding:0 0 28px 0;border-bottom:1px solid #1a1a1a;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <span style="font-size:22px;font-weight:800;color:#f59e0b;">[pyth]</span>
              <span style="font-size:18px;font-weight:700;color:#ffffff;"> Signal Digest</span>
            </td>
            <td align="right" style="font-size:11px;color:#444;">${week}</td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:13px;color:#555;">
          Hi ${recipientName}, here are your top signal-matched startups this week.
        </p>
        ${prefsLine ? `<p style="margin:4px 0 0;font-size:11px;color:#3a3a3a;">${prefsLine}</p>` : ''}
      </td></tr>

      <!-- Stats bar -->
      <tr><td style="padding:16px 0 20px 0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#111;border:1px solid #1e1e1e;border-radius:10px;">
          <tr>
            ${[
              ['Matches', matches.length.toString(), '#f59e0b'],
              ['Hot signals', hotCount.toString(), '#f97316'],
              ['Avg score', Math.round(matches.reduce((s, m) => s + (m.match_score || 0), 0) / Math.max(matches.length, 1) * 100) + '%', '#10b981'],
            ].map(([label, val, color]) => `
              <td align="center" style="padding:12px;">
                <div style="font-size:20px;font-weight:800;color:${color};">${val}</div>
                <div style="font-size:10px;color:#555;">${label}</div>
              </td>
            `).join('')}
          </tr>
        </table>
      </td></tr>

      <!-- Match cards -->
      <tr><td>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${matchCards}
        </table>
      </td></tr>

      <!-- Footer CTA -->
      <tr><td style="padding:20px 0 0;border-top:1px solid #1a1a1a;text-align:center;">
        <a href="https://www.pythh.ai/investor/signal-matches"
           style="display:inline-block;background:#f59e0b;color:#000;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;margin-bottom:16px;">
          View Full Signal Feed →
        </a>
        <p style="font-size:11px;color:#333;margin:0;">
          You're receiving this because you have an investor profile on Pythh.
          <a href="#" style="color:#444;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Send to a single investor ────────────────────────────────────────────────
async function sendToInvestor({ email, name, sectors, stages }) {
  const prefSectors = sectors ? sectors.split(',').map(s => s.trim()) : [];
  const prefStages  = stages  ? stages.split(',').map(s => s.trim())  : [];

  const matches = await fetchTopMatches({ sectors: prefSectors, stages: prefStages, topN: TOP_N });

  if (matches.length === 0) {
    console.log(`  ⚠️  No matches found for ${email} — skipping.`);
    return;
  }

  const html = buildEmail(matches, name || email.split('@')[0], { sectors: prefSectors, stages: prefStages });
  const subject = `[Pythh] ${matches.length} signal-matched startups this week ${matches.some(m => m.urgency === 'high') ? '🔥' : ''}`;

  if (DRY_RUN) {
    console.log(`  📧 DRY RUN — would send to: ${email}`);
    console.log(`     Subject: ${subject}`);
    console.log(`     Matches: ${matches.length} (hot: ${matches.filter(m => m.urgency === 'high').length})`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: 'Pythh Signal Intelligence <alerts@resend.dev>',
    to:   email,
    subject,
    html,
  });

  if (error) {
    console.error(`  ❌ Failed to send to ${email}:`, error.message);
  } else {
    console.log(`  ✅ Sent to ${email} (id: ${data?.id}) — ${matches.length} matches, ${matches.filter(m => m.urgency === 'high').length} hot`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' PYTHH Weekly Signal Digest', DRY_RUN ? '(DRY RUN)' : '');
  console.log(' Date:', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  console.log('═══════════════════════════════════════════════════════════════');

  if (TO_ARG === 'all') {
    // Batch mode: send to all investors with email addresses
    console.log('\n📧 Batch mode: fetching investor list...');
    const { data: investors, error } = await supabase
      .from('investors')
      .select('id, name, email, sectors, stage, geography_focus')
      .not('email', 'is', null)
      .not('email', 'eq', '')
      .eq('status', 'active')
      .limit(1000);

    if (error) { console.error('Failed to load investors:', error.message); process.exit(1); }

    console.log(`  Found ${investors.length} active investors with email\n`);

    let sent = 0, skipped = 0;
    for (const inv of investors) {
      try {
        await sendToInvestor({
          email:   inv.email,
          name:    inv.name,
          sectors: (inv.sectors || []).join(','),
          stages:  (inv.stage || []).join(','),
        });
        sent++;
        // Rate limit: Resend free tier = 100 emails/day
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`  ⚠️  Error for ${inv.email}:`, e.message);
        skipped++;
      }
    }
    console.log(`\n✅ Batch complete. Sent: ${sent}, Skipped: ${skipped}`);
  } else {
    // Single recipient
    await sendToInvestor({
      email:   TO_ARG,
      name:    argVal('--name', ''),
      sectors: SECTORS_ARG || '',
      stages:  STAGES_ARG  || '',
    });
  }

  console.log('\nDone.\n');
})();
