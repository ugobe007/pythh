'use strict';

/**
 * Signal Art raster generation via Google AI Studio (Gemini image models).
 * @see https://ai.google.dev/gemini-api/docs/interactions/image-generation
 * @see mcpmarket-me/skills/ai-artist/references/nano-banana.md
 */

const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const STORAGE_BUCKET = process.env.SIGNAL_ART_STORAGE_BUCKET || 'pythh-art';

const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

const IMAGE_MODELS = [
  process.env.SIGNAL_ART_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
  'gemini-3.1-flash-image',
  'gemini-3-pro-image-preview',
]
  .filter(Boolean)
  .filter((m) => !m.startsWith('imagen'));

function isQuotaExhausted(err) {
  const msg = err?.message || '';
  return err?.status === 429 && (msg.includes('limit: 0') || msg.includes('quota'));
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.AISTUDIO_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

/** Nano Banana narrative prompt from image brief (paragraphs > keywords). */
function buildGeminiPrompt(imageBrief) {
  const narrative = imageBrief?.narrative || '';
  const accent = imageBrief?.accentHex || '#a78bfa';

  return [
    narrative,
    '',
    'CRITICAL REQUIREMENTS:',
    `- Primary accent color: ${accent}`,
    '- Style: minimalist vector neon illustration, flat strokes, synthwave, editorial',
    '- Format: square 1:1 composition, layered depth, generous negative space',
    '- NEVER include: text, watermarks, labels, coordinate grids, node graphs, photorealistic skin, 3D render clutter',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractImageFromResponse(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        buffer: Buffer.from(inline.data, 'base64'),
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
      };
    }
  }
  return null;
}

async function callGeminiImageModel(model, prompt, apiKey) {
  const url = `${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Gemini HTTP ${res.status}`);
    err.status = res.status;
    err.code = json?.error?.code;
    err.details = json?.error;
    throw err;
  }

  const image = extractImageFromResponse(json);
  if (!image) {
    throw new Error('Gemini response contained no image');
  }
  return { ...image, model };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateGeminiRaster(imageBrief, { retries = 2 } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key', hint: 'Set GEMINI_API_KEY in environment' };
  }

  const prompt = buildGeminiPrompt(imageBrief);
  const models = [...new Set(IMAGE_MODELS)];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await callGeminiImageModel(model, prompt, apiKey);
        return {
          ok: true,
          buffer: result.buffer,
          mimeType: result.mimeType,
          model: result.model,
          prompt,
        };
      } catch (e) {
        lastError = e;
        if (isQuotaExhausted(e)) {
          console.warn(`[signal-art/gemini] ${model} quota exhausted — enable billing on AI Studio`);
          break;
        }
        const retryable = e.status === 503;
        if (retryable && attempt < retries) {
          console.warn(`[signal-art/gemini] ${model} attempt ${attempt + 1} failed (${e.message}), retry in 5s`);
          await sleep(5_000);
          continue;
        }
        console.warn(`[signal-art/gemini] ${model} failed:`, e.message);
        break;
      }
    }
  }

  return {
    ok: false,
    reason: lastError?.status === 429 ? 'quota_exceeded' : 'generation_failed',
    error: lastError?.message || 'Unknown error',
    hint:
      lastError?.status === 429
        ? 'Enable billing on Google AI Studio (https://aistudio.google.com) — free tier image quota may be 0.'
        : 'Check GEMINI_API_KEY and model access.',
  };
}

async function uploadRasterToStorage(editionDate, buffer, mimeType) {
  const supabase = getSupabaseClient();
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const objectPath = `${editionDate}.${ext}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, buffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  return { ok: true, path: objectPath, publicUrl: pub?.publicUrl || null };
}

function writeLocalRaster(repoRoot, editionDate, buffer, mimeType) {
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const outDir = path.join(repoRoot, 'public', 'art');
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `${editionDate}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  return `/art/${editionDate}.${ext}`;
}

/**
 * Generate raster via Gemini and persist (Supabase Storage + local public/art).
 */
async function generateAndPersistRaster({ editionDate, imageBrief, repoRoot }) {
  const gen = await generateGeminiRaster(imageBrief);
  if (!gen.ok) {
    return { ok: false, ...gen };
  }

  let raster_url = null;
  let storage_path = null;

  const upload = await uploadRasterToStorage(editionDate, gen.buffer, gen.mimeType);
  if (upload.ok && upload.publicUrl) {
    raster_url = upload.publicUrl;
    storage_path = upload.path;
  } else if (upload.error) {
    console.warn('[signal-art/gemini] Storage upload failed:', upload.error);
  }

  if (repoRoot) {
    const localPath = writeLocalRaster(repoRoot, editionDate, gen.buffer, gen.mimeType);
    if (!raster_url) raster_url = localPath;
  }

  return {
    ok: true,
    raster_url,
    storage_path,
    model: gen.model,
    provider: 'gemini',
    prompt: gen.prompt,
  };
}

module.exports = {
  getGeminiApiKey,
  buildGeminiPrompt,
  generateGeminiRaster,
  generateAndPersistRaster,
  IMAGE_MODELS,
};
