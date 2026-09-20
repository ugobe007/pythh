/**
 * Resolve founder outreach contact: Hunter.io → ZeroBounce validate → submitted_email → skip intake@.
 */

import { createRequire } from 'module';
import { findFounderEmail, findEmailByName, hasHunterIo, isFounderPosition } from './hunterIo.mjs';
import { validateEmail, hasZeroBounce } from './zeroBounce.mjs';

const require = createRequire(import.meta.url);
const {
  classifyContactEmail,
  isBlockedOutreachEmail,
  pickOutreachWebsite,
  emailDomainMatchesStartup,
} = require('./investorEmailInfer.js');

function reject(reason, extra = {}) {
  return { rejected: true, reason, ...extra };
}

function founderNames(startup) {
  const list = startup?.extracted_data?.founders;
  if (!Array.isArray(list)) return [];
  return list
    .map((founder) => (typeof founder === 'string' ? founder : founder?.name))
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .slice(0, 3);
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
  if (!emailDomainMatchesStartup(hunter.email, startup)) {
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
  const cached = startup.extracted_data?.outreach_contact;
  if (cached?.email && !cached.enrichment_failed && !opts.forceRefresh) {
    const email = String(cached.email).toLowerCase();
    if (!isBlockedOutreachEmail(email)) {
      return {
        email,
        source: cached.source || 'cached_outreach_contact',
        emailType: cached.email_type || classifyContactEmail(email),
        personName: cached.person_name || null,
        hunterConfidence: cached.hunter_confidence ?? null,
        position: cached.position || null,
      };
    }
  }

  const useHunter = opts.useHunter !== false && hasHunterIo();

  if (useHunter) {
    const site = pickOutreachWebsite(startup);
    if (site.rejected) return site;

    const { domain } = site;
    const names = founderNames(startup);
    let hunter = null;
    for (const founderName of names) {
      const parts = founderName.split(/\s+/).filter(Boolean);
      hunter = await findEmailByName(domain, parts[0], parts.slice(1).join(' '));
      if (hunter?.email) break;
    }
    if (!hunter) {
      hunter = await findFounderEmail(domain);
    }
    if (hunter?.email) {
      const contact = await finalizeHunterContact(hunter, startup, opts, { namedFounder: names.length > 0 });
      if (contact && !contact.rejected) contact.websiteDomain = domain;
      return contact;
    }
  }

  const submitted = startup.submitted_email?.trim();
  if (submitted) {
    const type = classifyContactEmail(submitted);
    if (type === 'personal') {
      const accepted = await acceptOutreachEmail(submitted, opts);
      if (accepted) {
        return {
          email: accepted.email,
          source: 'submitted_email',
          emailType: type,
          personName: founderNames(startup)[0] || null,
          zeroBounceStatus: accepted.zeroBounceStatus,
          zeroBounceSubStatus: accepted.zeroBounceSubStatus,
        };
      }
    }
  }

  return null;
}
