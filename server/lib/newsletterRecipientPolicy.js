'use strict';

/** Never send the Daily Brief or match mail here — wrong inbox. */
const BLOCKED_BRIEF_EMAILS = new Set(['bob@readyforrobots.com']);

/** Owner inboxes that must receive the Daily Brief. */
const OWNER_BRIEF_EMAILS = ['ugobe07@gmail.com', 'bob@pythh.ai'];

function normalizeBriefEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isBlockedBriefEmail(email) {
  return BLOCKED_BRIEF_EMAILS.has(normalizeBriefEmail(email));
}

function filterBriefRecipients(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const email = normalizeBriefEmail(typeof row === 'string' ? row : row?.email);
    if (!email || isBlockedBriefEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(typeof row === 'string' ? { email } : { ...row, email });
  }
  for (const email of OWNER_BRIEF_EMAILS) {
    if (seen.has(email) || isBlockedBriefEmail(email)) continue;
    seen.add(email);
    out.push({ email, unsubscribe_token: '' });
  }
  return out;
}

module.exports = {
  BLOCKED_BRIEF_EMAILS,
  OWNER_BRIEF_EMAILS,
  normalizeBriefEmail,
  isBlockedBriefEmail,
  filterBriefRecipients,
};
