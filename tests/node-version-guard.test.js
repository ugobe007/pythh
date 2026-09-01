const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('.nvmrc pins Node 22 LTS', async () => {
  const { readFile } = await import('node:fs/promises');
  const nvmrc = (await readFile('.nvmrc', 'utf8')).trim();
  assert.equal(nvmrc, '22');
});

test('package.json engines block Node 24+', async () => {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(pkg.engines.node, /<24/);
});

test('check-node-version passes on supported Node', () => {
  const result = spawnSync(process.execPath, ['scripts/check-node-version.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('run-node wrapper forwards to child script', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/run-node.mjs', 'scripts/check-node-version.mjs'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
