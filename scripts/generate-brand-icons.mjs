#!/usr/bin/env node
/**
 * Rebuild tab / home-screen / social images from the committed Pythia glyph.
 * Does not invent a new mark — resizes and tints the existing brand emblem.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const glyphPath = path.join(root, 'public/images/delphi-pythia-icon-glyph-dark.jpg');
const out = (name) => path.join(root, 'public', name);

const NAVY = { r: 10, g: 14, b: 19, alpha: 1 };
const CYAN = { r: 34, g: 211, b: 238, alpha: 1 };

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

async function emblemOnNavy(size, padRatio = 0.12) {
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);
  const glyph = await sharp(glyphPath)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tinted = Buffer.from(glyph.data);
  for (let i = 0; i < tinted.length; i += 4) {
    const luminance = (tinted[i] + tinted[i + 1] + tinted[i + 2]) / 3;
    if (luminance > 40) {
      tinted[i] = CYAN.r;
      tinted[i + 1] = CYAN.g;
      tinted[i + 2] = CYAN.b;
      tinted[i + 3] = 255;
    } else {
      tinted[i] = NAVY.r;
      tinted[i + 1] = NAVY.g;
      tinted[i + 2] = NAVY.b;
      tinted[i + 3] = 255;
    }
  }

  const emblem = await sharp(tinted, {
    raw: { width: glyph.info.width, height: glyph.info.height, channels: 4 },
  }).png().toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: NAVY },
  })
    .composite([{ input: emblem, left: pad, top: pad }])
    .png();
}

async function writePng(size, filename, padRatio) {
  const buffer = await (await emblemOnNavy(size, padRatio)).toBuffer();
  writeFileSync(out(filename), buffer);
  return buffer;
}

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xml:space="preserve">
  <rect width="1200" height="630" fill="#0a0e13"/>
  <rect x="0" y="622" width="1200" height="8" fill="#22d3ee"/>
  <text x="520" y="214" fill="#22d3ee" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="18" font-weight="700">PYTHH.AI</text>
  <text x="520" y="292" fill="#f8fafc" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="52" font-weight="700">Meet&#160;Your&#160;Investors.</text>
  <text x="520" y="352" fill="#cbd5e1" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="26">We&#160;connect&#160;the&#160;dots&#160;to&#160;fund&#160;your&#160;round.</text>
  <text x="520" y="430" fill="#94a3b8" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="20">Paste&#160;a&#160;startup&#160;URL.&#160;We&#160;rank&#160;investors&#160;for&#160;this&#160;raise.</text>
</svg>`;

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Pythh">
  <rect width="64" height="64" fill="#0a0e13"/>
  <circle cx="32" cy="28" r="14" fill="none" stroke="#22d3ee" stroke-width="2.4"/>
  <path d="M20 28c0-8 5.2-14 12-14s12 6 12 14" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="32" cy="24" r="3.2" fill="#22d3ee"/>
  <path d="M24 42c2.4 6 5.8 10 8 12 2.2-2 5.6-6 8-12" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M16 34c6 2 10 3.4 16 3.4S42 36 48 34" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

async function main() {
  const png16 = await writePng(16, 'favicon-16.png', 0.08);
  const png32 = await writePng(32, 'favicon-32.png', 0.08);
  const png48 = await writePng(48, 'favicon-48.png', 0.1);
  await writePng(180, 'apple-touch-icon.png', 0.12);
  await writePng(512, 'icon-512.png', 0.12);
  writeFileSync(out('favicon.ico'), pngToIco([
    { size: 16, buffer: png16 },
    { size: 32, buffer: png32 },
    { size: 48, buffer: png48 },
  ]));
  writeFileSync(out('favicon.svg'), faviconSvg);

  const ogEmblem = await (await emblemOnNavy(420, 0.1)).toBuffer();
  const og = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: NAVY },
  })
    .composite([
      { input: Buffer.from(ogSvg), top: 0, left: 0 },
      { input: ogEmblem, left: 56, top: 105 },
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
    background_color: '#0a0e13',
    theme_color: '#0a0e13',
    icons: [
      { src: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    wrote: [
      'favicon.ico', 'favicon.svg', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png',
      'apple-touch-icon.png', 'icon-512.png', 'og-image.png', 'site.webmanifest',
    ],
  }));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
