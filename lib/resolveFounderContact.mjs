/**
 * Resolve founder outreach contact: Hunter.io → ZeroBounce validate → submitted_email → skip intake@.
 */

import { createRequire } from 'module';
import { findFounderEmail, findEmailByName, hasHunterIo, isFounderPosition } from './hunterIo.mjs';
import { validateEmail, hasZeroBounce } from './zeroBounce.mjs';

const require = createRequire(import.meta.url);
const {
  extractDomain,
  classifyContactEmail,
  isBlockedOutreachEmail,
  isBlockedStartupWebsite,
  startupNameMatchesDomain,
  emailDomainMatchesWebsite,
} = require('./investorEmailInfer.js');

function reject(reason, extra = {}) {
  return { rejected: true, reason, ...extra };
}

function websiteUrl(startup) {
  return startup.website || startup.company_website || '';
}

function validateStartupWebsite(startup) {
  const url = websiteUrl(startup);
  const domain = extractDomain(url);
  if (!url || !domain) return reject('no_website');

  const siteCheck = isBlockedStartupWebsite(url);
  if (siteCheck.blocked) return reject(siteCheck.reason);

  if (!startupNameMatchesDomain(startup.name, domain)) {
    return reject(`name_domain_mismatch:${domain}`);
  }

  return { url, domain };
}

/**
 * @param {string} email
 * @param {{ validate?: boolean, allowCatchAll?: boolean }} [opts]
 */
async function acceptOutreachEmail(email, opts = {}) {
  if (!email || isBlockedOutreachEmail(email)) return null;
  const validate = opts.validate !== false && hasZeroBounce();
  if (validate) {
    const zb = await validateEmail(email, { allowCatchAll: opts.allowCatchAll });
    if (!zb.ok) return null;
    return { email: email.toLowerCase(), zeroBounceStatus: zb.status, zeroBounceSubStatus: zb.sub_status };
  }
  return { email: email.toLowerCase() };
}

function buildHunterContact(hunter, zb) {
  return {
    email: hunter.email.toLowerCase(),
    source: hunter.source,
    emailType: classifyContactEmail(hunter.email),
    personName: [hunter.firstName, hunter.lastName].filter(Boolean).join(' ') || null,
    hunterConfidence: hunter.confidence,
    position: hunter.position,
    ...(zb ? { zeroBounceStatus: zb.status, zeroBounceSubStatus: zb.sub_status } : {}),
  };
}

async function finalizeHunterContact(hunter, startup, opts, { namedFounder }) {
  const url = websiteUrl(startup);

  if (!emailDomainMatchesWebsite(hunter.email, url)) {
    return reject('domain_mismatch', { email: hunter.email, source: hunter.source });
  }

  if (hunter.source === 'hunter_domain_search' && !namedFounder && !isFounderPosition(hunter.position)) {
    return reject('no_founder_title', { email: hunter.email, source: hunter.source });
  }

  if (isBlockedOutreachEmail(hunter.email)) {
    return reject('blocked', { email: hunter.email, source: hunter.source });
  }

  const validate = opts.validate !== false && hasZeroBounce();
  if (validate) {
    const zb = await validateEmail(hunter.email, { allowCatchAll: opts.allowCatchAll });
    if (!zb.ok) {
      return reject(zb.reason || `zerobounce:${zb.status}`, {
        email: hunter.email,
        source: hunter.source,
        zeroBounceStatus: zb.status,
      });
    }
    return buildHunterContact(hunter, zb);
  }

  return buildHunterContact(hunter, null);
}

/**
 * @param {object} startup
 * @param {{ useHunter?: boolean, validate?: boolean, allowCatchAll?: boolean }} [opts]
 */
export async function resolveFounderContact(startup, opts = {}) {
  const useHunter = opts.useHunter !== false && hasHunterIo();

  if (useHunter) {
    const site = validateStartupWebsite(startup);
    if (site.rejected) return site;

    const { domain } = site;
    const founders = startup.extracted_data?.founders;
    const founderName = founders?.[0]?.name || '';
    const first = founderName.split(/\s+/)?.[0];
    const last = founderName.split(/\s+/).slice(1).join(' ');
    const namedFounder = !!first;

    let hunter = null;
    if (first) {
      hunter = await findEmailByName(domain, first, last || '');
    }
    if (!hunter) {
      hunter = await findFounderEmail(domain);
    }
    if (hunter?.email) {
      return finalizeHunterContact(hunter, startup, opts, { namedFounder });
    }
  }

  const submitted = startup.submitted_email?.trim();
  if (submitted) {
    const type = classifyContactEmail(submitted);
    if (type === 'personal') {
      const accepted = await acceptOutreachEmail(submitted, opts);
      if (accepted) {
        const founderName = startup.extracted_data?.founders?.[0]?.name;
        return {
          email: accepted.email,
          source: 'submitted_email',
          emailType: type,
          personName: founderName || null,
          zeroBounceStatus: accepted.zeroBounceStatus,
          zeroBounceSubStatus: accepted.zeroBounceSubStatus,
        };
      }
    }
  }

  return null;
}
