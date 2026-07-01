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
      ? `Target: ${invLabel}. I'll review thesis fit, messaging, and timing — the three things that decide whether a meeting lands or gets a polite pass.`
      : `I'll review your top thesis-fit investors and suggest who to prioritize and how to frame the conversation.`,
    ``,
    note ? `Your note: "${note}"` : '',
    note ? `` : '',
    `Expect a reply within 2 business days with specific framing notes. In the meantime, your ranked shortlist is here:`,
    `${APP_BASE}/activate${startupUrl ? `?startup=${encodeURIComponent(startupUrl)}` : ''}`,
    ``,
    `— ${OUTREACH_AGENT_NAME}`,
    `Match Advisor · Pythh`,
  ].filter(Boolean).join('\n');

  const founderHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#334155;line-height:1.6;">
      <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${OUTREACH_AGENT_NAME} · Pythh Match Desk</p>
      <p>Hi —</p>
      <p>I received your intro request for <strong>${startupName}</strong>.</p>
      <p>${
        investor?.name
          ? `Target: <strong>${invLabel}</strong>. I'll review thesis fit, messaging, and timing — the three things that decide whether a meeting lands or gets a polite pass.`
          : `I'll review your top thesis-fit investors and suggest who to prioritize and how to frame the conversation.`
      }</p>
      ${note ? `<p style="color:#64748b;font-size:14px;"><em>Your note:</em> ${note.replace(/</g, '&lt;')}</p>` : ''}
      <p>Expect a reply within <strong>2 business days</strong> with specific framing notes.</p>
      <p><a href="${APP_BASE}/activate${startupUrl ? `?startup=${encodeURIComponent(startupUrl)}` : ''}" style="color:#16a34a;">View your ranked shortlist →</a></p>
      <p style="color:#94a3b8;font-size:13px;">— ${OUTREACH_AGENT_NAME}<br>Match Advisor · Pythh</p>
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
