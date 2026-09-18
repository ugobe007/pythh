#!/usr/bin/env node
/**
 * Rebuild tab / home-screen / social images from the committed Pythia glyph.
 * Uses the exact white-on-black mark — no recolor, no substitute SVG doodle.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const glyphPath = path.join(root, 'public/images/delphi-pythia-icon-glyph-dark.png');
const out = (name) => path.join(root, 'public', name);

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

function pngToIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  const chunks = [header, dir];
  images.forEach((image, i) => {
    const o = i * 16;
    dir.writeUInt8(image.size >= 256 ? 0 : image.size, o);
    dir.writeUInt8(image.size >= 256 ? 0 : image.size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(image.buffer.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += image.buffer.length;
    chunks.push(image.buffer);
  });
  return Buffer.concat(chunks);
}

async function emblemSquare(size, padRatio = 0.06) {
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);
  const glyph = await sharp(glyphPath)
    .resize(inner, inner, { fit: 'contain', background: BLACK })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BLACK },
  })
    .composite([{ input: glyph, left: pad, top: pad }])
    .png()
    .toBuffer();
}

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xml:space="preserve">
  <rect width="1200" height="630" fill="#000000"/>
  <text x="560" y="230" fill="#f8fafc" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="22" font-weight="700">PYTHH.AI</text>
  <text x="560" y="308" fill="#ffffff" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="48" font-weight="700">Meet&#160;Your&#160;Investors.</text>
  <text x="560" y="368" fill="#d4d4d8" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="24">We&#160;connect&#160;the&#160;dots&#160;to&#160;fund&#160;your&#160;round.</text>
</svg>`;

async function main() {
  const png16 = await emblemSquare(16, 0.04);
  const png32 = await emblemSquare(32, 0.04);
  const png48 = await emblemSquare(48, 0.05);
  const png180 = await emblemSquare(180, 0.06);
  const png512 = await emblemSquare(512, 0.06);
  const png64 = await emblemSquare(64, 0.04);

  writeFileSync(out('favicon-16.png'), png16);
  writeFileSync(out('favicon-32.png'), png32);
  writeFileSync(out('favicon-48.png'), png48);
  writeFileSync(out('apple-touch-icon.png'), png180);
  writeFileSync(out('icon-512.png'), png512);
  writeFileSync(out('favicon.ico'), pngToIco([
    { size: 16, buffer: png16 },
    { size: 32, buffer: png32 },
    { size: 48, buffer: png48 },
  ]));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Pythh">
  <image href="data:image/png;base64,${png64.toString('base64')}" width="64" height="64"/>
</svg>
`;
  writeFileSync(out('favicon.svg'), svg);

  const ogEmblem = await emblemSquare(460, 0.04);
  const og = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: BLACK },
  })
    .composite([
      { input: Buffer.from(ogSvg), top: 0, left: 0 },
      { input: ogEmblem, left: 48, top: 85 },
    ])
    .png()
    .toBuffer();
  writeFileSync(out('og-image.png'), og);

  writeFileSync(out('site.webmanifest'), `${JSON.stringify({
    name: 'Pythh.ai',
    short_name: 'Pythh',
    description: 'Meet Your Investors. We connect the dots to fund your round.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/favicon-32.png?v=glyph2', sizes: '32x32', type: 'image/png' },
      { src: '/apple-touch-icon.png?v=glyph2', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512.png?v=glyph2', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    source: 'public/images/delphi-pythia-icon-glyph-dark.png',
    bytes: {
      'favicon-16.png': png16.length,
      'favicon-32.png': png32.length,
      'favicon.ico': (16 + 32 + 48) && undefined,
      'apple-touch-icon.png': png180.length,
      'og-image.png': og.length,
    },
  }));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
