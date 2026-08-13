const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

test('Submit URL routers mount without synchronously loading the TypeScript scraper', () => {
  const script = `
    require('./server/routes/instantSubmit');
    require('./server/routes/discoverySubmit');
    process.stdout.write('mounted');
    process.exit(0);
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'staging-boundary-test-key',
    },
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(result.error?.code, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /mounted$/);
});

test('scraper loader preserves the service call boundary', async () => {
  const loader = require('../server/services/urlScrapingServiceLoader');
  assert.equal(typeof loader.scrapeAndScoreStartup, 'function');
  assert.equal(typeof loader.updateStartupWithScrapedData, 'function');
  assert.equal(typeof loader.loadUrlScrapingService, 'function');
});
