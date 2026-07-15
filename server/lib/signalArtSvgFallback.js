'use strict';

/**
 * SVG → JPEG fallback when Gemini raster is unavailable (tier limits, etc.).
 */

const {
  uploadRasterToStorage,
  persistRasterThumbnail,
  deriveThumbnailUrl,
  writeLocalRaster,
} = require('./signalArtGemini');

async function rasterizeSvgToJpeg(svg) {
  if (!svg?.trim()) throw new Error('SVG content required');
  const sharp = require('sharp');
  return sharp(Buffer.from(svg, 'utf8'), { density: 144 })
    .resize(1024, 1024, { fit: 'contain', background: { r: 5, g: 5, b: 8, alpha: 1 } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** Persist SVG-derived raster + thumbnail to storage and optional public/art. */
async function persistSvgAsRaster({ editionDate, svg, repoRoot = null }) {
  if (!editionDate || !svg?.trim()) {
    return { ok: false, reason: 'missing_svg', error: 'editionDate and svg required' };
  }

  try {
    const buffer = await rasterizeSvgToJpeg(svg);
    let raster_url = null;

    const upload = await uploadRasterToStorage(editionDate, buffer, 'image/jpeg');
    if (upload.ok && upload.publicUrl) {
      raster_url = upload.publicUrl;
    } else if (upload.error) {
      console.warn('[signal-art/svg-fallback] Storage upload failed:', upload.error);
    }

    if (repoRoot) {
      const localPath = writeLocalRaster(repoRoot, editionDate, buffer, 'image/jpeg');
      if (!raster_url) raster_url = localPath;
    }

    const thumb = await persistRasterThumbnail({
      editionDate,
      sourceBuffer: buffer,
      repoRoot,
    });

    return {
      ok: true,
      raster_url,
      thumbnail_url: thumb.ok ? thumb.thumbnail_url : deriveThumbnailUrl(raster_url),
      provider: 'svg_fallback',
      model: 'sharp',
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'svg_raster_failed',
      error: e.message || String(e),
    };
  }
}

module.exports = {
  rasterizeSvgToJpeg,
  persistSvgAsRaster,
};
