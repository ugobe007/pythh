const assert = require('node:assert/strict');
const test = require('node:test');
const { TOP_STARTUP_COUNT, uniqueTopStartups } = require('../lib/investorTopMatchesAgent');
const { readFileSync } = require('node:fs');

test('selects exactly three unique approved startups from canonical matches', () => {
  const rows = [
    { startup_id:'a', match_score:91, startup_uploads:{ id:'a', name:'Alpha', status:'approved' } },
    { startup_id:'b', match_score:96, startup_uploads:{ id:'b', name:'Beta', status:'approved' } },
    { startup_id:'c', match_score:95, startup_uploads:{ id:'c', name:'Bad', status:'quarantined' } },
    { startup_id:'a', match_score:89, startup_uploads:{ id:'a', name:'Alpha', status:'approved' } },
    { startup_id:'d', match_score:88, startup_uploads:{ id:'d', name:'Delta', status:'approved' } },
    { startup_id:'e', match_score:87, startup_uploads:{ id:'e', name:'Echo', status:'approved' } },
  ];
  const selected = uniqueTopStartups(rows);
  assert.equal(selected.length, TOP_STARTUP_COUNT);
  assert.deepEqual(selected.map((row) => row.name), ['Beta', 'Alpha', 'Delta']);
});

test('dry runs never transmit investor emails to ZeroBounce', () => {
  const source = readFileSync(require.resolve('../scripts/peter-investor-outreach.mjs'), 'utf8');
  assert.match(source, /if \(!DRY_RUN && hasZeroBounce\(\)\) validation = await validateEmail\(email\)/);
  assert.match(source, /\.eq\('email_status', 'verified'\)/);
  assert.doesNotMatch(source, /\['verified', 'inferred'\]/);
});
