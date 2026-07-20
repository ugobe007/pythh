'use strict';

/** VC / firm keywords — slugs containing these are likely real company pages. */
const FIRM_WORDS =
  /ventures?|capital|partners?|fund|vc|holdings|management|advisors?|accelerator|incubator|investments?|corp|corporation|group|llc|lp|associates|equity|labs|studio|seed|growth|crypto|blockchain|health|bio|tech|financial|finserv|bank|insurance|energy|media|software|systems|solutions|industries|international|global|worldwide/i;

/**
 * @param {string|null|undefined} url
 * @returns {string}
 */
function normalizeLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/**
 * @param {string} url
 * @returns {string}
 */
function slugFromLinkedInUrl(url) {
  const normalized = normalizeLinkedInUrl(url);
  const inMatch = normalized.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (inMatch) return decodeURIComponent(inMatch[1]).toLowerCase();
  const companyMatch = normalized.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (companyMatch) return decodeURIComponent(companyMatch[1]).toLowerCase();
  return '';
}

/**
 * Auto-generated rows often use /company/first-last-(firm) — not real company pages.
 *
 * @param {string} slug
 * @returns {boolean}
 */
function looksLikePersonSlug(slug) {
  if (!slug) return false;
  if (slug.includes('(')) return true;
  const cleaned = slug.replace(/\([^)]*\)/g, '').replace(/-+$/, '').trim();
  const parts = cleaned.split('-').filter(Boolean);
  return parts.length >= 2 && parts.length <= 5 && !FIRM_WORDS.test(cleaned);
}

/**
 * @param {string} slug
 * @returns {string}
 */
function personSlugFromCompanySlug(slug) {
  return slug.replace(/\([^)]*\)/g, '').replace(/-+$/, '').replace(/^-+/, '').trim();
}

/**
 * @param {string|null|undefined} name
 * @param {string|null|undefined} firm
 * @returns {string}
 */
function linkedInPeopleSearchUrl(name, firm) {
  const query = [name, firm]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!query) return '';
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

/**
 * Turn broken /company/person slugs into working /in/ or people-search links.
 *
 * @param {{ linkedinUrl?: string|null, name?: string|null, firm?: string|null }} input
 * @returns {string}
 */
function resolveInvestorLinkedInUrl(input = {}) {
  const name = input.name || '';
  const firm = input.firm || '';
  const searchFallback = () => linkedInPeopleSearchUrl(name, firm);

  const raw = normalizeLinkedInUrl(input.linkedinUrl || '');
  if (!raw) return searchFallback();

  if (!/linkedin\.com/i.test(raw)) return raw;

  if (/\/in\//i.test(raw)) return raw;

  if (/\/company\//i.test(raw)) {
    const slug = slugFromLinkedInUrl(raw);
    if (!looksLikePersonSlug(slug)) return raw;

    const personSlug = personSlugFromCompanySlug(slug);
    if (personSlug) {
      return `https://www.linkedin.com/in/${personSlug}`;
    }
    return searchFallback() || raw;
  }

  return raw;
}

module.exports = {
  normalizeLinkedInUrl,
  slugFromLinkedInUrl,
  looksLikePersonSlug,
  personSlugFromCompanySlug,
  linkedInPeopleSearchUrl,
  resolveInvestorLinkedInUrl,
};
