'use strict';

const {
  vcOpening,
  vcMethodology,
  vcSubject,
  vcHeadline,
  vcFootnote,
} = require('./pythiaVoice.js');

const STALE_COPY = /I noticed something you may want to see|conviction signals|how you actually deploy|deployment patterns|recent signals|aligned with .+ deployment|Rankings reflect/i;

function isStalePeterVcCopy(...parts) {
  return parts.some((part) => STALE_COPY.test(String(part || '')));
}

function extractGreeting(source) {
  const m = String(source || '').match(/Hi\s+(?:team at\s+)?[^,<]{1,60},/i);
  return m ? m[0].replace(/\s+/g, ' ').trim() : 'Hi there,';
}

function extractFirm(html, fallback) {
  const titled = String(html || '').match(/Peter · Pythh · ([^<]+)/i);
  if (titled?.[1]) return titled[1].trim();
  const parts = String(fallback || '').split('·');
  const fallbackLabel = (parts[1] || parts[0] || '').trim();
  return fallbackLabel || 'your firm';
}

function extractFeaturedStartup(html) {
  const m = String(html || '').match(
    /font-weight:600;color:#f1f5f9;font-size:14px;margin-bottom:2px;">\s*([^<]+)/i,
  );
  return m ? m[1].replace(/&amp;/g, '&').trim() : '';
}

function extractCount(html, subject) {
  const fromHeadline = String(html || '').match(/(\d+)\s+(?:curated\s+)?(?:[\w./+-]+\s+)?startups/i);
  if (fromHeadline) return Number(fromHeadline[1]);
  const fromSubject = String(subject || '').match(/(\d+)\s+startups/i);
  if (fromSubject) return Number(fromSubject[1]);
  const rows = String(html || '').match(/font-weight:600;color:#f1f5f9;font-size:14px;margin-bottom:2px;/g);
  return rows?.length || 10;
}

function isPersonalGreeting(greeting, emailType) {
  if (emailType === 'personal') return true;
  if (emailType === 'intake' || emailType === 'generic') return false;
  return !/^Hi team at /i.test(greeting);
}

function replaceHtmlCopy(html, { headline, opening, methodology }) {
  let next = String(html || '');
  next = next.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${headline}</h1>`);
  next = next.replace(
    /(<p style="color:#64748b;font-size:14px;line-height:1\.65;margin:0 0 8px;">)[\s\S]*?(<\/p>)/i,
    `$1${opening}$2`,
  );
  next = next.replace(
    /(HOW THESE WERE RANKED<\/div>\s*<p style="color:#64748b;font-size:13px;line-height:1\.65;margin:0;">)[\s\S]*?(<\/p>)/i,
    `$1${methodology}$2`,
  );
  return next;
}

function replaceTextCopy(text, { headline, opening, footnote, methodology }) {
  const raw = String(text || '');
  if (!raw.trim()) {
    return `${headline}\n\n${opening}\n${footnote}\n`;
  }
  let next = raw.replace(
    /^[\s\S]*?(?=\n\s*1\.\s)/,
    `${headline}\n\n${opening}\n${footnote}\n\n`,
  );
  if (next === raw) {
    next = `${headline}\n\n${opening}\n${footnote}\n\n${raw}`;
  }
  next = next.replace(
    /\nRankings reflect[\s\S]*?(?=\n─|$)/,
    `\n${methodology}\n`,
  );
  next = next.replace(
    /\nWe use 24 algorithms[\s\S]*?(?=\n─|$)/,
    `\n${methodology}\n`,
  );
  if (!/We use 24 algorithms/.test(next)) {
    next = next.replace(
      /(\n─{3,})/,
      `\n${methodology}\n\n$1`,
    );
  }
  return next;
}

function refreshPeterVcDraft(draft = {}) {
  const html = draft.html_body || draft.html || '';
  const text = draft.text_body || draft.text || '';
  const subject = draft.subject || '';
  if (!html && !text) return null;

  const greeting = extractGreeting(html || text);
  const firm = extractFirm(html, draft.firm || draft.target_name);
  const featuredStartup = extractFeaturedStartup(html);
  const count = extractCount(html, subject);
  const isPersonal = isPersonalGreeting(greeting, draft.emailType || draft.email_type);
  const opening = vcOpening({ greeting, firm, isPersonal, featuredStartup });
  const methodology = vcMethodology();
  const headline = vcHeadline({ count });
  const footnote = vcFootnote();
  const nextSubject = vcSubject({
    firm,
    emailType: isPersonal ? 'personal' : 'intake',
    count,
  });
  const nextHtml = html ? replaceHtmlCopy(html, { headline, opening, methodology }) : html;
  const nextText = replaceTextCopy(text, { headline, opening, footnote, methodology });
  const changed =
    nextHtml !== html ||
    nextText !== text ||
    nextSubject !== subject ||
    isStalePeterVcCopy(html, text, subject);

  return {
    subject: nextSubject,
    html_body: nextHtml,
    text_body: nextText,
    changed,
    opening,
    featuredStartup,
    firm,
  };
}

module.exports = {
  STALE_COPY,
  isStalePeterVcCopy,
  extractGreeting,
  extractFirm,
  extractFeaturedStartup,
  refreshPeterVcDraft,
};
