const assert = require('node:assert/strict');
const test = require('node:test');
const { youtubeEmbedUrl, normalizeConfidence, evidenceHash, validateSnippet, graphPredicates, scoreVideoCandidate, discoveryQueries } = require('../lib/videoEvidence');

test('builds source-hosted timestamped embeds instead of stored video files', () => {
  assert.equal(youtubeEmbedUrl('abcDEF_123', 42), 'https://www.youtube.com/embed/abcDEF_123?start=42');
  assert.equal(youtubeEmbedUrl('../bad', 0), null);
});

test('normalizes model confidence percentages before database writes', () => {
  assert.equal(normalizeConfidence(95), 0.95);
  assert.equal(normalizeConfidence(0.91), 0.91);
  assert.equal(normalizeConfidence(150), 1);
  assert.equal(normalizeConfidence('invalid'), 0);
});

test('requires exact entity identity plus video intent for high-confidence discovery', () => {
  const strong = scoreVideoCandidate({ entityName:'Acme Robotics', entityDomain:'acmerobotics.ai', title:'Acme Robotics product demo', description:'Founder walkthrough', channelTitle:'Acme Robotics', kind:'startup' });
  assert.ok(strong.score >= 0.9);
  const collision = scoreVideoCandidate({ entityName:'Acme Robotics', title:'Acme retail store tour', description:'Unrelated', channelTitle:'News', kind:'startup' });
  assert.equal(collision.score, 0);
  const commonName = scoreVideoCandidate({ entityName:'Soleil', entityDomain:'soleil.com', title:'Tom Ford Soleil product demo', description:'Cosmetics', channelTitle:'Beauty Reviews', kind:'startup' });
  assert.equal(commonName.score, 0);
  assert.deepEqual(commonName.reasons, ['ambiguous_single_token_without_channel_identity']);
  const misleadingChannel = scoreVideoCandidate({ entityName:'Soleil', entityDomain:'soleil.com', title:'The Trio Miracle Oil By Soleil', description:'Product beauty routine', channelTitle:'Soleil', kind:'startup' });
  assert.equal(misleadingChannel.score, 0);
  assert.deepEqual(misleadingChannel.reasons, ['ambiguous_single_token_without_domain_evidence']);
  const verifiedSingleName = scoreVideoCandidate({ entityName:'Soleil', entityDomain:'soleil.ai', title:'Soleil product demo', description:'Learn more at soleil.ai', channelTitle:'Soleil', kind:'startup' });
  assert.ok(verifiedSingleName.score >= 0.9);
  const numericCollision = scoreVideoCandidate({ entityName:'B Capital', entityDomain:'b.capital', title:'A $1B capital investment in Noblesville', description:'Local news', channelTitle:'News 8', kind:'investor' });
  assert.equal(numericCollision.score, 0);
});

test('uses separate discovery intents for startups and investors', () => {
  assert.match(discoveryQueries({ entityType:'startup', name:'Acme' })[0], /product demo/);
  assert.match(discoveryQueries({ entityType:'investor', name:'Index' })[0], /investment thesis/);
});

test('enforces entity-specific evidence and short timestamp windows', () => {
  assert.deepEqual(validateSnippet({ entityType:'startup', evidenceType:'product_demo', startSeconds:10, endSeconds:50, excerpt:'Live demo' }), { ok:true });
  assert.equal(validateSnippet({ entityType:'startup', evidenceType:'investment_thesis', startSeconds:10, endSeconds:50, excerpt:'No' }).ok, false);
  assert.equal(validateSnippet({ entityType:'investor', evidenceType:'investment_thesis', startSeconds:0, endSeconds:100, excerpt:'Too long' }).ok, false);
});

test('creates deterministic dedupe hashes and graph predicates', () => {
  const row = { platform:'youtube', externalVideoId:'abc12345', entityType:'investor', entityId:'i1', startSeconds:4, endSeconds:35, evidenceType:'sector_preference', excerpt:'We invest in robotics.', normalizedClaim:{ sectors:['Robotics'] }, confidence:0.91 };
  assert.equal(evidenceHash(row), evidenceHash(row));
  assert.deepEqual(graphPredicates(row).map((edge) => edge.predicate), ['has_video_evidence', 'states_sector_preference']);
});
