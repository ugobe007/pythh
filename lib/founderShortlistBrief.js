'use strict';

const { soonestExpiry, formatMatchDate } = require('./matchExpiry');

let tools = null;

function founderTools() {
  if (tools) return tools;
  try {
    require('tsx/cjs');
  } catch {
    // The API process already runs under tsx.
  }
  tools = require('../site/lib/founderFreeTools.ts');
  return tools;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clip(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function asSectors(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function matchLabel(match) {
  const name = String(match?.investor?.name || match?.investor?.firm || '').trim();
  const firm = String(match?.investor?.firm || '').trim();
  if (name && firm && firm !== name) return `${name} · ${firm}`;
  return name || firm || 'Investor';
}

function expiryCopy(expiry) {
  if (!expiry) {
    return 'These matches stay current for 7 days after they are saved. Alignment is a moment in time. Next week it moves with investor focus and the market. Start the campaign on your profile before the list goes stale.';
  }
  const date = formatMatchDate(expiry.expires_at);
  if (expiry.stale) {
    return `These matches expired on ${date}. Alignment was a moment, and it has gone stale. Open your profile before you raise on this list.`;
  }
  return `These matches expire on ${date}. Alignment holds for 7 days. Next week investor focus and the market move, and this list goes stale. Start the campaign on your profile before then.`;
}

/**
 * Founder email: top 5, deck, positioning, advisors, profile link, 7-day expiry.
 * Positioning examples are omitted so later-stage market-tape names stay out of the mail.
 * @param {object} input
 */
function buildFounderShortlistBrief(input) {
  const { buildDeckAssessment, buildPositioning, buildAdvisorMatches } = founderTools();
  const now = input.now instanceof Date ? input.now : new Date();
  const startupName = String(input.startupName || 'your startup').trim() || 'your startup';
  const sectors = asSectors(input.sectors);
  const matches = Array.isArray(input.matches) ? input.matches : [];
  const top = matches.slice(0, 5);
  const profileUrl = String(input.profileUrl || 'https://pythh.ai/account');
  const toolInput = {
    startupName,
    tagline: input.tagline || null,
    description: input.description || null,
    sectors,
    stage: input.stage || null,
    scoreComponents: input.scoreComponents || null,
    matches: top,
  };

  const deck = buildDeckAssessment(toolInput);
  const positioning = buildPositioning(toolInput, []);
  const advisors = buildAdvisorMatches(matches);
  const expiry = soonestExpiry(
    matches.map((match) => ({ created_at: match.created_at || match.matched_at })),
    now,
  );
  const expiryLine = expiryCopy(expiry);
  const dateLabel = expiry ? formatMatchDate(expiry.expires_at) : '';
  const subject = dateLabel
    ? `${startupName} — 5 matches ${expiry.stale ? 'expired' : 'expire'} ${dateLabel}`
    : `${startupName} — 5 matches, deck, positioning, advisors`;

  const matchLines = top.map((match, index) => {
    const score = typeof match.match_score === 'number' ? ` (${Math.round(match.match_score)})` : '';
    const why = clip(match.why_you_match);
    return `${index + 1}. ${matchLabel(match)}${score}${why ? ` — ${why}` : ''}`;
  });

  const deckLines = deck.map((item) => `• ${item.title}. ${item.body}`);
  const positionLines = [
    positioning.thesis,
    ...positioning.bullets.map((item) => `• ${item.title}. ${item.body}`),
  ];
  const advisorLines = advisors.advisors.length
    ? advisors.advisors.map((item) => {
        const who = item.firm ? `${item.name} · ${item.firm}` : item.name;
        return `• ${who} — ${clip(item.why)}`;
      })
    : [`• ${advisors.note}`];

  const text = [
    `Hi —`,
    ``,
    expiryLine,
    ``,
    `Top 5 matches for ${startupName}`,
    ...matchLines,
    ``,
    `Deck assessment`,
    ...deckLines,
    ``,
    `Positioning`,
    ...positionLines,
    ``,
    `Advisors`,
    ...advisorLines,
    advisors.advisors.length ? advisors.note : null,
    ``,
    `Open your profile: ${profileUrl}`,
    input.matchesUrl ? `Open the shortlist: ${input.matchesUrl}` : null,
    ``,
    `Sent from hello@orbital-ai.io so Gmail will keep it.`,
    `— Pythh`,
  ]
    .filter((line) => line != null)
    .join('\n');

  const matchRows = top
    .map((match, index) => {
      const score = typeof match.match_score === 'number' ? Math.round(match.match_score) : null;
      const why = clip(match.why_you_match);
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;color:#111;">${index + 1}. ${escapeHtml(matchLabel(match))}${
        score != null ? ` <span style="color:#666;">${score}</span>` : ''
      }${why ? `<div style="font-size:13px;color:#444;margin-top:2px;">${escapeHtml(why)}</div>` : ''}</td></tr>`;
    })
    .join('');

  const section = (title, body) =>
    `<h2 style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b21a8;margin:22px 0 8px;">${escapeHtml(title)}</h2>${body}`;

  const bullets = (items) =>
    `<ul style="margin:0;padding-left:18px;">${items
      .map(
        (item) =>
          `<li style="margin:0 0 8px;font-size:14px;color:#111;"><strong>${escapeHtml(item.title)}.</strong> ${escapeHtml(item.body)}</li>`,
      )
      .join('')}</ul>`;

  const advisorHtml = advisors.advisors.length
    ? `<ul style="margin:0;padding-left:18px;">${advisors.advisors
        .map((item) => {
          const who = item.firm ? `${item.name} · ${item.firm}` : item.name;
          return `<li style="margin:0 0 8px;font-size:14px;color:#111;"><strong>${escapeHtml(who)}</strong> — ${escapeHtml(clip(item.why))}</li>`;
        })
        .join('')}</ul><p style="font-size:13px;color:#444;">${escapeHtml(advisors.note)}</p>`
    : `<p style="font-size:14px;color:#111;">${escapeHtml(advisors.note)}</p>`;

  const html = `
    <div style="font-family: Helvetica Neue, Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #111; max-width: 560px;">
      <p style="margin:0 0 16px;padding:12px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fdba74;">${escapeHtml(expiryLine)}</p>
      ${section('Top 5 matches', matchRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${matchRows}</table>` : '<p>No matches on this shortlist yet.</p>')}
      ${section('Deck assessment', bullets(deck))}
      ${section(
        'Positioning',
        `<p style="margin:0 0 8px;font-size:15px;"><strong>${escapeHtml(positioning.thesis)}</strong></p>${bullets(positioning.bullets)}`,
      )}
      ${section('Advisors', advisorHtml)}
      <p style="margin-top:22px;"><a href="${escapeHtml(profileUrl)}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open my profile</a></p>
      ${
        input.matchesUrl
          ? `<p style="font-size:13px;"><a href="${escapeHtml(input.matchesUrl)}" style="color:#166534;">Open the shortlist</a></p>`
          : ''
      }
      <p style="color:#888;font-size:12px;margin-top:24px;">Sent from hello@orbital-ai.io until pythh.ai mail authentication is fixed.</p>
    </div>`;

  return { subject, text, html, expires_at: expiry?.expires_at ?? null, stale: expiry?.stale ?? false };
}

module.exports = { buildFounderShortlistBrief };
