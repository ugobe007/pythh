const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isBlockedStartupWebsite,
  pickOutreachWebsite,
  startupNameMatchesDomain,
  isOutreachHeadlineName,
  emailDomainMatchesStartup,
} = require('../lib/investorEmailInfer');

test('company product paths are hunt-able; aggregator and dated news paths are not', () => {
  assert.equal(isBlockedStartupWebsite('https://baseten.co/blog/we-raised').blocked, false);
  assert.equal(isBlockedStartupWebsite('https://getpie.com/product/analytics').blocked, false);
  assert.equal(isBlockedStartupWebsite('https://techcrunch.com/2026/09/20/pie-raises').blocked, true);
  assert.equal(isBlockedStartupWebsite('https://sifted.eu/articles/foo-raises').reason.startsWith('aggregator_domain'), true);
  assert.equal(isBlockedStartupWebsite('https://obscure.news/2026/09/20/startup-raises-5m').reason, 'article_url');
});

test('recovers company_domain when website is a scrape article', () => {
  const picked = pickOutreachWebsite({
    name: 'Baseten',
    website: 'https://techcrunch.com/2026/09/20/baseten-raises',
    company_domain: 'baseten.co',
  });
  assert.equal(picked.rejected, undefined);
  assert.equal(picked.domain, 'baseten.co');
  assert.equal(picked.source, 'company_domain');
});

test('name-domain match allows get/use prefixes and 3-letter brands', () => {
  assert.equal(startupNameMatchesDomain('Pie', 'getpie.com'), true);
  assert.equal(startupNameMatchesDomain('Together AI', 'together.ai'), true);
  assert.equal(startupNameMatchesDomain('Carbon Six', 'carbonsix.xyz'), true);
  assert.equal(startupNameMatchesDomain('Baseten', 'techcrunch.com'), false);
});

test('headline leftover names are gated before Hunter', () => {
  assert.equal(isOutreachHeadlineName('Nirvana Nearly Doubles'), true);
  assert.equal(isOutreachHeadlineName('Baseten'), false);
  assert.equal(isOutreachHeadlineName('Together AI'), false);
});

test('Hunter email may match any recovered company domain', () => {
  assert.equal(
    emailDomainMatchesStartup('ada@baseten.co', {
      website: 'https://techcrunch.com/2026/09/20/baseten-raises',
      company_domain: 'baseten.co',
    }),
    true,
  );
  assert.equal(
    emailDomainMatchesStartup('ada@other.com', {
      website: 'https://baseten.co',
    }),
    false,
  );
});
