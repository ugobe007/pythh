/**
 * Funding-attention pattern logic.
 *
 * Answers, from verified ledger rows only:
 *   - why the raise happened (ranked announcement triggers)
 *   - whether later funders follow a well-known firm
 *   - whether a firm partner / founder is writing a personal angel check
 *
 * Does not retune GOD / fit weights and does not invent unverified edges.
 */

import { createRequire } from 'node:module';
import { inferFundingTriggers } from './fundingAttentionAspects.mjs';

const require = createRequire(import.meta.url);
const { looksLikePersonName, scorePartnerAngelInvestor } = require('./partnerAngelInvestors.js');
const {
  isKnownOperatorFounderName,
  scoreOperatorFounderInvestor,
} = require('./operatorFounderInvestors.js');

export const FUNDING_ATTENTION_PATTERN_VERSION = 'funding-attention-patterns-v1';

const WELL_KNOWN_FIRM_ALIASES = Object.freeze([
  'sequoia', 'sequoia capital',
  'andreessen horowitz', 'a16z',
  'accel',
  'benchmark',
  'greylock',
  'lightspeed', 'lightspeed venture partners',
  'founders fund',
  'index ventures', 'index',
  'general catalyst',
  'kleiner perkins',
  'nea', 'new enterprise associates',
  'bessemer', 'bessemer venture partners',
  'insight partners', 'insight',
  'y combinator', 'yc',
  'thrive', 'thrive capital',
  'coatue',
  'iconiq', 'iconiq capital',
]);

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function eventTime(event = {}) {
  return event.announced_at || event.occurred_at || event.created_at || '';
}

export function isWellKnownFirm(investor = {}) {
  const labels = [investor.firm, investor.name, investor.investor_name_raw];
  return labels.some((label) => WELL_KNOWN_FIRM_ALIASES.includes(norm(label)));
}

function nameLooksLikeFirm(investor = {}) {
  const name = norm(investor.name);
  const firm = norm(investor.firm);
  if (!name) return false;
  if (firm && name === firm) return true;
  return /\b(ventures?|capital|partners?|fund|group|holdings|investments?)\b/.test(name)
    && !looksLikePersonName(investor.name);
}

/**
 * Classify how this profile typically writes a check.
 * founder_angel — successful operator investing personally
 * partner_angel — VC partner / scout writing a personal or sidecar check
 * firm_partner — named partner likely investing through the firm
 * firm — institutional vehicle
 */
export function classifyCapitalRole(investor = {}) {
  const founder = scoreOperatorFounderInvestor(investor);
  const partner = scorePartnerAngelInvestor(investor);
  const person = investor.is_individual === true || looksLikePersonName(investor.name);
  const knownFounder = isKnownOperatorFounderName(investor.name);
  const type = `${investor.type || ''} ${investor.investor_type || ''} ${investor.capital_type || ''}`.toLowerCase();
  const angelTyped = /\b(angel|scout|operator)\b/.test(type);
  const early = (Array.isArray(investor.stage) ? investor.stage : [investor.stage])
    .some((stage) => /pre.?seed|seed|angel|early/i.test(String(stage || '')));

  if (knownFounder || founder.isOperatorFounder) {
    return {
      role: 'founder_angel',
      why: knownFounder
        ? 'Known successful-founder name investing personally'
        : 'Operator / founder-exit language on an individual profile',
      signals: founder.signals,
    };
  }
  if (person && !nameLooksLikeFirm(investor) && (partner.isPartnerAngel || angelTyped)) {
    return {
      role: 'partner_angel',
      why: angelTyped
        ? 'Person tagged angel/scout while attached to a firm'
        : 'Person-at-firm + small-check / angel signals — typical personal sidecar',
      signals: partner.signals,
      early_stage: early,
    };
  }
  if (person && !nameLooksLikeFirm(investor)) {
    return {
      role: 'firm_partner',
      why: 'Named partner; treat as firm check unless the firm is absent from the roster',
      signals: partner.signals,
    };
  }
  return {
    role: 'firm',
    why: 'Institutional firm profile',
    signals: [],
  };
}

