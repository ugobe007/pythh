/**
 * portfolio-digest.mjs
 * =====================================================================
 * Pythh Portfolio Management Agent — Daily Digest + Auto-Seed
 *
 * Runs after portfolio-monitor (scheduled 6:30 AM UTC via PM2).
 *
 * What it does:
 *   0. GUARDRAILS — heal corrupted GOD scores on active portfolio holdings (SSOT hotGod)
 *   1. AUTO-SEED  — finds qualified GOD≥72 startups not yet tracked,
 *                   adds up to MAX_NEW_SEEDS per run to virtual_portfolio
 *   2. DIGEST     — queries last 24h events, Review-tier companies,
 *                   GOD score movements, and portfolio metrics
 *   3. EMAIL      — sends digest to PORTFOLIO_DIGEST_EMAIL via GoDaddy SMTP
 *                   (or Resend if RESEND_API_KEY is set) with /portfolio/:id links
 *
 * Schedule: 6:30 AM UTC daily via PM2 (ecosystem.prod.config.js)
 * Run manually: node scripts/portfolio-digest.mjs
 * Dry run:      node scripts/portfolio-digest.mjs --dry-run
 * No email:     node scripts/portfolio-digest.mjs --no-email
 */

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';
dotenv.config();

const require = createRequire(import.meta.url);
const { healPortfolioHoldings, isCorrupted } = require('../lib/portfolioScoreGuardrails.js');

