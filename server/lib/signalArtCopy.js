'use strict';

/**
 * PYTHIA artist copy — Signal Art registered direction.
 */

const { SIGNAL_ART } = require('./signalArtDirection');

const ARTIST_SYSTEM = [
  'You are PYTHH — an oracle. Futuristic, wise, all-knowing. You live between today\'s world and tomorrow.',
  'You do not paint abstract objects. You reveal living sci-fi signals — flowing, powerful, sublime.',
  'Your Signal Art shows motion and color: prophetic energy streams, aurora currents, the aura of what is coming.',
  'Voice: oracular, precise, mysterious, confident. Prophecy, not marketing.',
  'Constraints:',
  '- Reference ONLY facts in the provided data.',
  '- Describe what PYTHH sees between today and tomorrow — flowing signals, not static forms.',
  '- Convey motion, color, and oracle wisdom.',
  '- No hype, exclamation points, or emojis.',
  '- process: 3-4 sentences on what the oracle saw and rendered.',
  '- philosophy: 2 sentences on what the signals mean for founders.',
  '- introspection: 1-2 sentences, oracular closing thought.',
].join(' ');

function templateCopy(snapshot, plan, imageBrief, signalArt) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const match = snapshot.top_match;

  const process = [
    `Edition ${snapshot.edition_date}. PYTHH reads the threshold between today and tomorrow.`,
    signalArt.interpretation,
    `${signalArt.layerCount} living signals in ${signalArt.layoutMode} — flowing, not static. Accent ${plan.accentLabel} (${plan.accent}). ${imageBrief.lighting}.`,
  ].join(' ');

  const philosophy = [
    'The oracle does not show charts — she shows what is coming. Flowing sci-fi signals reveal the shape of tomorrow.',
    match?.startup?.name && match?.investor?.name
      ? `Two currents converge: ${match.startup.name} and ${match.investor.firm_name || match.investor.name} — PYTHH sees the filament between them.`
      : 'Most look at today. PYTHH lives in the space between today and tomorrow.',
  ].join(' ');

  const introspection =
    snapshot.editorial ||
    (leading
      ? `${leading.label} is what I see clearest right now. The future is already moving.`
      : 'Quiet day — even silence has a signal. I left the veil thin.');

  return {
    title: `Oracle № ${snapshot.edition_date.replace(/-/g, '.')}`,
    subtitle: leading?.label || signalArt.layoutMode,
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
    art_direction: SIGNAL_ART.name,
    layout_mode: signalArt.layoutMode,
    signal_layers: signalArt.layerCount,
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

async function generateArtCopy(snapshot, plan, imageBrief, signalArt) {
  const base = templateCopy(snapshot, plan, imageBrief, signalArt);
  if (!process.env.OPENAI_API_KEY) return base;

  const ctx = {
    art_direction: SIGNAL_ART,
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
    layout_mode: signalArt.layoutMode,
    interpretation: signalArt.interpretation,
    signal_layers: signalArt.layers.map((l) => ({
      motif: l.motif,
      label: l.label,
      role: l.role,
    })),
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
            'Think step by step: void → signal layers (back to front) → lighting.',
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
