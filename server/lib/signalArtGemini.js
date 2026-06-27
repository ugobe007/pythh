'use strict';

/**
 * Signal Art raster generation via Google AI Studio (Gemini / Imagen).
 * @see https://ai.google.dev/gemini-api/docs/interactions/image-generation
 */

const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const STORAGE_BUCKET = process.env.SIGNAL_ART_STORAGE_BUCKET || 'pythh-art';
const TIER_UPGRADE_URL = 'https://ai.dev/projects';

const GEMINI_IMAGE_MODELS = [
  process.env.SIGNAL_ART_IMAGE_MODEL || 'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image',
].filter((m) => m && !m.startsWith('imagen'));

const IMAGEN_MODELS = [
  process.env.SIGNAL_ART_IMAGEN_MODEL || 'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
].filter(Boolean);

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.AISTUDIO_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

function isPaidTierRequired(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('paid plan') ||
    msg.includes('ai.dev/projects') ||
    msg.includes('limit: 0') ||
    msg.includes('not enough quota')
  );
}

function tierUpgradeHint() {
  return `Upgrade this project to Tier 1 at ${TIER_UPGRADE_URL} (GCP billing alone is not enough — link billing in AI Studio Projects).`;
}

const { SIGNAL_ART } = require('./signalArtDirection');

/** Gemini prompt — visual scene only; NEVER pass narrative or motif names. */
function buildGeminiPrompt(imageBrief) {
  const visual = imageBrief?.visualPrompt;
  if (!visual) {
    throw new Error('buildGeminiPrompt requires imageBrief.visualPrompt');
  }
  const accent = imageBrief?.accentHex || '#a78bfa';

  return [
    'FULL BLEED ARTWORK — NO WHITE BORDER, NO FRAME, NO MAT, NO POLAROID, NO LETTERBOX.',
    'PURE ARTWORK — NO TEXT ANYWHERE IN THE IMAGE.',
    '',
    visual,
    '',
    'CRITICAL — PYTHH ORACLE AESTHETIC:',
    '- Flowing alive sci-fi signals: rivers of light, plasma, aurora ribbons, prophetic energy — ALL IN MOTION',
    '- Between today (dark void) and tomorrow (luminous horizon) — oracle threshold',
    '- Sublime mysterious powerful aura — wise, futuristic, all-knowing mood',
    `- Rich sci-fi colors in motion, leading hue: ${accent}`,
    '- DO NOT: cubes, blocks, rectangles, geometric solids, static objects, abstract sculptures',
    '- DO NOT: white border, frame, text, labels, radar UI, node graphs',
    'FULL BLEED — FLOWING ORACLE SIGNALS — NO TEXT — NO CUBES.',
  ].join('\n');
}

function extractImageFromGenerateContent(json) {
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

function extractImageFromInteraction(json) {
  const block = json?.output_image || json?.outputs?.find((o) => o.type === 'image');
  const data = block?.data || block?.image?.data;
  if (!data) return null;
  return {
    buffer: Buffer.from(data, 'base64'),
    mimeType: block.mimeType || block.mime_type || 'image/png',
  };
}

function extractImageFromImagenPredict(json) {
  const pred = json?.predictions?.[0];
  const data = pred?.bytesBase64Encoded || pred?.bytes_base64_encoded;
  if (!data) return null;
  return {
    buffer: Buffer.from(data, 'base64'),
    mimeType: pred.mimeType || pred.mime_type || 'image/png',
  };
}

async function geminiFetch(pathname, apiKey, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || json?.message || `Gemini HTTP ${res.status}`);
    err.status = res.status;
    err.code = json?.error?.code || json?.code;
    err.details = json?.error || json;
    throw err;
  }
  return json;
}

async function callInteractionsApi(model, prompt, apiKey) {
  const json = await geminiFetch('/interactions', apiKey, {
    model,
    input: [{ type: 'text', text: prompt }],
  });
  const image = extractImageFromInteraction(json);
  if (!image) throw new Error('Interactions response contained no image');
  return { ...image, model: `${model} (interactions)` };
}

async function callGenerateContent(model, prompt, apiKey) {
  const json = await geminiFetch(`/models/${model}:generateContent`, apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  const image = extractImageFromGenerateContent(json);
  if (!image) throw new Error('generateContent response contained no image');
  return { ...image, model };
}

async function callImagenPredict(model, prompt, apiKey) {
  const json = await geminiFetch(`/models/${model}:predict`, apiKey, {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  });
  const image = extractImageFromImagenPredict(json);
  if (!image) throw new Error('Imagen predict response contained no image');
  return { ...image, model };
}

async function generateGeminiRaster(imageBrief) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key', hint: 'Set GEMINI_API_KEY in environment' };
  }

  const prompt = buildGeminiPrompt(imageBrief);
  const attempts = [
    ...GEMINI_IMAGE_MODELS.map((model) => ({
      label: model,
      run: () => callInteractionsApi(model, prompt, apiKey),
    })),
    ...GEMINI_IMAGE_MODELS.map((model) => ({
      label: `${model} (generateContent)`,
      run: () => callGenerateContent(model, prompt, apiKey),
    })),
    ...IMAGEN_MODELS.map((model) => ({
      label: model,
      run: () => callImagenPredict(model, prompt, apiKey),
    })),
  ];

  let lastError = null;
  let paidTierRequired = false;

  for (const { label, run } of attempts) {
    try {
      const result = await run();
      return {
        ok: true,
        buffer: result.buffer,
        mimeType: result.mimeType,
        model: result.model,
        prompt,
      };
    } catch (e) {
      lastError = e;
      if (isPaidTierRequired(e)) paidTierRequired = true;
      console.warn(`[signal-art/gemini] ${label} failed:`, e.message?.split('\n')[0] || e.message);
    }
  }

  return {
    ok: false,
    reason: paidTierRequired || lastError?.status === 429 ? 'tier_upgrade_required' : 'generation_failed',
    error: lastError?.message || 'Unknown error',
    hint: paidTierRequired ? tierUpgradeHint() : 'Check GEMINI_API_KEY and model access.',
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

/** Generate raster via Gemini/Imagen and persist (Supabase Storage + local public/art). */
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
  GEMINI_IMAGE_MODELS,
  IMAGEN_MODELS,
  TIER_UPGRADE_URL,
};
