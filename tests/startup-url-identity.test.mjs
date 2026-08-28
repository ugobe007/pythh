import test from 'node:test';
import assert from 'node:assert/strict';
import {
  namesLikelySameStartup,
  compactStartupName,
  isNonStartupBrandName,
  isParkingOrForsaleHost,
  shouldParkWebsiteTaken,
} from '../scripts/lib/startupUrlIdentity.mjs';

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

test('isNonStartupBrandName parks media/social brands', () => {
  assert.equal(isNonStartupBrandName('Instagram'), true);
  assert.equal(isNonStartupBrandName("Instagram's"), true);
  assert.equal(isNonStartupBrandName('Venturefizz'), true);
  assert.equal(isNonStartupBrandName('Mattermark'), true);
  assert.equal(isNonStartupBrandName('Fortus'), false);
});

test('isParkingOrForsaleHost detects dynadot landers', () => {
  assert.equal(isParkingOrForsaleHost('https://forsale.dynadot.com'), true);
  assert.equal(isParkingOrForsaleHost('https://fortus.ai'), false);
});

test('shouldParkWebsiteTaken for chronic clog cases', () => {
  assert.equal(
    shouldParkWebsiteTaken({
      name: 'Instagram',
      takenByWebsite: 'https://instagram.com',
      takenByOwnerName: "Instagram's",
    })?.reason,
    'non_startup_brand',
  );
  assert.equal(
    shouldParkWebsiteTaken({
      name: 'Mattermark',
      takenByWebsite: 'https://mattermark.com',
      takenByOwnerName: 'Makes',
    })?.reason,
    'non_startup_brand',
  );
  assert.equal(
    shouldParkWebsiteTaken({
      name: 'Kogito Ventures',
      takenByWebsite: 'https://forsale.dynadot.com',
      takenByOwnerName: 'BetHog',
    })?.reason,
    'parking_or_forsale_host',
  );
  assert.equal(
    shouldParkWebsiteTaken({
      name: 'SomeRealCo',
      takenByWebsite: 'https://somerealco.com',
      takenByOwnerName: 'Unrelated Junk',
    })?.reason,
    'website_taken_unrelated',
  );
});
