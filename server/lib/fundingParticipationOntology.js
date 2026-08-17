'use strict';

const PARTICIPATION_ROLES = Object.freeze([
  'lead',
  'co_lead',
  'participant',
  'syndicate_member',
  'existing_investor',
  'unknown',
]);

const ROLE_CONFIDENCE = Object.freeze({
  lead: 1,
  co_lead: 1,
  participant: 0.95,
  syndicate_member: 0.95,
  existing_investor: 0.9,
  unknown: 0,
});

function isHistoricalRoundReference(text) {
  const value = String(text || '');
  return /\b(?:last year[’']?s?|previous|prior|earlier)\b.{0,100}\b(?:round|series|funding|financing)\b/i.test(value)
    || /\bfollowing\b.{0,100}\b(?:round|series|funding|financing)\b/i.test(value);
}

function classifyParticipationPhrase(text) {
  const value = String(text || '');
  if (/\bco[- ]led\b|\bjointly led\b/i.test(value)) return { role: 'co_lead', relation: 'CO_LED_ROUND' };
  if (/\bled (?:the )?(?:round|financing|investment)\b/i.test(value)) return { role: 'lead', relation: 'LED_ROUND' };
  if (/\bparticipat(?:ed|ing) in (?:the )?syndicate\b/i.test(value)) return { role: 'syndicate_member', relation: 'PARTICIPATED_IN_SYNDICATE' };
  if (/\bparticipat(?:ed|ing) in (?:the )?(?:round|financing)\b/i.test(value)) return { role: 'participant', relation: 'PARTICIPATED_IN_ROUND' };
  if (/\bjoined by\b/i.test(value)) return { role: 'participant', relation: 'PARTICIPATED_IN_ROUND' };
  if (/\bexisting investor(?:s)?\b|\bfollow[- ]on investment\b/i.test(value)) return { role: 'existing_investor', relation: 'INVESTED_IN' };
  if (/\binvest(?:ed|s|ing) in\b/i.test(value)) return { role: 'participant', relation: 'INVESTED_IN' };
  return { role: 'unknown', relation: null };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKnownInvestorMentions(text, investors) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+|\n+/).map(value => value.trim()).filter(Boolean);
  const mentions = [];
  const seen = new Set();
  for (const investor of investors || []) {
    const names = [...new Set([investor.name, investor.firm].filter(Boolean).map(value => String(value).trim()))]
      .sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (name.length < 3) continue;
      const namePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}(?=$|[^a-z0-9])`, 'i');
      const sentence = sentences.find(value => namePattern.test(value));
      if (!sentence) continue;
      const key = String(investor.id || name).toLowerCase();
      if (seen.has(key)) break;
      const beforeName = sentence.slice(0, sentence.search(namePattern) + sentence.match(namePattern)[1].length);
      const coLeadClause = sentence.match(/(?:co[- ]led|jointly led)\s+by\s+(.+?)(?=\bwith participation\b|\bparticipation from\b|[.;]|$)/i);
      const leadClause = sentence.match(/\bled\s+by\s+(.+?)(?=\band\s+(?:was\s+)?co[- ]led\s+by\b|\bjoined by\b|\bwith participation\b|\bparticipation from\b|[.;]|$)/i);
      const joinedClause = sentence.match(/\bjoined by\s+(.+?)(?=\bwith participation\b|\bparticipation from\b|[.;]|$)/i);
      const participationClause = sentence.match(/(?:with participation from|participation from|participated in)\s+(.+?)(?=[.;]|$)/i);
      const syndicateClause = sentence.match(/(?:syndicate (?:included|includes)|participated in the syndicate)\s+(.+?)(?=[.;]|$)/i);
      let classification = { role: 'unknown', relation: null };
      if (coLeadClause && namePattern.test(coLeadClause[1]) && !isHistoricalRoundReference(sentence)) {
        classification = { role: 'co_lead', relation: 'CO_LED_ROUND' };
      } else if (leadClause && namePattern.test(leadClause[1]) && !isHistoricalRoundReference(sentence)) {
        classification = { role: 'lead', relation: 'LED_ROUND' };
      } else if (joinedClause && namePattern.test(joinedClause[1])) {
        classification = { role: 'participant', relation: 'PARTICIPATED_IN_ROUND' };
      } else if (syndicateClause && namePattern.test(syndicateClause[1])) {
        classification = { role: 'syndicate_member', relation: 'PARTICIPATED_IN_SYNDICATE' };
      } else if (participationClause && namePattern.test(participationClause[1])) {
        classification = { role: 'participant', relation: 'PARTICIPATED_IN_ROUND' };
      } else if (/\binvest(?:ed|s|ing) in\b/i.test(sentence) && namePattern.test(beforeName + name)) {
        classification = { role: 'participant', relation: 'INVESTED_IN' };
      }
      mentions.push({ investor, investorNameRaw: name, ...classification, evidencePhrase: sentence.slice(0, 1000) });
      seen.add(key);
      break;
    }
  }
  return mentions;
}

function cleanExplicitEntity(value) {
  return String(value || '')
    .replace(/^(?:existing|new|strategic|institutional)\s+investors?\s*/i, '')
    .replace(/\s*\([^)]{1,80}\)\s*$/, '')
    .replace(/^[\s,:-]+|[\s,:-]+$/g, '')
    .trim();
}

function plausibleExplicitEntity(value) {
  const name = cleanExplicitEntity(value);
  const words = name.split(/\s+/).filter(Boolean);
  return name.length >= 2 && name.length <= 80 && words.length <= 7
    && /[A-Z0-9]/.test(name[0] || '')
    && !/^(?:inc|incorporated|llc|ltd|plc|corp|corporation|ceo|cfo|coo|cto)$/i.test(name)
    && !/^(?:ceo|cfo|coo|cto|founder|co-founder|chairman|president)\b/i.test(name)
    && !/[$€£¥₹]|\b(?:round|funding|financing|company|startup|investor|investors|undisclosed|investment was|the round)\b/i.test(name)
    && !/\b(?:raised|raises|led|joined|participated|announced|bringing|supporting|expanding|founded|created|started|built)\b/i.test(name);
}

function splitExplicitEntities(clause) {
  return String(clause || '').split(/\s*,\s*|\s+and\s+|\s*&\s*/i)
    .map(cleanExplicitEntity).filter(plausibleExplicitEntity);
}

function extractExplicitParticipantMentions(text) {
  const normalizedText = String(text || '').replace(/\b(Inc|Ltd|Corp|LLC)\./g, '$1');
  const sentences = normalizedText.split(/(?<=[.!?])\s+|\n+/).map(value => value.trim()).filter(Boolean);
  const rules = [
    { role: 'co_lead', relation: 'CO_LED_ROUND', pattern: /(?:co[- ]led|jointly led)\s+by\s+(.+?)(?=,\s+(?:is|was|has|will|aims|plans|the company)\b|\bwith participation\b|\bparticipation from\b|\b(?:founded|created|started|built) by\b|\bbringing\b|\bthe company\b|\bwhich\b|[.;]|$)/ig },
    { role: 'lead', relation: 'LED_ROUND', pattern: /\bled\s+by\s+(.+?)(?=,\s+(?:is|was|has|will|aims|plans|the company)\b|\band\s+(?:was\s+)?co[- ]led\s+by\b|\bjoined by\b|\bwith participation\b|\bparticipation from\b|\b(?:founded|created|started|built) by\b|\bbringing\b|\bthe company\b|\bwhich\b|[.;]|$)/ig },
    { role: 'participant', relation: 'PARTICIPATED_IN_ROUND', pattern: /\bjoined by\s+(.+?)(?=\bwith participation\b|\bparticipation from\b|\b(?:founded|created|started|built) by\b|\bbringing\b|\bthe company\b|\bwhich\b|[.;]|$)/ig },
    { role: 'participant', relation: 'PARTICIPATED_IN_ROUND', pattern: /(?:with participation from|participation from)\s+(.+?)(?=\b(?:founded|created|started|built) by\b|\bbringing\b|\bthe company\b|\bwhich\b|\bto (?:support|expand|accelerate|build)\b|[.;]|$)/ig },
    { role: 'syndicate_member', relation: 'PARTICIPATED_IN_SYNDICATE', pattern: /(?:syndicate (?:included|includes)|participated in the syndicate[:,]?)\s+(.+?)(?=\bbringing\b|\bthe company\b|\bwhich\b|[.;]|$)/ig },
  ];
  const found = [];
  const seen = new Set();
  for (const sentence of sentences) {
    for (const rule of rules) {
      if (['lead', 'co_lead'].includes(rule.role) && isHistoricalRoundReference(sentence)) continue;
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(sentence)) !== null) {
        for (const name of splitExplicitEntities(match[1])) {
          const key = `${name.toLowerCase()}\0${rule.relation}`;
          if (seen.has(key)) continue;
          seen.add(key);
          found.push({ investorNameRaw: name, role: rule.role, relation: rule.relation, evidencePhrase: sentence.slice(0, 1000) });
        }
      }
    }
  }
  return found;
}

function deriveCoInvestmentEdges(participants, roundId) {
  if (!roundId) return [];
  const verified = participants
    .filter(item => item.investorId && item.verified === true && item.role !== 'unknown')
    .sort((a, b) => String(a.investorId).localeCompare(String(b.investorId)));
  const edges = [];
  for (let left = 0; left < verified.length; left++) {
    for (let right = left + 1; right < verified.length; right++) {
      edges.push({
        fromInvestorId: verified[left].investorId,
        toInvestorId: verified[right].investorId,
        relation: 'CO_INVESTED_WITH',
        roundId,
      });
    }
  }
  return edges;
}

function classifyNamedInvestorParticipation(text, investorName) {
  const mention = extractKnownInvestorMentions(text, [{ id: '__target__', name: investorName, firm: investorName }])[0];
  return mention
    ? { role: mention.role, relation: mention.relation, evidencePhrase: mention.evidencePhrase }
    : { role: 'unknown', relation: null, evidencePhrase: String(text || '').slice(0, 1000) };
}

module.exports = {
  PARTICIPATION_ROLES,
  ROLE_CONFIDENCE,
  classifyParticipationPhrase,
  isHistoricalRoundReference,
  extractKnownInvestorMentions,
  extractExplicitParticipantMentions,
  classifyNamedInvestorParticipation,
  deriveCoInvestmentEdges,
};
