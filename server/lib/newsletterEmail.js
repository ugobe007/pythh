// --- FILE: server/lib/newsletterEmail.js ---
// Shared HTML/text builder for The Pythh Daily Brief email + unsubscribe tokens.
// Used by: scripts/send-daily-brief.js and POST /api/newsletter/send-digest.

'use strict';

// Unsubscribe uses a per-subscriber random token stored in the database
// (newsletter_subscribers.unsubscribe_token). This deliberately avoids any
// shared HMAC secret so the GitHub-Actions send job and the Fly server don't
// need a matching EMAIL_SECRET — only DB access (which both already have).
function unsubscribeUrl(token, baseUrl) {
  const base = (baseUrl || 'https://pythh.ai').replace(/\/+$/, '');
  if (!token) return `${base}/newsletter`;
  return `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ── HTML helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Palette tuned for email clients (no oklch — use hex fallbacks).
const C = {
  bg: '#0a0a0c',
  panel: '#121216',
  panel2: '#16161c',
  border: '#26262e',
  text: '#e7e7ea',
  white: '#ffffff',
  mute: '#9a9aa6',
  dim: '#6a6a76',
  green: '#34d399',
  gold: '#e0a83a',
  cyan: '#22d3ee',
  orange: '#f97316',
};

function scoreColor(n) {
  const v = Number(n) || 0;
  if (v >= 90) return C.green;
  if (v >= 75) return C.cyan;
  if (v >= 60) return C.gold;
  return C.dim;
}

function sectionHeader(label, accent) {
  return `<tr><td style="padding:28px 0 10px;">
    <div style="font:600 11px/1 'Helvetica Neue',Arial,sans-serif;letter-spacing:2.5px;text-transform:uppercase;color:${accent || C.mute};">${esc(label)}</div>
    <div style="height:1px;background:${C.border};margin-top:8px;"></div>
  </td></tr>`;
}

function chip(text, color) {
  return `<span style="display:inline-block;padding:2px 8px;margin:0 4px 4px 0;border-radius:5px;font:500 11px 'Helvetica Neue',Arial,sans-serif;color:${color || C.mute};border:1px solid ${(color || C.mute)}33;background:${(color || C.mute)}12;">${esc(text)}</span>`;
}

// ── Section renderers ─────────────────────────────────────────────────────────
function renderEditorial(nl) {
  const text = nl.editorial?.text || nl.editorial;
  if (!text) return '';
  return `<tr><td style="padding:4px 0 4px;">
    <div style="border-left:3px solid ${C.gold};padding:14px 18px;background:${C.panel2};border-radius:0 10px 10px 0;">
      <div style="font:700 12px 'Helvetica Neue',Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${C.gold};margin-bottom:8px;">PYTHIA's Take</div>
      <div style="font:400 16px/1.6 Georgia,'Times New Roman',serif;color:${C.text};">${esc(text)}</div>
    </div>
  </td></tr>`;
}

function renderHottest(nl) {
  const rows = (nl.hottestStartups || []).slice(0, 5);
  if (!rows.length) return '';
  const items = rows.map((s, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr>
        <td style="background:${C.panel};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;">
              <div style="font:700 16px 'Helvetica Neue',Arial,sans-serif;color:${C.white};">${i + 1}. ${esc(s.name)}</div>
              ${s.tagline ? `<div style="font:400 13px/1.5 'Helvetica Neue',Arial,sans-serif;color:${C.mute};margin-top:3px;">${esc(s.tagline)}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">
              <span style="font:800 20px 'Helvetica Neue',Arial,sans-serif;color:${scoreColor(s.total_god_score)};">${esc(s.total_god_score)}</span>
              <div style="font:600 9px 'Helvetica Neue',Arial,sans-serif;letter-spacing:1.5px;color:${C.dim};">GOD</div>
            </td>
          </tr></table>
          <div style="font:500 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:${C.green};margin-top:8px;">Why → ${esc(s.why)}</div>
        </td>
      </tr>
    </table>`).join('');
  return sectionHeader('Hottest Startups', C.green) + `<tr><td>${items}</td></tr>`;
}

function renderSignals(nl) {
  const s = nl.signalsThatMatter;
  if (!s || !s.dimensions?.length) return '';
  const bars = s.dimensions.map((d) => {
    const w = Math.max(3, Math.min(100, d.pct));
    const lead = d.key === s.leading?.key;
    const col = lead ? C.green : C.cyan;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
      <td width="160" style="font:${lead ? 700 : 500} 12px 'Helvetica Neue',Arial,sans-serif;color:${lead ? C.white : C.mute};vertical-align:middle;">${esc(d.label)}</td>
      <td style="vertical-align:middle;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${C.border};border-radius:4px;">
          <div style="width:${w}%;height:8px;background:${col};border-radius:4px;"></div>
        </td></tr></table>
      </td>
      <td width="40" style="text-align:right;font:600 11px 'Helvetica Neue',Arial,sans-serif;color:${col};vertical-align:middle;">${d.pct}%</td>
    </tr></table>`;
  }).join('');
  const exemplars = (s.exemplars || []).map((e) => chip(`${e.name} · ${e.total_god_score ?? '—'}`, C.green)).join('');
  return sectionHeader('Signals That Matter', C.cyan) + `<tr><td>
    <div style="background:${C.panel};border:1px solid ${C.border};border-radius:10px;padding:16px;">
      <div style="font:500 13px/1.5 'Helvetica Neue',Arial,sans-serif;color:${C.mute};margin-bottom:14px;">
        Dominant signal across ${s.coverage} tracked companies: <span style="color:${C.green};font-weight:700;">${esc(s.leading?.label)}</span> — ${esc(s.leading?.blurb)}.
      </div>
      ${bars}
      ${exemplars ? `<div style="margin-top:14px;font:600 10px 'Helvetica Neue',Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${C.dim};margin-bottom:6px;">Leading on this signal</div><div>${exemplars}</div>` : ''}
    </div>
  </td></tr>`;
}

