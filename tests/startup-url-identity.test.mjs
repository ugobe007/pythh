import test from 'node:test';
import assert from 'node:assert/strict';
import { namesLikelySameStartup, compactStartupName } from '../scripts/lib/startupUrlIdentity.mjs';

test('compactStartupName strips suffixes and punctuation', () => {
  assert.equal(compactStartupName('X-Bow Systems'), 'xbow');
  assert.equal(compactStartupName('XBOW'), 'xbow');
  assert.equal(compactStartupName('Enigma Technologies'), 'enigma');
});

test('namesLikelySameStartup matches case and hyphen variants', () => {
  assert.equal(namesLikelySameStartup('Xbow', 'XBOW'), true);
  assert.equal(namesLikelySameStartup('Xbow', 'X-Bow Systems'), true);
  assert.equal(namesLikelySameStartup('Enigma', 'Enigma Technologies'), true);
});

test('namesLikelySameStartup rejects unrelated companies', () => {
  assert.equal(namesLikelySameStartup('Instagram', 'Mattermark'), false);
  assert.equal(namesLikelySameStartup('Canaan', 'First Horizon'), false);
  assert.equal(namesLikelySameStartup('Vertical', 'Flip'), false);
});
