/**
 * Resolve founder outreach contact: Hunter.io → submitted_email → skip intake@.
 */

import { createRequire } from 'module';
import { findFounderEmail, findEmailByName, hasHunterIo } from './hunterIo.mjs';

const require = createRequire(import.meta.url);
const {
  extractDomain,
  classifyContactEmail,
  isBlockedOutreachEmail,
} = require('./investorEmailInfer.js');

/**
 * @param {object} startup
 * @param {{ useHunter?: boolean }} [opts]
 */
export async function resolveFounderContact(startup, opts = {}) {
  const useHunter = opts.useHunter !== false && hasHunterIo();
  const domain = extractDomain(startup.website || startup.company_website);

  if (useHunter && domain) {
    const founders = startup.extracted_data?.founders;
    const founderName = founders?.[0]?.name || '';
    const first = founderName.split(/\s+/)?.[0];
    const last = founderName.split(/\s+/).slice(1).join(' ');

    let hunter = null;
    if (first) {
      hunter = await findEmailByName(domain, first, last || '');
    }
    if (!hunter) {
      hunter = await findFounderEmail(domain);
    }
    if (hunter?.email && !isBlockedOutreachEmail(hunter.email)) {
      return {
        email: hunter.email,
        source: hunter.source,
        emailType: classifyContactEmail(hunter.email),
        personName: [hunter.firstName, hunter.lastName].filter(Boolean).join(' ') || null,
        hunterConfidence: hunter.confidence,
        position: hunter.position,
      };
    }
  }

  const submitted = startup.submitted_email?.trim();
  if (submitted && !isBlockedOutreachEmail(submitted)) {
    const type = classifyContactEmail(submitted);
    if (type === 'personal') {
      return {
        email: submitted.toLowerCase(),
        source: 'submitted_email',
        emailType: type,
        personName: founderName || null,
      };
    }
  }

  return null;
}
