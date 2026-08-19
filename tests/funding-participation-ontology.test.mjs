import assert from 'node:assert/strict';
import test from 'node:test';
import ontology from '../server/lib/fundingParticipationOntology.js';

const { classifyParticipationPhrase, extractKnownInvestorMentions, extractExplicitParticipantMentions, classifyNamedInvestorParticipation, isHistoricalRoundReference, deriveCoInvestmentEdges } = ontology;

test('keeps investment, leadership, round participation, and syndicate participation distinct', () => {
  assert.deepEqual(classifyParticipationPhrase('Northstar invested in Acme'), { role: 'participant', relation: 'INVESTED_IN' });
  assert.deepEqual(classifyParticipationPhrase('Northstar led the round'), { role: 'lead', relation: 'LED_ROUND' });
  assert.deepEqual(classifyParticipationPhrase('Northstar and Atlas co-led the financing'), { role: 'co_lead', relation: 'CO_LED_ROUND' });
  assert.deepEqual(classifyParticipationPhrase('Northstar participated in the round'), { role: 'participant', relation: 'PARTICIPATED_IN_ROUND' });
  assert.deepEqual(classifyParticipationPhrase('Northstar participated in the syndicate'), { role: 'syndicate_member', relation: 'PARTICIPATED_IN_SYNDICATE' });
});

test('separates lead from co-lead when both occur in one sentence', () => {
  const investors = [
    { id: 'citius', name: 'Citius', firm: 'Citius' },
    { id: 'btg', name: 'BTG Pactual', firm: 'BTG Pactual' },
  ];
  const mentions = extractKnownInvestorMentions('Addi announced an $85M Series D led by Citius and co-led by BTG Pactual.', investors);
  assert.deepEqual(mentions.map(row => [row.investor.id, row.role, row.relation]), [
    ['citius', 'lead', 'LED_ROUND'],
    ['btg', 'co_lead', 'CO_LED_ROUND'],
  ]);
});

test('stops lead clauses before joined-by participants', () => {
  const sentence = 'The round was led by IQ Capital, joined by Rhapsody Venture Partners, Zero Carbon Capital and Empirical Ventures.';
  const mentions = extractExplicitParticipantMentions(sentence);
  assert.deepEqual(mentions.map(row => [row.investorNameRaw, row.role, row.relation]), [
    ['IQ Capital', 'lead', 'LED_ROUND'],
    ['Rhapsody Venture Partners', 'participant', 'PARTICIPATED_IN_ROUND'],
    ['Zero Carbon Capital', 'participant', 'PARTICIPATED_IN_ROUND'],
    ['Empirical Ventures', 'participant', 'PARTICIPATED_IN_ROUND'],
  ]);
  assert.deepEqual(classifyNamedInvestorParticipation(sentence, 'Empirical Ventures'), {
    role: 'participant', relation: 'PARTICIPATED_IN_ROUND', evidencePhrase: sentence,
  });
});

test('extracts unresolved firms only from explicit participation clauses', () => {
  const mentions = extractExplicitParticipantMentions('The Series A was led by Alpha Ventures with participation from Beta Capital, Gamma Fund and Y Combinator. The startup was backed by Famous Person.');
  assert.deepEqual(mentions.map(row => [row.investorNameRaw, row.relation]), [
    ['Alpha Ventures', 'LED_ROUND'],
    ['Beta Capital', 'PARTICIPATED_IN_ROUND'],
    ['Gamma Fund', 'PARTICIPATED_IN_ROUND'],
    ['Y Combinator', 'PARTICIPATED_IN_ROUND'],
  ]);
});

test('explicit clauses stop before founder biography and reject legal suffix fragments', () => {
  const mentions = extractExplicitParticipantMentions('The round was led by Northzone, founded by former TikTok and Snapchat leaders, with participation from Penumbra, Inc. and Valid Ventures.');
  assert.deepEqual(mentions.map(row => row.investorNameRaw), ['Northzone', 'Penumbra', 'Valid Ventures']);
});

test('lead clauses stop before a new grammatical clause', () => {
  const mentions = extractExplicitParticipantMentions('A $12.3M round led by Northzone, is taking on Facebook, TikTok, Snapchat, and Instagram.');
  assert.deepEqual(mentions.map(row => row.investorNameRaw), ['Northzone']);
});

test('prior-round leadership is not attributed to the current event', () => {
  const sentence = 'Following last year’s $108M Series C round led by G2 Venture Partners and SoftBank Vision Fund 2, total funding exceeds $180M.';
  assert.equal(isHistoricalRoundReference(sentence), true);
  assert.deepEqual(extractExplicitParticipantMentions(sentence), []);
  const known = extractKnownInvestorMentions(sentence, [{ id: 'g2', name: 'G2 Venture Partners' }]);
  assert.equal(known[0].relation, null);
  assert.equal(known[0].role, 'unknown');
});

test('does not infer a participation relationship from ambiguous backing language', () => {
  assert.deepEqual(classifyParticipationPhrase('Acme is backed by notable investors'), { role: 'unknown', relation: null });
});

test('extracts known investors from article evidence without assigning one clause to every firm', () => {
  const investors = [
    { id: 'sound', name: 'Sound Ventures' },
    { id: 'true', name: 'True Ventures' },
    { id: 'offline', name: 'Offline Ventures' },
  ];
  const text = 'The Series A was led by Sound Ventures and True Ventures, with participation from Offline Ventures.';
  const mentions = extractKnownInvestorMentions(text, investors);
  assert.deepEqual(mentions.map(item => [item.investor.id, item.relation]), [
    ['sound', 'LED_ROUND'],
    ['true', 'LED_ROUND'],
    ['offline', 'PARTICIPATED_IN_ROUND'],
  ]);
  assert.ok(mentions.every(item => item.evidencePhrase === text));
});

test('keeps a named firm unknown when the article only says backed by', () => {
  const [mention] = extractKnownInvestorMentions('OpenAI-backed Acme raised $20M.', [{ id: 'openai', name: 'OpenAI' }]);
  assert.equal(mention.relation, null);
  assert.equal(mention.role, 'unknown');
});

test('derives co-investment only from verified participants in the same round', () => {
  const edges = deriveCoInvestmentEdges([
    { investorId: 'a', verified: true, role: 'lead' },
    { investorId: 'b', verified: true, role: 'participant' },
    { investorId: 'c', verified: false, role: 'participant' },
  ], 'round-1');
  assert.deepEqual(edges, [{ fromInvestorId: 'a', toInvestorId: 'b', relation: 'CO_INVESTED_WITH', roundId: 'round-1' }]);
  assert.deepEqual(deriveCoInvestmentEdges([{ investorId: 'a', verified: true, role: 'lead' }], null), []);
});