function renderMatches(nl) {
  const rows = (nl.topMatches || nl.hotMatches || []).slice(0, 4);
  if (!rows.length) return '';
  const items = rows.map((m) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
      <td style="background:${C.panel};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font:700 14px 'Helvetica Neue',Arial,sans-serif;color:${C.white};">${esc(m.startup?.name || '—')}
            <span style="color:${C.dim};font-weight:400;"> &rarr; </span>
            <span style="color:${C.green};">${esc(m.investor?.firm_name || m.investor?.name || '—')}</span>
          </td>
          <td style="text-align:right;white-space:nowrap;font:800 16px 'Helvetica Neue',Arial,sans-serif;color:${C.orange};">${esc(m.match_score)}%</td>
        </tr></table>
        ${m.reasoning ? `<div style="font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:${C.mute};margin-top:6px;">${esc(m.reasoning)}</div>` : ''}
      </td>
    </tr></table>`).join('');
  return sectionHeader('Most Interesting Matches', C.orange) + `<tr><td>${items}</td></tr>`;
}

function renderMoneyMoves(nl) {
  const rows = (nl.moneyMoves || nl.fundingRounds || []).slice(0, 6);
  if (!rows.length) return '';
  const items = rows.map((r) => `
    <tr><td style="padding:9px 0;border-bottom:1px solid ${C.border};">
      <span style="font:700 14px 'Helvetica Neue',Arial,sans-serif;color:${C.white};">${esc(r.company)}</span>
      <span style="font:600 13px 'Helvetica Neue',Arial,sans-serif;color:${C.gold};"> ${esc(r.amount)}${r.stage ? ` · ${esc(r.stage)}` : ''}</span>
      ${r.investors?.length ? `<div style="font:400 12px 'Helvetica Neue',Arial,sans-serif;color:${C.dim};margin-top:2px;">${esc(r.investors.slice(0, 4).join(', '))}</div>` : ''}
    </td></tr>`).join('');
  return sectionHeader('Money Moves · New Investments', C.gold) + `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </td></tr>`;
}

function renderNews(nl, key, label) {
  const rows = (nl[key] || []).slice(0, 5);
  if (!rows.length) return '';
  const items = rows.map((n) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid ${C.border};">
      <a href="${esc(n.url)}" style="font:600 13px/1.5 'Helvetica Neue',Arial,sans-serif;color:${C.text};text-decoration:none;">${esc(n.title)}</a>
      <div style="font:400 11px 'Helvetica Neue',Arial,sans-serif;color:${C.dim};margin-top:2px;">${esc(n.source)}${n.company ? ` · ${esc(n.company)}` : ''}</div>
    </td></tr>`).join('');
  return sectionHeader(label, C.mute) + `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </td></tr>`;
}

