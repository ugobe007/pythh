'use strict';

/**
 * VC News Daily (vcnewsdaily.com) does not ship a stable public RSS URL
 * (/feed/* 404; ?feed=rss2 returns the HTML homepage). The financing index
 * lives on the homepage in .article-box cards. We treat the homepage URL as
 * the "feed" row in rss_sources and synthesize RSS-shaped items here.
 */

const cheerio = require('cheerio');
const https = require('https');

const VC_HOME = 'https://vcnewsdaily.com/';

function isVcNewsDailyHomepageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'vcnewsdaily.com') return false;
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    return path === '/';
  } catch {
    return false;
  }
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PythhRSS/1.0)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          ...headers,
        },
        timeout: 35_000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * @param {string} [userAgent]
 * @returns {Promise<{ title: string, link: string, pubDate?: string, contentSnippet?: string, description?: string }[]>}
 */
async function fetchVcNewsDailyHomepageItems({ userAgent } = {}) {
  const html = await fetchText(VC_HOME, userAgent ? { 'User-Agent': userAgent } : {});
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('.article-box').each((_, el) => {
    const box = $(el);
    const fundingLink = box.find('a[href*="/venture-capital-funding/"]').first();
    const href = (fundingLink.attr('href') || '').trim();
    if (!href || seen.has(href)) return;
    seen.add(href);

    const title = box.find('h5').first().text().trim() || fundingLink.text().trim();
    const dateStr = box.find('small.posted-date').first().text().trim();
    const snippet = box
      .find('p.article-paragraph')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (!title || !href) return;

    let absolute = href;
    if (!/^https?:\/\//i.test(href)) {
      try {
        absolute = new URL(href, VC_HOME).href;
      } catch {
        return;
      }
    }

    const parsed = dateStr ? new Date(dateStr) : new Date();
    const pubDate = Number.isNaN(parsed.getTime())
      ? new Date().toUTCString()
      : parsed.toUTCString();

    items.push({
      title,
      link: absolute,
      pubDate,
      guid: absolute,
      contentSnippet: snippet,
      description: snippet,
    });
  });

  return items;
}

module.exports = {
  VC_NEWS_DAILY_HOME: VC_HOME,
  isVcNewsDailyHomepageUrl,
  fetchVcNewsDailyHomepageItems,
};