function firmKey(investor = {}) {
  return norm(investor.firm) || (nameLooksLikeFirm(investor) ? norm(investor.name) : '');
}

/**
 * Personal / sidecar check: person on the roster, their firm is not.
 * Firm check: the institution is present (optionally with a named partner).
 */
export function classifyCheckVehicle(participant, rosterInvestors, event = {}) {
  const role = classifyCapitalRole(participant);
  const myFirm = firmKey(participant);
  const rosterHasFirm = Boolean(myFirm) && rosterInvestors.some((other) => {
    if (other.id && participant.id && other.id === participant.id) return false;
    return firmKey(other) === myFirm && classifyCapitalRole(other).role === 'firm';
  });
  const round = String(event.round_type || '').toLowerCase();
  const earlyRound = /pre.?seed|seed|angel|unknown/.test(round) || !round;
  const laterRound = /series[- ]?[b-z]|growth|late/.test(round);

  if (role.role === 'founder_angel') {
    return {
      vehicle: 'personal_angel',
      role: role.role,
      why: laterRound
        ? 'Founder-angel still writing a personal check after seed — personal portfolio, not the fund'
        : 'Successful founder investing personally, often before or beside a firm lead',
    };
  }
  if ((role.role === 'partner_angel' || role.role === 'firm_partner') && myFirm && !rosterHasFirm) {
    return {
      vehicle: 'personal_angel',
      role: role.role,
      why: earlyRound
        ? 'Partner present without the firm — personal/scout check to start a personal portfolio'
        : 'Partner present without the firm on a later roster — sidecar, not a fund check',
    };
  }
  if (rosterHasFirm) {
    return {
      vehicle: 'firm',
      role: role.role === 'firm' ? 'firm' : 'firm_partner',
      why: 'Firm vehicle is on the same verified roster',
    };
  }
  return {
    vehicle: role.role === 'firm' ? 'firm' : 'unresolved',
    role: role.role,
    why: role.why,
  };
}

export function detectFollowTheLead(startupEvents = []) {
  const sorted = [...startupEvents].sort((a, b) => String(eventTime(a)).localeCompare(String(eventTime(b))));
  let leader = null;
  let leaderKeys = new Set();
  const followers = [];

  for (const event of sorted) {
    const roster = (event.investors || []).filter((row) => row && (row.id || row.name || row.firm));
    if (!leader) {
      const wellKnown = roster.filter((row) => isWellKnownFirm(row) && classifyCapitalRole(row).role === 'firm');
      if (!wellKnown.length) continue;
      leader = {
        event_id: event.id,
        startup: event.startup_name || event.startup_name_raw,
        announced_at: eventTime(event),
        firm: wellKnown[0].firm || wellKnown[0].name,
        investor_id: wellKnown[0].id || null,
      };
      leaderKeys = new Set(roster.flatMap((row) => [row.id, firmKey(row), norm(row.name)].filter(Boolean)));
      continue;
    }
    if (event.id === leader.event_id) continue;
    const followed = roster.filter((row) => {
      const keys = [row.id, firmKey(row), norm(row.name)].filter(Boolean);
      return keys.length > 0 && keys.every((key) => !leaderKeys.has(key));
    });
    if (followed.length) {
      followers.push({
        event_id: event.id,
        announced_at: eventTime(event),
        names: followed.map((row) => row.firm || row.name).filter(Boolean),
      });
    }
  }

  return {
    followed: Boolean(leader && followers.length),
    leader,
    followers,
  };
}

export function summarizeFundingWhy(extracted, event = {}) {
  const triggers = inferFundingTriggers(extracted);
  return {
    startup: event.startup_name_raw || event.startup_name || null,
    event_id: event.id || null,
    announced_at: eventTime(event),
    why_funding: triggers.primary,
    triggers: triggers.reasons,
    cited: triggers.cited,
  };
}

