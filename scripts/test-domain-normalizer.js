#!/usr/bin/env node
/**
 * test-domain-normalizer.js
 * Minimal unit tests (node scripts/test-domain-normalizer.js)
 */
const assert = require('assert');
const { normalizeCompanyDomain } = require('./startup-domain-normalizer');

function run() {
  // 1) website is publisher article; source_url is also publisher; linkedin has company page
  {
    const row = {
      name: 'Acme Robotics',
      website: 'https://techcrunch.com/2025/01/01/acme-robotics-raises-10m/',
      source_url: 'https://techcrunch.com/2025/01/01/acme-robotics-raises-10m/',
      linkedin: 'https://www.linkedin.com/company/acme-robotics/',
      tagline: 'Acme Robotics builds warehouse bots. Visit https://acmerobotics.com',
      pitch: '',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, 'acmerobotics.com');
    assert.ok(out.company_domain_confidence >= 0.6, `Expected confidence >= 0.6, got ${out.company_domain_confidence}`);
    console.log('  ✅ Test 1: Publisher article + tagline domain → picks company domain');
  }

  // 2) website contains real domain
  {
    const row = {
      name: 'BrightPay',
      website: 'https://www.brightpay.com/',
      source_url: 'https://pulse2.com/brightpay-series-a/',
      linkedin: '',
      tagline: 'Payroll for SMEs',
      pitch: '',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, 'brightpay.com');
    assert.ok(out.domain_source === 'website', `Expected source=website, got ${out.domain_source}`);
    console.log('  ✅ Test 2: Clean website field → picks website domain');
  }

  // 3) Only email domain present in pitch
  {
    const row = {
      name: 'NovaAI',
      website: 'https://medium.com/@novaai/launch',
      source_url: '',
      linkedin: '',
      tagline: 'Contact us',
      pitch: 'Email founders@novaai.io to join beta.',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, 'novaai.io');
    assert.ok(out.company_domain_confidence >= 0.6, `Expected confidence >= 0.6, got ${out.company_domain_confidence}`);
    console.log('  ✅ Test 3: Email domain extraction → picks email domain');
  }

  // 4) Only publisher domains everywhere -> NULL
  {
    const row = {
      name: 'MysteryCo',
      website: 'https://tech.eu/2025/02/02/mysteryco/',
      source_url: 'https://tech.eu/2025/02/02/mysteryco/',
      linkedin: 'https://www.linkedin.com/posts/someone_mysteryco-activity-123',
      tagline: 'Read more on Tech.eu',
      pitch: '',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, null);
    assert.strictEqual(out.domain_source, 'none');
    console.log('  ✅ Test 4: All publishers → NULL company_domain');
  }

  // 5) discovery_source_url correctly identifies article URL
  {
    const row = {
      name: 'FooBar',
      website: 'https://foobar.io',
      source_url: 'https://techcrunch.com/2025/03/15/foobar-raises-series-b/',
      linkedin: '',
      tagline: '',
      pitch: '',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, 'foobar.io');
    assert.ok(out.discovery_source_url && out.discovery_source_url.includes('techcrunch.com'),
      `Expected discovery_source_url to include techcrunch.com, got ${out.discovery_source_url}`);
    console.log('  ✅ Test 5: discovery_source_url correctly set to article URL');
  }

  // 6) Bare domain without scheme
  {
    const row = {
      name: 'Air',
      website: 'air.ai',
      source_url: null,
      linkedin: '',
      tagline: '',
      pitch: '',
      description: '',
    };
    const out = normalizeCompanyDomain(row);
    assert.strictEqual(out.company_domain, 'air.ai');
    console.log('  ✅ Test 6: Bare domain (no scheme) → normalized correctly');
  }

  console.log('\n✅ All domain normalizer tests passed\n');
}

run();
