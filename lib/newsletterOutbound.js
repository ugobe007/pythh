'use strict';

const NEWSLETTER_PATH = '/newsletter';

function publicSiteUrl(raw) {
  const cleaned = String(raw || process.env.APP_BASE_URL || process.env.SITE_URL || 'https://pythh.ai')
    .trim()
    .replace(/\/+$/, '');
  if (!cleaned || /localhost|127\.0\.0\.1/i.test(cleaned)) return 'https://pythh.ai';
  return cleaned;
}

function newsletterPublicUrl(base) {
  return `${publicSiteUrl(base)}${NEWSLETTER_PATH}`;
}

function newsletterOutboundLine(base) {
  return `Daily Signal — underlying investor-sentiment trends: ${newsletterPublicUrl(base)}`;
}

function newsletterOutboundHtml(base) {
  const href = newsletterPublicUrl(base);
  return `<p style="color:#64748b;font-size:12px;line-height:1.55;margin:16px 0 0;">Read today's Daily Signal — what is shaping investor choices: <a href="${href}" style="color:#34d399;text-decoration:underline;">${href.replace(/^https:\/\//, '')}</a></p>`;
}

module.exports = {
  NEWSLETTER_PATH,
  publicSiteUrl,
  newsletterPublicUrl,
  newsletterOutboundLine,
  newsletterOutboundHtml,
};
