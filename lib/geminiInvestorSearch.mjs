/**
 * Find investor firm homepage via Gemini + Google Search grounding.
 * Uses GEMINI_API_KEY (already configured for Signal Art).
 * Works for whole-web search — unlike new Programmable Search Engines (site-only since Jan 2026).
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = process.env.GEMINI_SEARCH_MODEL || 'gemini-2.5-flash';

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.AISTUDIO_API_KEY ||
    ''
  ).trim();
}

/**
 * @param {string} firmName
 * @returns {Promise<{ url: string|null, source: string, candidates: string[] }>}
 */
export async function geminiFindFirmUrl(firmName) {
  const key = getGeminiApiKey();
  if (!key) return { url: null, source: 'no_gemini_key', candidates: [] };

  const prompt =
    `Find the official homepage URL for the venture capital firm or investor "${firmName}". ` +
    `Reply with exactly one line: the firm's own https homepage URL only. ` +
    `No LinkedIn, Crunchbase, PitchBook, news, Wikipedia, or Google redirect links.`;

  const res = await fetch(`${API_BASE}/models/${MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini search failed (${res.status}): ${JSON.stringify(json.error || json).slice(0, 300)}`);
  }

  const parts = json.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join(' ').trim();
  const meta = json.candidates?.[0]?.groundingMetadata || {};
  const chunkUrls = (meta.groundingChunks || [])
    .map((c) => c.web?.uri)
    .filter(Boolean);

  const candidates = [];
  const urlInText = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlInText) candidates.push(urlInText[0].replace(/[.,;]+$/, ''));
  for (const u of chunkUrls) {
    if (!candidates.includes(u)) candidates.push(u);
  }

  const blocked = /crunchbase|linkedin|twitter|pitchbook|wikipedia|facebook|instagram|youtube|techcrunch|venturebeat|vertexaisearch\.cloud\.google|google\.com\/url/i;
  const filtered = candidates.filter((u) => !blocked.test(u));

  // Prefer URL from model text over grounding redirect links
  const textUrl = urlInText ? [urlInText[0].replace(/[.,;]+$/, '')] : [];
  const merged = [...textUrl, ...filtered.filter((u) => !textUrl.includes(u))];

  return {
    url: merged[0] || null,
    source: 'gemini_google_search',
    candidates: merged,
  };
}

export function hasGeminiSearch() {
  return !!getGeminiApiKey();
}
