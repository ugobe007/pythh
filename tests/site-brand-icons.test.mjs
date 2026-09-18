import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'site/index.html'), 'utf8');

const requiredPublic = [
  'favicon.ico',
  'favicon.svg',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-512.png',
  'og-image.png',
  'site.webmanifest',
];

for (const name of requiredPublic) {
  const file = path.join(root, 'public', name);
  assert.equal(existsSync(file), true, `missing public/${name}`);
  assert.ok(statSync(file).size > 80, `public/${name} is empty`);
}

assert.match(html, /rel="icon" href="\/favicon\.ico"/);
assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/);
assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
assert.match(html, /rel="manifest" href="\/site\.webmanifest"/);
assert.match(html, /og:image" content="https:\/\/pythh\.ai\/og-image\.png"/);
assert.match(html, /twitter:image" content="https:\/\/pythh\.ai\/og-image\.png"/);
assert.match(html, /"logo": "https:\/\/pythh\.ai\/apple-touch-icon\.png"/);

const ico = readFileSync(path.join(root, 'public/favicon.ico'));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.ok(ico.readUInt16LE(4) >= 1);

const og = readFileSync(path.join(root, 'public/og-image.png'));
assert.equal(og[0], 0x89);
assert.equal(og[1], 0x50);
assert.equal(og[2], 0x4e);
assert.equal(og[3], 0x47);
