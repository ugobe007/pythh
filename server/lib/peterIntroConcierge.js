'use strict';

const { recordFunnelEvent } = require('./funnelTelemetry');
const { getOutreachFromAddress } = require('../../lib/outreachFrom.js');
const { OUTREACH_AGENT_NAME, vcFromName } = require('../../lib/pythiaVoice.js');

const NOTIFY_TO = process.env.OUTREACH_NOTIFY_EMAIL || process.env.ALERT_EMAIL || 'ugobe07@gmail.com';
const APP_BASE = String(process.env.APP_BASE_URL || process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function investorLabel(investor) {
  if (!investor?.name) return 'Top thesis-fit match (unspecified)';
  const firm = investor.firm ? ` (${investor.firm})` : '';
  return `${investor.name}${firm}`;
}

async function sendPeterIntroConcierge({
  supabase,
  founderEmail,
  startupId,
  startupName,
  startupUrl,
  investor,
  note,
  source,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const fromAddress = getOutreachFromAddress();
  const fromName = vcFromName();
  const invLabel = investorLabel(investor);
  const subjectTeam = `Intro help: ${startupName} → ${invLabel}`;
  const subjectFounder = `Peter received your intro request — ${startupName}`;

  const teamText = [
    `${OUTREACH_AGENT_NAME} intro concierge request`,
    ``,
    `Founder: ${founderEmail}`,
    `Startup: ${startupName}${startupUrl ? ` (${startupUrl})` : ''}`,
    `Startup ID: ${startupId}`,
    `Investor target: ${invLabel}${investor?.id ? ` [${investor.id}]` : ''}`,
    `Source: ${source || 'preview'}`,
    note ? `Founder note: ${note}` : '',
    ``,
    `Reply to ${founderEmail} with thesis framing + next steps.`,
  ].filter(Boolean).join('\n');

  const founderText = [
    `Hi —`,
    ``,
    `This is ${OUTREACH_AGENT_NAME} at Pythh. I received your intro request for ${startupName}.`,
    ``,
    investor?.name
      ? `Target: ${invLabel}. I'll review why they surfaced — thesis fit, timing, and how to frame the conversation. Three things usually decide whether a meeting is worth having.`
      : `I'll review your top matches and explain why each surfaced — who to prioritize and how to frame it.`,
    ``,
    note ? `Your note: "${note}"` : '',
    note ? `` : '',
    `Expect a reply within 2 business days. I could be wrong on the fit — tell me if something looks off.`,
    `In the meantime, your ranked shortlist is here:`,
    `${APP_BASE}/activate${startupUrl ? `?startup=${encodeURIComponent(startupUrl)}&utm_source=peter&utm_medium=email&utm_campaign=intro_concierge` : '?utm_source=peter&utm_medium=email&utm_campaign=intro_concierge'}`,
    ``,
    `— ${OUTREACH_AGENT_NAME}`,
    `Venture Analyst · Pythh`,
  ].filter(Boolean).join('\n');

  const founderHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#334155;line-height:1.6;">
      <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${OUTREACH_AGENT_NAME} · Pythh</p>
      <p>Hi —</p>
      <p>I received your intro request for <strong>${startupName}</strong>.</p>
      <p>${
        investor?.name
          ? `Target: <strong>${invLabel}</strong>. I'll review why they surfaced — thesis fit, timing, and how to frame the conversation.`
          : `I'll review your top matches and explain why each surfaced — who to prioritize and how to frame it.`
      }</p>
      ${note ? `<p style="color:#64748b;font-size:14px;"><em>Your note:</em> ${note.replace(/</g, '&lt;')}</p>` : ''}
      <p>Expect a reply within <strong>2 business days</strong>. Tell me if we're missing something.</p>
      <p><a href="${APP_BASE}/activate${startupUrl ? `?startup=${encodeURIComponent(startupUrl)}` : ''}" style="color:#16a34a;">Take a look at your shortlist →</a></p>
      <p style="color:#94a3b8;font-size:13px;">— ${OUTREACH_AGENT_NAME}<br>Venture Analyst · Pythh</p>
    </div>`;

  async function resendSend(payload) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data };
    return { ok: true, id: data.id };
  }

  const teamResult = await resendSend({
    from: `${fromName} <${fromAddress}>`,
    to: [NOTIFY_TO],
    reply_to: founderEmail,
    subject: subjectTeam,
    text: teamText,
  });
  if (!teamResult.ok) return { success: false, error: teamResult.error, step: 'team_notify' };

  const founderResult = await resendSend({
    from: `${fromName} <${fromAddress}>`,
    to: [founderEmail],
    reply_to: NOTIFY_TO,
    subject: subjectFounder,
    html: founderHtml,
    text: founderText,
  });
  if (!founderResult.ok) return { success: false, error: founderResult.error, step: 'founder_confirm' };

  const logPayload = {
    founder_email: founderEmail,
    startup_id: startupId,
    startup_name: startupName,
    startup_url: startupUrl || null,
    investor_id: investor?.id || null,
    investor_name: investor?.name || null,
    investor_firm: investor?.firm || null,
    source: source || 'preview',
    has_note: Boolean(note),
  };

  void recordFunnelEvent(supabase, 'intro_concierge_requested', logPayload, { source: logPayload.source });
  if (investor?.id) {
    void recordFunnelEvent(supabase, 'match_intro_requested', {
      ...logPayload,
      concierge: true,
    }, { source: logPayload.source });
  }

  return {
    success: true,
    teamMessageId: teamResult.id,
    founderMessageId: founderResult.id,
  };
}

module.exports = {
  isValidEmail,
  sendPeterIntroConcierge,
};
