'use strict';

/**
 * Image-style composition brief for Signal Art (vector execution).
 * Follows mcpmarket-me/skills/ai-artist/references/image-prompting.md
 */

const NEGATIVE_PROMPT = [
  'coordinate grid',
  'node graph',
  'spider web',
  'filled blob cluster',
  'omnidirectional glow',
  'over-rendered blur',
  '3d render',
  'photorealistic texture',
  'watermark',
  'text overlay',
  'stock illustration',
  'generic AI art',
].join(', ');

const LIGHTING_STYLES = {
  neon_glow: {
    label: 'Neon glow',
    effect: 'Single accent bloom on foreground stroke; cyberpunk rim on beacon edge',
    floorOpacity: 0.07,
  },
  blue_hour: {
    label: 'Blue hour',
    effect: 'Cool twilight void; subdued floor wash; no volumetric rays',
    floorOpacity: 0.05,
  },
  golden_hour: {
    label: 'Golden hour',
    effect: 'Warm directional floor glow; capital streaks read as late-day light',
    floorOpacity: 0.09,
  },
  rim: {
    label: 'Rim / back light',
    effect: 'Edge highlight separates beacon from void; background stays dark',
    floorOpacity: 0.04,
  },
  split: {
    label: 'Split light',
    effect: 'Half the frame in shadow; asymmetric beacon offset for tension',
    floorOpacity: 0.06,
  },
};

function pickLightingStyle(snapshot, plan) {
  const leadingPct = plan.leadingPct || 40;
  const funding = plan.fundingCount || 0;
  if (plan.tension > 0.55) return 'split';
  if (funding >= 8) return 'golden_hour';
  if (leadingPct >= 75) return 'neon_glow';
  if (leadingPct <= 45 && funding <= 3) return 'blue_hour';
  if (plan.tension > 0.3) return 'rim';
  return 'neon_glow';
}

/** Rule-of-thirds anchor for focal subject (1:1 canvas). */
function thirdsX(seed, tension) {
  const left = Math.round(800 / 3);
  const right = Math.round((800 * 2) / 3);
  if (tension <= 0.25) return 400;
  return seed % 2 === 0 ? left : right;
}

function applyCompositionRules(plan, snapshot, seed) {
  const goldenHorizon = Math.round(800 * 0.618);
  plan.horizonY = goldenHorizon + Math.round((plan.coverage - 200) * 0.04);
  plan.horizonY = Math.max(480, Math.min(560, plan.horizonY));
  plan.beaconX = thirdsX(seed, plan.tension);
  plan.lightingStyle = pickLightingStyle(snapshot, plan);
  plan.seed = seed;
  return plan;
}

/**
 * Universal image prompt structure → narrative brief for SVG + optional raster pass.
 * @see image-prompting.md — Subject, Style, Composition, Lighting, Quality, Negative
 */
function buildImageBrief(snapshot, plan) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const match = snapshot.top_match;
  const lighting = LIGHTING_STYLES[plan.lightingStyle] || LIGHTING_STYLES.neon_glow;

  const subject = top
    ? `${top.name} as a minimal neon beacon (${leading?.label || 'signal'} dominant)`
    : `Abstract market beacon — ${leading?.label || 'recalibrating signals'}`;

  const narrative = [
    `${subject} rises from a flat void horizon.`,
    `Minimalist vector art, synthwave palette, primary neon ${plan.accent} on ${plan.accentLabel}.`,
    `1:1 square format. Composition: rule of thirds focal point, layered depth, generous negative space.`,
    `Background: ${plan.compositionNotes?.background || 'void and horizon'}.`,
    `Midground: ${plan.compositionNotes?.midground || 'signal arc and capital streaks'}.`,
    `Foreground: ${plan.compositionNotes?.foreground || 'beacon and match tether'}.`,
    `Lighting: ${lighting.label} — ${lighting.effect}.`,
    match?.startup?.name
      ? `Tension line connects ${match.startup.name} to ${match.investor?.firm_name || match.investor?.name} (${match.match_score}% fit).`
      : null,
    `NEVER include: ${NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    subject,
    style: 'minimalist vector art, synthwave, stroke-only, neon palette',
    medium: 'SVG vector (deterministic)',
    composition: 'rule of thirds, golden-ratio horizon, layered depth, negative space',
    lighting: lighting.label,
    lightingStyle: plan.lightingStyle,
    aspectRatio: '1:1',
    accentHex: plan.accent,
    narrative,
    negative: NEGATIVE_PROMPT,
    seed: plan.seed,
  };
}

module.exports = {
  NEGATIVE_PROMPT,
  LIGHTING_STYLES,
  pickLightingStyle,
  applyCompositionRules,
  buildImageBrief,
  thirdsX,
};
