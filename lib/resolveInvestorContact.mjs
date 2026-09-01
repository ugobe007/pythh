/**
 * Resolve investor outreach contact: Hunter.io → ZeroBounce → existing email → DNS inference fallback.
 */

import { createRequire } from 'module';
import { findInvestorEmail, findEmailByName, hasHunterIo } from './hunterIo.mjs';
import { validateEmail, hasZeroBounce } from './zeroBounce.mjs';

const require = createRequire(import.meta.url);
const {
  extractDomain,
  classifyContactEmail,
  isBlockedOutreachEmail,
  isPersonName,
  parseName,
} = require('./investorEmailInfer.js');

function reject(reason, extra = {}) {
  return { rejected: true, reason, ...extra };
}

function investorDomain(investor) {
  return extractDomain(investor.url || investor.website);
}

function partnerNames(investor) {
  const names = [];
  if (isPersonName(investor.name)) names.push(investor.name);
  if (Array.isArray(investor.partners)) {
    for (const p of investor.partners.slice(0, 5)) {
      if (typeof p === 'string' && isPersonName(p)) names.push(p);
    }
  }
  return [...new Set(names)];
}

function buildContact(hunter, zb) {
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

async function finalizeHunterContact(hunter, investor, opts) {
  const domain = investorDomain(investor);
  const emailDomain = hunter.email.split('@')[1]?.toLowerCase();
  if (!domain || !emailDomain || emailDomain !== domain) {
    return reject('domain_mismatch', { email: hunter.email, source: hunter.source });
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
    return buildContact(hunter, zb);
  }
  return buildContact(hunter, null);
}

/**
 * @param {object} investor
 * @param {{ useHunter?: boolean, validate?: boolean, allowCatchAll?: boolean }} [opts]
 */
export async function resolveInvestorContact(investor, opts = {}) {
  if (investor.email && !isBlockedOutreachEmail(investor.email)) {
    return {
      email: investor.email.toLowerCase(),
      source: 'verified_on_file',
      emailType: classifyContactEmail(investor.email),
      personName: isPersonName(investor.name) ? investor.name : null,
    };
  }

  const useHunter = opts.useHunter !== false && hasHunterIo();
  const domain = investorDomain(investor);
  if (!domain) return reject('no_domain');

  if (useHunter) {
    for (const name of partnerNames(investor)) {
      const parsed = parseName(name);
      if (!parsed?.first) continue;
      const hunter = await findEmailByName(domain, parsed.first, parsed.last || '');
      if (hunter?.email) {
        const contact = await finalizeHunterContact(hunter, investor, opts);
        if (!contact.rejected) return contact;
      }
    }

    const parsedInvestor = isPersonName(investor.name) ? parseName(investor.name) : null;
    const hunter = await findInvestorEmail(domain, {
      firstName: parsedInvestor?.first,
      lastName: parsedInvestor?.last,
    });
    if (hunter?.email) {
      const contact = await finalizeHunterContact(hunter, investor, opts);
      if (!contact.rejected) return contact;
    }
  }

  if (investor.email_best_guess && !isBlockedOutreachEmail(investor.email_best_guess)) {
    return {
      email: investor.email_best_guess.toLowerCase(),
      source: 'inferred_best_guess',
      emailType: classifyContactEmail(investor.email_best_guess),
      personName: isPersonName(investor.name) ? investor.name : null,
    };
  }

  return null;
}
