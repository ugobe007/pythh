const assert = require('node:assert/strict');
const test = require('node:test');
const { youtubeEmbedUrl, evidenceHash, validateSnippet, graphPredicates } = require('../lib/videoEvidence');

test('builds source-hosted timestamped embeds instead of stored video files', () => {
  assert.equal(youtubeEmbedUrl('abcDEF_123', 42), 'https://www.youtube.com/embed/abcDEF_123?start=42');
  assert.equal(youtubeEmbedUrl('../bad', 0), null);
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