export function buildPatternReport({ events = [], investorsById = new Map() } = {}) {
  const byStartup = new Map();
  const triggerCounts = {};
  const roleCounts = {};
  const vehicleCounts = {};
  const sidecar = [];
  const founderAngels = [];

  for (const event of events) {
    const roster = (event.participants || event.investors || [])
      .map((row) => {
        const profile = (row.investor_id && investorsById.get(row.investor_id)) || {};
        return {
          ...profile,
          id: row.investor_id || profile.id || null,
          name: profile.name || row.investor_name_raw || row.name || null,
          firm: profile.firm || row.firm || null,
          investor_name_raw: row.investor_name_raw || null,
        };
      });
    const extracted = {
      aspects: (event.aspects || event.metadata?.funding_attention_aspects || [])
        .map((id) => (typeof id === 'string' ? { id, theme: id } : id)),
      cited: Boolean(event.cited || event.metadata?.funding_attention_cited),
    };
    const why = summarizeFundingWhy(extracted, event);
    triggerCounts[why.why_funding] = (triggerCounts[why.why_funding] || 0) + 1;

    const list = byStartup.get(event.startup_id) || [];
    list.push({
      id: event.id,
      startup_id: event.startup_id,
      startup_name: event.startup_name_raw,
      announced_at: eventTime(event),
      investors: roster,
      why,
    });
    byStartup.set(event.startup_id, list);

    for (const person of roster) {
      const role = classifyCapitalRole(person);
      roleCounts[role.role] = (roleCounts[role.role] || 0) + 1;
      const vehicle = classifyCheckVehicle(person, roster, event);
      vehicleCounts[vehicle.vehicle] = (vehicleCounts[vehicle.vehicle] || 0) + 1;
      if (vehicle.vehicle === 'personal_angel') {
        sidecar.push({
          investor: person.firm || person.name,
          role: vehicle.role,
          startup: event.startup_name_raw,
          event_id: event.id,
          why: vehicle.why,
        });
      }
      if (role.role === 'founder_angel') {
        founderAngels.push({
          investor: person.name,
          startup: event.startup_name_raw,
          event_id: event.id,
        });
      }
    }
  }

  const follow = [];
  for (const group of byStartup.values()) {
    const detected = detectFollowTheLead(group);
    if (detected.followed) follow.push(detected);
  }

  return {
    version: FUNDING_ATTENTION_PATTERN_VERSION,
    events: events.length,
    startups: byStartup.size,
    trigger_counts: triggerCounts,
    capital_role_counts: roleCounts,
    check_vehicle_counts: vehicleCounts,
    follow_the_lead: {
      startups_with_follow: follow.length,
      examples: follow.slice(0, 12),
    },
    personal_angel_sidecars: {
      count: sidecar.length,
      examples: sidecar.slice(0, 12),
    },
    founder_angels: {
      count: founderAngels.length,
      examples: founderAngels.slice(0, 12),
    },
    lessons: [
      'Primary triggers are announcement-language, not inferred psychology.',
      'Follow-the-lead counts only later verified events after a well-known firm already appeared.',
      'Same-event syndicates are co-invest, not follow.',
      'A partner without their firm on the roster is treated as a personal/scout check.',
      'Founder-angels are successful operators writing personal checks to build a personal portfolio.',
    ],
  };
}

export function patternNotesForInvestor(investor, reportSlice = {}) {
  return {
    version: FUNDING_ATTENTION_PATTERN_VERSION,
    as_of: new Date().toISOString(),
    capital_role: classifyCapitalRole(investor).role,
    follow_the_lead: reportSlice.follow_the_lead || null,
    sidecar: reportSlice.sidecar || null,
    trigger_affinity: reportSlice.trigger_affinity || {},
  };
}