const DRY_RUN  = process.argv.includes('--dry-run');
const NO_EMAIL = process.argv.includes('--no-email') || DRY_RUN;
const MAX_NEW_SEEDS    = 5;     // max new picks to add per run
const MIN_GOD_SEED     = 72;    // minimum GOD score for auto-seed
const VIRTUAL_CHECK    = 100_000; // $100K virtual check per pick
const SITE_BASE        = process.env.SITE_URL || 'https://pythh.ai';
const DIGEST_EMAIL     = process.env.PORTFOLIO_DIGEST_EMAIL || process.env.ADMIN_EMAIL || '';
const RESEND_KEY       = process.env.RESEND_API_KEY || '';
const SMTP_HOST        = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT        = Number(process.env.SMTP_PORT || 587);
const SMTP_USER        = process.env.SMTP_USER || '';
const SMTP_PASS        = process.env.SMTP_PASS || '';
const FROM_ADDRESS     = process.env.SMTP_FROM || SMTP_USER || 'bob@pythh.ai';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUSD(n) {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function estimateValuation(godScore) {
  // Rough heuristic: GOD 70 ≈ $8M, GOD 85 ≈ $25M, GOD 100 ≈ $80M
  if (godScore >= 95) return 80_000_000;
  if (godScore >= 90) return 50_000_000;
  if (godScore >= 85) return 30_000_000;
  if (godScore >= 80) return 18_000_000;
  if (godScore >= 75) return 12_000_000;
  return 8_000_000;
}

function eventEmoji(type) {
  const map = {
    funding_round:     '💰',
    acquisition:       '🏢',
    ipo:               '📈',
    revenue_milestone: '💵',
    product_launch:    '🚀',
    team_milestone:    '👥',
    god_score_change:  '📊',
    prediction_hit:    '🎯',
  };
  return map[type] || '📌';
}

function tierEmoji(tier) {
  return tier === 'review' ? '⚠️' : tier === 'watch' ? '👀' : '✅';
}

// ─── Step 1: Auto-seed new GOD≥70 picks ─────────────────────────────────────

async function autoSeed() {
  console.log('\n🌱 Auto-seed check (GOD ≥', MIN_GOD_SEED, ')');

  // Get all startup_ids already tracked
  const { data: existing } = await sb
    .from('virtual_portfolio')
    .select('startup_id')
    .in('status', ['active', 'acquired', 'ipo', 'exited', 'written_off']);
  const trackedIds = new Set((existing || []).map(r => r.startup_id));

  // Find top qualified startups not yet tracked
  const { data: candidates, error } = await sb
    .from('startup_uploads')
    .select('id, name, website, sectors, stage, total_god_score, team_score, traction_score, market_score')
    .eq('entity_gate', 'qualified')
    .gte('total_god_score', MIN_GOD_SEED)
    .not('name', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(200);

  if (error) { console.error('  ✗ Seed query failed:', error.message); return []; }

  const toSeed = (candidates || [])
    .filter(c => !trackedIds.has(c.id) && c.name?.trim())
    .filter(c => !isCorrupted(c))
    .slice(0, MAX_NEW_SEEDS);

  if (toSeed.length === 0) {
    console.log('  → No new candidates to seed');
    return [];
  }

  console.log(`  → ${toSeed.length} new picks to add`);
  const seeded = [];

  for (const c of toSeed) {
    const entryVal = estimateValuation(c.total_god_score);
    const payload = {
      startup_id:          c.id,
      entry_god_score:     c.total_god_score,
      entry_stage:         c.stage ? String(c.stage) : null,
      entry_valuation_usd: entryVal,
      current_valuation_usd: entryVal,
      virtual_check_usd:   VIRTUAL_CHECK,
      moic:                1.0,
      entry_rationale:     `Auto-seeded by portfolio-digest agent. Entry GOD score: ${c.total_god_score}.`,
      added_by:            'portfolio-digest',
    };

    if (DRY_RUN) {
      console.log(`  [DRY] Would seed: ${c.name} (GOD ${c.total_god_score}, val ${fmtUSD(entryVal)})`);
      seeded.push({ name: c.name, godScore: c.total_god_score, valuation: entryVal, id: c.id });
      continue;
    }

    const { error: insErr } = await sb.from('virtual_portfolio').insert(payload);
    if (insErr) {
      console.error(`  ✗ Failed to seed ${c.name}:`, insErr.message);
    } else {
      console.log(`  ✅ Seeded: ${c.name} (GOD ${c.total_god_score})`);
      seeded.push({ name: c.name, godScore: c.total_god_score, valuation: entryVal, id: c.id });
    }
  }

  return seeded;
}

// ─── Step 2: Collect digest data ─────────────────────────────────────────────

async function collectDigestData() {
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d  = new Date(Date.now() - 7  * 86_400_000).toISOString();

  const [
    { data: recentEvents },
    { data: reviewCompanies },
    { data: metrics },
    { data: godChanges },
    { data: topPicks },
  ] = await Promise.all([
    // Events in last 24h
    sb.from('portfolio_events')
      .select('startup_id, event_type, event_date, headline, amount_usd, round_type, lead_investor, verified')
      .gte('created_at', since24h)
      .neq('event_type', 'noise')
      .order('event_date', { ascending: false })
      .limit(20),

    // Companies in Review tier
    sb.from('portfolio_health')
      .select('startup_id, startup_name, entry_god_score, current_god_score, god_delta, health_tier, days_since_last_event, sector_god_percentile, goldilocks_alignment, moic')
      .eq('health_tier', 'review')
      .eq('status', 'active')
      .order('god_delta', { ascending: true })
      .limit(10),

    // Portfolio metrics
    sb.from('portfolio_metrics').select('*').maybeSingle(),

    // Significant GOD score changes in last 7 days
    sb.from('portfolio_events')
      .select('startup_id, headline, god_score_before, god_score_after, event_date')
      .eq('event_type', 'god_score_change')
      .gte('event_date', since7d)
      .order('event_date', { ascending: false })
      .limit(10),

    // Top picks by MOIC for the summary
    sb.from('portfolio_health')
      .select('startup_name, moic, irr_annualized, health_tier, status, startup_id')
      .eq('status', 'active')
      .order('moic', { ascending: false })
      .limit(5),
  ]);

  return { recentEvents, reviewCompanies, metrics, godChanges, topPicks };
}

// ─── Step 3: Build email HTML ─────────────────────────────────────────────────

function buildEmailHtml({ recentEvents, reviewCompanies, metrics, godChanges, topPicks, newSeeds }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const sectionHeader = (emoji, title) =>
    `<h2 style="color:#22c55e;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:32px 0 12px;border-bottom:1px solid #1f2937;padding-bottom:8px;">${emoji} ${title}</h2>`;

  const pill = (text, color = '#6b7280') =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44;">${text}</span>`;

  const link = (href, text) =>
    `<a href="${href}" style="color:#22c55e;text-decoration:none;">${text}</a>`;

  // ── Metrics bar
  const m = metrics || {};
  const metricsHtml = `
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:16px 0;">
      ${[
        ['Total Picks',  m.total_picks ?? '—'],
        ['Active',       m.active_picks ?? '—'],
        ['Verified',     m.verified_funded_picks != null ? `${m.verified_funded_picks}${m.verified_funded_rate_pct ? ` (${m.verified_funded_rate_pct}%)` : ''}` : '—'],
        ['Funded',       m.funded_picks != null ? `${m.funded_picks}${m.funded_rate_pct ? ` (${m.funded_rate_pct}%)` : ''}` : '—'],
        ['Exited',       m.successful_exits ?? '—'],
        ['Avg MOIC',     m.avg_moic ? `${m.avg_moic}×` : '—'],
      ].map(([label, val]) => `
        <div style="background:#111827;border:1px solid #1f2937;border-radius:8px;padding:12px;text-align:center;">
          <div style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${label}</div>
          <div style="color:#f9fafb;font-size:20px;font-weight:700;">${val}</div>
        </div>`).join('')}
    </div>`;

  // ── New events
  let eventsHtml = '';
  if (recentEvents?.length) {
    eventsHtml = sectionHeader('📡', `New Signals Detected (${recentEvents.length})`) +
      recentEvents.map(e => `
        <div style="border:1px solid #1f2937;border-radius:8px;padding:12px;margin-bottom:8px;background:#0f172a;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span>${eventEmoji(e.event_type)}</span>
            ${pill(e.event_type.replace(/_/g, ' '), e.event_type === 'funding_round' ? '#22c55e' : e.event_type === 'acquisition' ? '#a78bfa' : '#60a5fa')}
            ${e.verified ? pill('✓ verified', '#22c55e') : ''}
          </div>
          <p style="color:#f9fafb;font-size:13px;margin:4px 0 6px;">${e.headline || '—'}</p>
          <div style="display:flex;gap:12px;font-size:11px;color:#6b7280;">
            ${e.amount_usd ? `<span>💰 ${fmtUSD(e.amount_usd)}</span>` : ''}
            ${e.lead_investor ? `<span>Led by ${e.lead_investor}</span>` : ''}
            ${e.round_type ? `<span>${e.round_type}</span>` : ''}
            <span>${new Date(e.event_date).toLocaleDateString()}</span>
            ${link(`${SITE_BASE}/portfolio/${e.startup_id}`, '→ View dossier')}
          </div>
        </div>`).join('');
  } else {
    eventsHtml = sectionHeader('📡', 'Signals (Last 24h)') +
      `<p style="color:#6b7280;font-size:13px;">No new events detected. Monitor runs daily at 6 AM UTC.</p>`;
  }

  // ── Review tier
  let reviewHtml = '';
  if (reviewCompanies?.length) {
    reviewHtml = sectionHeader('⚠️', `Review Tier — Action Needed (${reviewCompanies.length})`) +
      reviewCompanies.map(c => `
        <div style="border:1px solid #7f1d1d;border-radius:8px;padding:12px;margin-bottom:8px;background:#0f172a;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <span style="color:#f9fafb;font-weight:600;font-size:13px;">${c.startup_name}</span>
              ${c.god_delta != null ? `<span style="color:${c.god_delta < 0 ? '#f87171' : '#4ade80'};font-size:12px;margin-left:8px;">ΔGOD ${c.god_delta > 0 ? '+' : ''}${c.god_delta}</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              ${c.moic ? pill(`${c.moic}× MOIC`, '#6b7280') : ''}
              ${c.sector_god_percentile != null ? pill(`${Math.round(c.sector_god_percentile)}th pct`, '#6b7280') : ''}
            </div>
          </div>
          ${c.goldilocks_alignment === 'thin_signals' ? `<p style="color:#fbbf24;font-size:11px;margin:4px 0 0;border-left:2px solid #fbbf24;padding-left:8px;">Goldilocks: maturity thin vs GOD</p>` : ''}
          ${c.days_since_last_event != null ? `<p style="color:#6b7280;font-size:11px;margin:4px 0 0;">Last signal: ${c.days_since_last_event}d ago</p>` : ''}
          <div style="margin-top:8px;">${link(`${SITE_BASE}/portfolio/${c.startup_id}`, '→ View full dossier')}</div>
        </div>`).join('');
  }

  // ── GOD score changes
  let godHtml = '';
  if (godChanges?.length) {
    godHtml = sectionHeader('📊', `GOD Score Movements (7 days)`) +
      `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        ${godChanges.map(g => {
          const delta = (g.god_score_after || 0) - (g.god_score_before || 0);
          return `<tr style="border-bottom:1px solid #1f2937;">
            <td style="padding:8px 0;color:#f9fafb;">${g.headline || '—'}</td>
            <td style="padding:8px 0;text-align:right;color:${delta >= 0 ? '#4ade80' : '#f87171'};font-weight:700;">
              ${delta > 0 ? '+' : ''}${delta}
            </td>
            <td style="padding:8px 0 8px 12px;color:#6b7280;">${new Date(g.event_date).toLocaleDateString()}</td>
            <td style="padding:8px 0 8px 12px;">${link(`${SITE_BASE}/portfolio/${g.startup_id}`, '→')}</td>
          </tr>`;
        }).join('')}
      </table>`;
  }

  // ── New seeds
  let seedsHtml = '';
  if (newSeeds?.length) {
    seedsHtml = sectionHeader('🌱', `Auto-Seeded (${newSeeds.length} New Picks)`) +
      newSeeds.map(s => `
        <div style="border:1px solid #14532d;border-radius:8px;padding:10px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#f9fafb;font-size:13px;font-weight:600;">${s.name}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            ${pill(`GOD ${s.godScore}`, '#22c55e')}
            <span style="color:#6b7280;font-size:12px;">Entry val: ${fmtUSD(s.valuation)}</span>
          </div>
        </div>`).join('');
  }

  // ── Top performers
  let topHtml = '';
  if (topPicks?.length) {
    topHtml = sectionHeader('🏆', 'Top Performers by MOIC') +
      `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr style="color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-size:10px;">
          <th style="text-align:left;padding:6px 0;">Company</th>
          <th style="text-align:right;padding:6px;">MOIC</th>
          <th style="text-align:right;padding:6px;">IRR</th>
          <th style="text-align:left;padding:6px 12px;">Tier</th>
        </tr>
        ${topPicks.map(p => `
          <tr style="border-top:1px solid #1f2937;">
            <td style="padding:8px 0;">${link(`${SITE_BASE}/portfolio/${p.startup_id}`, p.startup_name)}</td>
            <td style="text-align:right;padding:8px 6px;color:#4ade80;font-weight:700;">${p.moic ? `${p.moic}×` : '1.00×'}</td>
            <td style="text-align:right;padding:8px 6px;color:#6b7280;">${p.irr_annualized ? `${(p.irr_annualized * 100).toFixed(0)}%` : '—'}</td>
            <td style="padding:8px 12px;">${tierEmoji(p.health_tier)} ${p.health_tier}</td>
          </tr>`).join('')}
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#030712;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;">

    <!-- Header -->
    <div style="border-bottom:1px solid #1f2937;padding-bottom:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="color:#22c55e;font-weight:900;font-size:18px;letter-spacing:1px;">PYTHIA</span>
        <span style="color:#1f2937;">|</span>
        <span style="color:#6b7280;font-size:14px;">Portfolio Digest</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;">${date}</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">Automated daily intelligence report · ${link(`${SITE_BASE}/portfolio`, 'View full portfolio →')}</p>
    </div>

    <!-- Metrics -->
    ${sectionHeader('📊', 'Portfolio Overview')}
    ${metricsHtml}

    <!-- Events -->
    ${eventsHtml}

    <!-- New seeds -->
    ${seedsHtml}

    <!-- Review tier -->
    ${reviewHtml}

    <!-- GOD changes -->
    ${godHtml}

    <!-- Top performers -->
    ${topHtml}

    <!-- Footer -->
    <div style="border-top:1px solid #1f2937;margin-top:40px;padding-top:20px;text-align:center;">
      <p style="color:#374151;font-size:11px;margin:0;">
        PYTHIA Portfolio Agent · ${link(`${SITE_BASE}/portfolio`, 'pythh.ai/portfolio')} ·
        ${link(`${SITE_BASE}/admin`, 'Admin dashboard')}
      </p>
      <p style="color:#1f2937;font-size:10px;margin:8px 0 0;">
        This digest runs daily at 6:30 AM UTC. To change frequency or recipient, update PORTFOLIO_DIGEST_EMAIL in .env.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Step 4: Send email (GoDaddy SMTP preferred, Resend fallback) ────────────

function buildDigestSubject({ recentEvents, reviewCompanies, newSeeds }) {
  const evCount  = recentEvents?.length ?? 0;
  const revCount = reviewCompanies?.length ?? 0;
  const newCount = newSeeds?.length ?? 0;

  const subjectParts = [];
  if (evCount)  subjectParts.push(`${evCount} signal${evCount > 1 ? 's' : ''}`);
  if (revCount) subjectParts.push(`${revCount} in Review`);
  if (newCount) subjectParts.push(`${newCount} new pick${newCount > 1 ? 's' : ''}`);
  return subjectParts.length
    ? `Portfolio Digest: ${subjectParts.join(' · ')}`
    : 'Portfolio Digest: Daily update';
}

async function sendViaSmtp(subject, html) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to: DIGEST_EMAIL,
    subject,
    html,
  });

  console.log(`\n📧 Digest sent to ${DIGEST_EMAIL} via SMTP (${info.messageId})`);
}

async function sendViaResend(subject, html) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    FROM_ADDRESS,
      to:      [DIGEST_EMAIL],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  console.log(`\n📧 Digest sent to ${DIGEST_EMAIL} via Resend (id: ${data.id})`);
}

async function sendDigestEmail(html, meta) {
  if (!DIGEST_EMAIL) {
    console.log('\n⚠️  No PORTFOLIO_DIGEST_EMAIL — email not sent (set it in .env)');
    return;
  }

  const subject = buildDigestSubject(meta);

  // Resend first when configured (M365 Security Defaults often block SMTP)
  if (RESEND_KEY) {
    try {
      await sendViaResend(subject, html);
      return;
    } catch (err) {
      console.error('\n❌ Resend error:', err.message);
      if (!SMTP_USER || !SMTP_PASS) return;
      console.log('   Falling back to SMTP…');
    }
  }

  if (SMTP_USER && SMTP_PASS) {
    try {
      await sendViaSmtp(subject, html);
      return;
    } catch (err) {
      console.error('\n❌ SMTP error:', err.message);
    }
  }

  if (!RESEND_KEY && !SMTP_USER) {
    console.log('\n⚠️  No email sender configured — set RESEND_API_KEY or SMTP_USER/SMTP_PASS');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date();
  console.log(`\n🔭 Pythh Portfolio Digest Agent — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} — ${startedAt.toISOString()}`);
  console.log('═'.repeat(60));

  // 0. Heal corrupted scores before seed/digest (legacy scorer damage, missing floor)
  if (!DRY_RUN) {
    console.log('\n🛡️  Portfolio score guardrails…');
    const heal = await healPortfolioHoldings(sb, { dryRun: false, log: (m) => console.log(m) });
    console.log(`   Checked ${heal.checked} | Healed ${heal.healed} | OK ${heal.ok}`);
    if (heal.errors.length) {
      heal.errors.forEach((e) => console.warn(`   ⚠️  ${e.startup_id}: ${e.message}`));
    }
  }

  // 1. Auto-seed new picks
  const newSeeds = await autoSeed();

  // 2. Collect digest data
  console.log('\n📊 Collecting digest data…');
  const { recentEvents, reviewCompanies, metrics, godChanges, topPicks } = await collectDigestData();

  console.log(`   New events (24h):    ${recentEvents?.length ?? 0}`);
  console.log(`   Review tier:         ${reviewCompanies?.length ?? 0}`);
  console.log(`   GOD changes (7d):    ${godChanges?.length ?? 0}`);
  console.log(`   Top performers:      ${topPicks?.length ?? 0}`);
  console.log(`   New seeds this run:  ${newSeeds.length}`);

  // 3. Build email
  const html = buildEmailHtml({ recentEvents, reviewCompanies, metrics, godChanges, topPicks, newSeeds });

  // 4. Send (unless dry-run or --no-email)
  if (NO_EMAIL) {
    console.log('\n📧 Email skipped (dry-run / --no-email)');
    if (DRY_RUN) {
      // Print summary instead
      console.log('\n── DIGEST PREVIEW ──────────────────────────────');
      console.log(`Events (24h): ${recentEvents?.length ?? 0}`);
      if (recentEvents?.length) recentEvents.forEach(e => console.log(`  ${eventEmoji(e.event_type)} ${e.headline?.slice(0, 70)}`));
      console.log(`Review tier (${reviewCompanies?.length ?? 0}):`);
      if (reviewCompanies?.length) reviewCompanies.forEach(c => console.log(`  ⚠️  ${c.startup_name} ΔGOD=${c.god_delta}`));
    }
  } else {
    await sendDigestEmail(html, { recentEvents, reviewCompanies, newSeeds });
  }

  // 5. Log to ai_logs
  if (!DRY_RUN) {
    const { error: logErr } = await sb.from('ai_logs').insert({
      type:   'portfolio_digest',
      action: 'daily_run',
      status: 'success',
      output: {
        events_24h:   recentEvents?.length ?? 0,
        review_count: reviewCompanies?.length ?? 0,
        god_changes:  godChanges?.length ?? 0,
        new_seeds:    newSeeds.length,
        email_sent:   !NO_EMAIL && !!DIGEST_EMAIL,
        duration_ms:  Date.now() - startedAt.getTime(),
      },
    });
    if (logErr) console.warn('[portfolio-digest] ai_logs insert failed:', logErr.message);
  }

  const duration = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  console.log(`\n✅ Digest agent complete in ${duration}s`);
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
