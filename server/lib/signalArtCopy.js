'use strict';

/**
 * PYTHIA artist copy — LLM with CoT + JSON (llm-prompting.md), template fallback.
 */

const ARTIST_SYSTEM = [
  'You are PYTHIA, a professional digital artist who specializes in minimalist vector art and neon palettes.',
  'You compose daily "Signal Art" from live startup market data — never generic stock imagery.',
  'Voice: precise, restrained, confident. Like a gallery statement, not marketing copy.',
  'Constraints:',
  '- Reference ONLY facts in the provided data.',
  '- Describe background, midground, foreground, and lighting explicitly in process.',
  '- No hype words, exclamation points, or emojis.',
  '- process: 3-4 sentences, how you built the piece.',
  '- philosophy: 2 sentences, what the form means.',
  '- introspection: 1-2 sentences, italic-worthy closing thought.',
].join(' ');

function templateCopy(snapshot, plan, imageBrief) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const match = snapshot.top_match;

  const process = [
    `Edition ${snapshot.edition_date}. Four passes before ink: void, structure, subject, light.`,
    `Background — horizon at golden ratio, ${plan.coverage} names as negative space.`,
    `Midground — ${plan.leadingPct}% signal arc, ${plan.streakCount} capital streak${plan.streakCount === 1 ? '' : 's'}.`,
    `Foreground — ${leading?.label?.toLowerCase() || 'signal'} beacon at ${plan.accentLabel} (${plan.accent}).`,
    `Lighting — ${imageBrief.lighting}; bloom on foreground only.`,
  ].join(' ');

  const philosophy = [
    'Minimal vector. Neon earns attention — never decorates.',
    match?.startup?.name && match?.investor?.name
      ? `Tether: ${match.startup.name} ↔ ${match.investor.firm_name || match.investor.name} — two nodes, one line.`
      : 'The market is a horizon; conviction is what rises from it.',
  ].join(' ');

  const introspection =
    snapshot.editorial ||
    (leading
      ? `${leading.label} sets the color. Most founders still pitch in grayscale.`
      : 'Quiet board — I left the canvas almost empty.');

  return {
    title: `Signal Composition № ${snapshot.edition_date.replace(/-/g, '.')}`,
    subtitle: leading?.label || 'Neon horizon study',
    process,
    philosophy,
    introspection,
    legend: plan.legend,
    featured_startup: top?.name || null,
    featured_match: match
      ? `${match.startup?.name || 'Startup'} × ${match.investor?.firm_name || match.investor?.name || 'Investor'}`
      : null,
    composition: plan.compositionNotes,
    image_brief: imageBrief.narrative,
    copy_source: 'template',
  };
}

function parseCopyJson(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function generateArtCopy(snapshot, plan, imageBrief) {
  const base = templateCopy(snapshot, plan, imageBrief);
  if (!process.env.OPENAI_API_KEY) return base;

  const ctx = {
    edition_date: snapshot.edition_date,
    leading_signal: snapshot.leading_signal,
    coverage: snapshot.coverage,
    funding_count: snapshot.funding_count,
    top_startup: snapshot.hottest[0] || null,
    top_match: snapshot.top_match
      ? {
          startup: snapshot.top_match.startup?.name,
          investor: snapshot.top_match.investor?.firm_name || snapshot.top_match.investor?.name,
          score: snapshot.top_match.match_score,
        }
      : null,
    sector: plan.accentLabel,
    accent_hex: plan.accent,
    composition: plan.compositionNotes,
    image_brief: imageBrief.narrative,
    lighting: imageBrief.lighting,
  };

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.65,
      max_tokens: 520,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ARTIST_SYSTEM },
        {
          role: 'user',
          content: [
            'Think step by step: background → midground → foreground → lighting.',
            'Then write PYTHIA artist copy from this data ONLY.',
            `<data>${JSON.stringify(ctx, null, 2)}</data>`,
            'Return JSON: {"process":"...","philosophy":"...","introspection":"..."}',
          ].join('\n'),
        },
      ],
    });

    const parsed = parseCopyJson(completion.choices?.[0]?.message?.content);
    if (!parsed?.process || parsed.process.length < 40) return base;

    return {
      ...base,
      process: String(parsed.process).trim(),
      philosophy: String(parsed.philosophy || base.philosophy).trim(),
      introspection: String(parsed.introspection || base.introspection).trim(),
      copy_source: 'pythia',
    };
  } catch (e) {
    console.warn('[signal-art] LLM copy failed:', e.message);
    return base;
  }
}

module.exports = {
  generateArtCopy,
  templateCopy,
  ARTIST_SYSTEM,
};