// ── Main builders ───────────────────────────────────────────────────────────────
function buildBriefEmailHtml(nl, { siteUrl = 'https://pythh.ai', unsubscribeToken = '' } = {}) {
  const base = siteUrl.replace(/\/+$/, '');
  const unsub = unsubscribeToken ? unsubscribeUrl(unsubscribeToken, base) : `${base}/newsletter`;
  const date = nl.date || new Date().toISOString().split('T')[0];

  const body = [
    renderEditorial(nl),
    renderHottest(nl),
    renderSignals(nl),
    renderMatches(nl),
    renderMoneyMoves(nl),
    renderNews(nl, 'vcNews', 'VC & Capital News'),
    renderNews(nl, 'radarNews', 'On PYTHIA\u2019s Radar'),
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Pythh Daily Brief — ${esc(date)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="text-align:center;padding-bottom:6px;">
      <div style="font:800 26px 'Helvetica Neue',Arial,sans-serif;color:${C.white};letter-spacing:-0.5px;">pythh<span style="color:${C.green};">.</span></div>
      <div style="font:600 11px 'Helvetica Neue',Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:${C.gold};margin-top:4px;">The Daily Brief · ${esc(date)}</div>
      <div style="font:400 12px 'Helvetica Neue',Arial,sans-serif;color:${C.dim};margin-top:6px;">Signal intelligence for venture — who's hot, why, and where capital is moving.</div>
    </td></tr>
    ${body}
    <tr><td style="padding:28px 0 6px;text-align:center;">
      <a href="${esc(base)}/newsletter/${esc(date)}" style="display:inline-block;padding:13px 26px;background:${C.green};color:#062018;text-decoration:none;border-radius:9px;font:700 14px 'Helvetica Neue',Arial,sans-serif;">Read the full brief &rarr;</a>
      <div style="margin-top:14px;"><a href="${esc(base)}/activate" style="font:600 13px 'Helvetica Neue',Arial,sans-serif;color:${C.cyan};text-decoration:none;">Run PYTHIA on your startup</a></div>
    </td></tr>
    <tr><td style="padding:22px 0;text-align:center;border-top:1px solid ${C.border};margin-top:20px;">
      <div style="font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;color:${C.dim};">
        Pythh · Signal Intelligence for Venture<br>
        <a href="${esc(unsub)}" style="color:${C.dim};text-decoration:underline;">Unsubscribe</a> ·
        <a href="${esc(base)}/newsletter" style="color:${C.dim};text-decoration:underline;">View online</a>
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function buildBriefEmailText(nl, { siteUrl = 'https://pythh.ai', unsubscribeToken = '' } = {}) {
  const base = siteUrl.replace(/\/+$/, '');
  const date = nl.date || new Date().toISOString().split('T')[0];
  const lines = [`THE PYTHH DAILY BRIEF — ${date}`, ''];
  const ed = nl.editorial?.text || nl.editorial;
  if (ed) lines.push(`PYTHIA'S TAKE`, ed, '');
  if (nl.hottestStartups?.length) {
    lines.push('HOTTEST STARTUPS');
    nl.hottestStartups.slice(0, 5).forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name} — GOD ${s.total_god_score}`);
      lines.push(`   Why: ${s.why}`);
    });
    lines.push('');
  }
  if (nl.signalsThatMatter?.leading) {
    lines.push('SIGNALS THAT MATTER');
    lines.push(`Dominant: ${nl.signalsThatMatter.leading.label} (${nl.signalsThatMatter.leading.pct}%) across ${nl.signalsThatMatter.coverage} companies`);
    lines.push('');
  }
  if ((nl.topMatches || nl.hotMatches)?.length) {
    lines.push('MOST INTERESTING MATCHES');
    (nl.topMatches || nl.hotMatches).slice(0, 4).forEach((m) => {
      lines.push(`- ${m.startup?.name} -> ${m.investor?.firm_name || m.investor?.name} (${m.match_score}%)`);
      if (m.reasoning) lines.push(`  ${m.reasoning}`);
    });
    lines.push('');
  }
  if ((nl.moneyMoves || nl.fundingRounds)?.length) {
    lines.push('MONEY MOVES');
    (nl.moneyMoves || nl.fundingRounds).slice(0, 6).forEach((r) => {
      lines.push(`- ${r.company} ${r.amount}${r.stage ? ' ' + r.stage : ''}`);
    });
    lines.push('');
  }
  lines.push(`Read online: ${base}/newsletter/${date}`);
  if (unsubscribeToken) lines.push(`Unsubscribe: ${unsubscribeUrl(unsubscribeToken, base)}`);
  return lines.join('\n');
}

module.exports = {
  buildBriefEmailHtml,
  buildBriefEmailText,
  unsubscribeUrl,
};
