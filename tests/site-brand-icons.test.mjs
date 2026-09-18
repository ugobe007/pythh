import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'site/index.html'), 'utf8');
const vercel = readFileSync(path.join(root, 'vercel.json'), 'utf8');

const requiredPublic = [
  'favicon.ico',
  'favicon.svg',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-512.png',
  'og-image.png',
  'site.webmanifest',
  'images/delphi-pythia-icon-glyph-dark.jpg',
  'images/delphi-pythia-icon-glyph-dark.png',
];

for (const name of requiredPublic) {
  const file = path.join(root, 'public', name);
  assert.equal(existsSync(file), true, `missing public/${name}`);
  assert.ok(statSync(file).size > 80, `public/${name} is empty`);
}

// The cyan-tinted 32px set was 235 bytes and invisible on dark tabs.
assert.ok(
  statSync(path.join(root, 'public/favicon-32.png')).size > 400,
  'favicon-32.png is still the collapsed cyan-on-navy blob',
);
assert.ok(
  statSync(path.join(root, 'public/apple-touch-icon.png')).size > 4000,
  'apple-touch-icon.png should be the full white-on-black glyph',
);

assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png\?v=glyph2"/);
assert.match(html, /rel="shortcut icon" href="\/favicon\.ico\?v=glyph2"/);
assert.match(html, /delphi-pythia-icon-glyph-dark\.jpg\?v=glyph2/);
assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png\?v=glyph2"/);
assert.match(html, /og:image" content="https:\/\/pythh\.ai\/og-image\.png\?v=glyph2"/);
assert.match(html, /twitter:image" content="https:\/\/pythh\.ai\/og-image\.png\?v=glyph2"/);
assert.match(html, /apple-touch-icon\.png\?v=glyph2/);
assert.match(vercel, /favicon\|apple-touch-icon\|og-image/);

const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
assert.match(svg, /data:image\/png;base64,/);
assert.doesNotMatch(svg, /stroke="#22d3ee"/);

const ico = readFileSync(path.join(root, 'public/favicon.ico'));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.ok(ico.readUInt16LE(4) >= 1);

const og = readFileSync(path.join(root, 'public/og-image.png'));
assert.equal(og[0], 0x89);
assert.equal(og[1], 0x50);
assert.equal(og[2], 0x4e);
assert.equal(og[3], 0x47);
