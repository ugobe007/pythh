#!/usr/bin/env node
/**
 * Pythia Breathing GIF Generator
 * ================================
 * Creates a looping animated GIF of the Pythia medallion "breathing" —
 * a subtle sinusoidal scale + glow pulse that looks organic and alive.
 *
 * Output: public/pythia-breathing.gif  (400x400, loops forever)
 * Twitter: upload as profile pic or pinned tweet image
 *
 * Usage:
 *   node scripts/make-pythia-gif.js
 *   node scripts/make-pythia-gif.js --size=600 --frames=48
 */

const sharp = require('sharp');
const GifEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CONFIG — tweak these to taste
// ---------------------------------------------------------------------------
const SIZE       = 400;  // output pixel dimensions (square)
const FRAMES     = 48;   // frames per cycle — more = smoother, larger file
const DELAY      = 50;   // ms per frame → 48 frames × 50ms = 2.4s per breath
const MAX_SCALE  = 0.06; // how much to "zoom in" at peak inhale (6% = very subtle)
const MAX_GLOW   = 0.18; // brightness boost at peak inhale (18% = visible but natural)
const QUALITY    = 8;    // GIF palette quality: 1 (best) – 20 (fast/small)

// Parse CLI overrides
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.replace('--', '').split('=');
  if (k === 'size')   global._size   = parseInt(v);
  if (k === 'frames') global._frames = parseInt(v);
}
const size   = global._size   || SIZE;
const frames = global._frames || FRAMES;

// ---------------------------------------------------------------------------
// PATHS — prefer the glowing version if it exists
// ---------------------------------------------------------------------------
const candidates = [
  path.join(__dirname, '../public/images/delphi-pythia-icon-in-glyph-style-vector_glowing.jpg'),
  path.join(__dirname, '../public/images/delphi-pythia-icon-in-glyph-style-vector.jpg'),
];
const inputPath = candidates.find(fs.existsSync);
if (!inputPath) {
  console.error('❌ Could not find Pythia icon in public/images/');
  console.error('   Expected: delphi-pythia-icon-in-glyph-style-vector.jpg');
  process.exit(1);
}

const outputPath = path.join(__dirname, '../public/pythia-breathing.gif');

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function generate() {
  console.log('🔮 Pythia Breathing GIF Generator');
  console.log('==================================');
  console.log(`📂 Input:   ${path.basename(inputPath)}`);
  console.log(`📐 Size:    ${size}×${size}px`);
  console.log(`🎞  Frames:  ${frames} @ ${DELAY}ms = ${((frames * DELAY) / 1000).toFixed(1)}s cycle`);
  console.log(`✨ Scale:   +${(MAX_SCALE * 100).toFixed(0)}% at peak inhale`);
  console.log(`💡 Glow:    +${(MAX_GLOW * 100).toFixed(0)}% brightness at peak inhale`);
  console.log('');

  // Set up GIF encoder (gif-encoder-2 accumulates data in encoder.out)
  const encoder = new GifEncoder(size, size);
  encoder.setDelay(DELAY);
  encoder.setQuality(QUALITY);
  encoder.setRepeat(0); // 0 = loop forever
  encoder.start();

  console.log('🫁 Generating frames...');
  const startTime = Date.now();

  for (let i = 0; i < frames; i++) {
    // Sinusoidal breathing: smooth 0→1→0 cycle
    // Phase offset by -π/2 so it starts at the exhale (natural resting state)
    const phase = (i / frames) * Math.PI * 2;
    const breath = (Math.sin(phase - Math.PI / 2) + 1) / 2; // 0 at start, peaks at midframe

    // Scale: zoom in slightly on inhale (we upscale then center-crop back to SIZE)
    const scale      = 1.0 + breath * MAX_SCALE;
    const scaledSize = Math.round(size * scale);
    const cropOffset = Math.floor((scaledSize - size) / 2);

    // Brightness: subtle glow at inhale peak
    const brightness = 1.0 + breath * MAX_GLOW;

    // Build frame using sharp: resize → crop → brighten → raw RGBA
    const { data } = await sharp(inputPath)
      .resize(scaledSize, scaledSize, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .extract({
        left:   cropOffset,
        top:    cropOffset,
        width:  size,
        height: size,
      })
      .modulate({ brightness })
      .ensureAlpha()   // RGBA needed by gif-encoder-2
      .raw()
      .toBuffer({ resolveWithObject: true });

    encoder.addFrame(data);

    // Progress bar
    const pct = Math.round(((i + 1) / frames) * 30);
    process.stdout.write(`\r  [${'█'.repeat(pct)}${'░'.repeat(30 - pct)}] ${i + 1}/${frames}`);
  }

  encoder.finish();

  const gifBuffer = encoder.out.getData();
  fs.writeFileSync(outputPath, gifBuffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const fileSize = (gifBuffer.length / 1024).toFixed(0);

  console.log(`\n\n✅ Done in ${elapsed}s`);
  console.log(`📦 Output:  ${outputPath}`);
  console.log(`💾 Size:    ${fileSize} KB`);
  console.log('');
  console.log('🐦 Twitter tips:');
  console.log('   - Profile pic: upload directly (Twitter auto-loops GIFs)');
  console.log('   - Pinned tweet: attach as media for full quality');
  console.log('   - Max file size: 15MB (this should be well under)');
  console.log('');
}

generate().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
