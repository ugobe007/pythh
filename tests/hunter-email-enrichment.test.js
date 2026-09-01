const assert = require('node:assert/strict');
const test = require('node:test');

test('isInvestorPosition recognizes partner and GP titles', async () => {
  const { isInvestorPosition, isFounderPosition } = await import('../lib/hunterIo.mjs');
  assert.equal(isInvestorPosition('General Partner'), true);
  assert.equal(isInvestorPosition('Managing Director, Investments'), true);
  assert.equal(isInvestorPosition('Investment Associate'), true);
  assert.equal(isInvestorPosition('Software Engineer'), false);
  assert.equal(isFounderPosition('Co-Founder & CEO'), true);
});

test('resolveInvestorContact prefers verified email on file', async () => {
  const { resolveInvestorContact } = await import('../lib/resolveInvestorContact.mjs');
  const contact = await resolveInvestorContact({
    name: 'Jane Doe',
    firm: 'Example Capital',
    url: 'https://example.vc',
    email: 'jane@example.vc',
    email_status: 'verified',
  }, { useHunter: false });
  assert.equal(contact.email, 'jane@example.vc');
  assert.equal(contact.source, 'verified_on_file');
});

test('resolveFounderContact uses cached outreach_contact', async () => {
  const { resolveFounderContact } = await import('../lib/resolveFounderContact.mjs');
  const contact = await resolveFounderContact({
    name: 'Acme',
    website: 'https://acme.com',
    extracted_data: {
      outreach_contact: {
        email: 'founder@acme.com',
        source: 'hunter_domain_search',
        email_type: 'personal',
        person_name: 'Ada Lovelace',
      },
    },
  }, { useHunter: false });
  assert.equal(contact.email, 'founder@acme.com');
  assert.equal(contact.source, 'hunter_domain_search');
});

test('hunter enrichment scripts are wired in package.json', async () => {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.ok(pkg.scripts['enrich:emails:hunter']);
  assert.ok(pkg.scripts['enrich:founder-emails']);
});
