'use strict';

const { buildPreviewOracleGap } = require('./previewOracleGap');
const { recordFunnelEvent } = require('./funnelTelemetry');

const EMAIL_FROM = process.env.EMAIL_FROM || 'Pythh <notifications@pythh.ai>';

function normalizeAppBase(raw) {
  const cleaned = String(raw || process.env.SITE_URL || 'https://pythh.ai')
    .trim()
    .replace(/^=+/, '');
  if (!/^https?:\/\//i.test(cleaned)) return 'https://pythh.ai';
  return cleaned.replace(/\/$/, '');
}

const APP_BASE = normalizeAppBase(process.env.APP_BASE_URL);

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function sendFounderActivationEmail({ to, startupName, startupId, oracleGap, wizardUrl, trialUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const gap = oracleGap || {};
  const top = gap.top_gap;
  const subject = top
    ? `Day 0: Oracle found ${gap.total_gaps || 1} gap${(gap.total_gaps || 1) > 1 ? 's' : ''} for ${startupName}`
    : `Day 0: Your Oracle pipeline is ready — ${startupName}`;

  const gapLines = top
    ? [
        `Oracle read: GOD ${gap.current_god_score} → ${gap.projected_god_if_top_fix ?? gap.projected_god_score} if you close the top gap.`,
        ``,
        `Top gap: ${top.title}`,
        top.partner_objection ? `Partner concern: ${top.partner_objection}` : '',
        `Fix this → ~${gap.investors_unlocked_if_top_fix ?? top.investors_unlocked_estimate} more thesis-fit investors.`,
      ].filter(Boolean)
    : [
        `Your GOD profile looks strong. Next step: unlock personalized outreach for your top matches.`,
      ];

  const text = [
    `Hi —`,
    ``,
    `You just activated Pythh for ${startupName}. Oracle mapped your gaps and locked outreach preview in the wizard.`,
    ``,
    ...gapLines,
    ``,
    `Step 1 — see your gap map: ${wizardUrl}`,
    `Step 2 — preview locked outreach (free): ${wizardUrl}?tab=round`,
    `Step 3 — start 7-day Oracle trial: ${trialUrl}`,
    ``,
    `— Pythh Oracle`,
  ].join('\n');

  const gapHtml = top
    ? `<div style="margin:16px 0;padding:14px;border-radius:8px;background:#1a1a2e;border:1px solid #7c3aed40;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a78bfa;">Oracle gap map</p>
        <p style="margin:0 0 6px;color:#fff;"><strong>GOD ${gap.current_god_score}</strong> → <strong>${gap.projected_god_if_top_fix ?? gap.projected_god_score}</strong></p>
        <p style="margin:0 0 6px;font-size:13px;color:#ccc;">${top.title}</p>
        ${top.partner_objection ? `<p style="margin:0;font-size:12px;color:#888;font-style:italic;">${String(top.partner_objection).replace(/</g, '&lt;')}</p>` : ''}
      </div>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">
      <p>Welcome — Oracle is working on <strong>${startupName}</strong>.</p>
      <p>Your gap map and locked outreach preview are ready. Fix gap #1 first — it's the highest-leverage move before warm intros.</p>
      ${gapHtml}
      <p>
        <a href="${wizardUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">Open gap map</a>
        <a href="${wizardUrl}?tab=round" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Preview outreach</a>
      </p>
      <p style="font-size:13px;"><a href="${trialUrl}" style="color:#7c3aed;">Start 7-day Oracle trial →</a></p>
    </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Resend error' };
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err.message || 'send failed' };
  }
}

async function recentlySentActivation(supabase, email, startupId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('ai_logs')
    .select('id')
    .eq('operation', 'founder_activation_email_sent')
    .gte('created_at', since)
    .contains('output', { email: email.trim().toLowerCase(), startup_id: startupId })
    .limit(1);
  return (data || []).length > 0;
}

/**
 * Day-0 founder activation email after /activate scan completes.
 */
async function sendFounderActivationNudge(supabase, { email, startupId, startupName, source }) {
  if (!isValidEmail(email) || !startupId) {
    return { success: false, error: 'email_and_startup_id_required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await recentlySentActivation(supabase, normalizedEmail, startupId)) {
    return { success: true, deduped: true };
  }

  const { data: startup } = await supabase
    .from('startup_uploads')
    .select(
      'id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors, stage',
    )
    .eq('id', startupId)
    .maybeSingle();

  if (!startup) return { success: false, error: 'startup_not_found' };

  const { count: matchCount } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId);

  const oracleGap = buildPreviewOracleGap(startup, matchCount || 0);
  const name = startupName || startup.name || 'your startup';
  const wizardUrl = `${APP_BASE}/activate?startup_id=${startupId}&welcome=1`;
  const trialUrl = `${APP_BASE}/pricing?trial=1&startup_id=${startupId}&source=activation_email`;

  const sendResult = await sendFounderActivationEmail({
    to: normalizedEmail,
    startupName: name,
    startupId,
    oracleGap,
    wizardUrl,
    trialUrl,
  });

  await recordFunnelEvent(supabase, 'founder_activation_email_sent', {
    email: normalizedEmail,
    startup_id: startupId,
    startup_name: name,
    source: source || 'activate_scan_complete',
    email_sent: sendResult.success,
    has_oracle_gap: Boolean(oracleGap?.top_gap),
    resend_message_id: sendResult.id || null,
  });

  if (!sendResult.success) {
    return { success: false, error: sendResult.error, captured: true };
  }

  return { success: true, message_id: sendResult.id, wizard_url: wizardUrl };
}

/** Welcome for new accounts without a startup scan yet — drives back to find-investors. */
async function sendFounderSignupInvite(supabase, { email, source }) {
  if (!isValidEmail(email)) {
    return { success: false, error: 'invalid_email' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('ai_logs')
    .select('id')
    .eq('operation', 'founder_signup_invite_sent')
    .gte('created_at', since)
    .contains('output', { email: normalizedEmail })
    .limit(1);
  if (recent?.length) return { success: true, deduped: true };

  const findUrl = `${APP_BASE}/find-investors?utm_source=email&utm_medium=nurture&utm_campaign=founder_signup_invite`;
  const subject = 'Your Pythh account is ready — paste your URL to see investor matches';
  const text = [
    'Hi —',
    '',
    'Your free Pythh founder account is active.',
    '',
    'Next step: paste your startup URL to get a ranked investor shortlist in ~20 seconds.',
    '',
    findUrl,
    '',
    'You can track fit scores, save your shortlist, and queue intros — all free to start.',
    '',
    '— Pythh Oracle',
  ].join('\n');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">
      <p>Your free Pythh account is active.</p>
      <p>Paste your startup URL to get a ranked investor shortlist in ~20 seconds — then track matches, movement alerts, and intro requests.</p>
      <p><a href="${findUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">See my investor matches</a></p>
    </div>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [normalizedEmail], subject, html, text }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Resend error' };

    await recordFunnelEvent(supabase, 'founder_signup_invite_sent', {
      email: normalizedEmail,
      source: source || 'founder_signup_page',
      email_sent: true,
      resend_message_id: data.id || null,
    });

    return { success: true, message_id: data.id };
  } catch (err) {
    return { success: false, error: err.message || 'send failed' };
  }
}

module.exports = {
  sendFounderActivationNudge,
  sendFounderSignupInvite,
  isValidEmail,
};
