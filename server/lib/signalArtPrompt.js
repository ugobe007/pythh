'use strict';

/**
 * Image brief for Signal Art — layered digital abstract compositions.
 * @see server/lib/signalArtDirection.js (registered art direction)
 */

const { SIGNAL_ART, describeLayersForPrompt } = require('./signalArtDirection');

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
  'literal charts',
  'dashboard UI',
].join(', ');

const LIGHTING_STYLES = {
  neon_glow: {
    label: 'Neon glow',
    effect: 'Accent bloom on foreground layers; cyberpunk rim separation between planes',
    floorOpacity: 0.07,
  },
  blue_hour: {
    label: 'Blue hour',
    effect: 'Cool twilight void; subdued washes; layers read as translucent glass',
    floorOpacity: 0.05,
  },
  golden_hour: {
    label: 'Golden hour',
    effect: 'Warm directional glow; capital layers catch late-day light',
    floorOpacity: 0.09,
  },
  rim: {
    label: 'Rim / back light',
    effect: 'Edge highlights separate overlapping abstract forms from void',
    floorOpacity: 0.04,
  },
  split: {
    label: 'Split light',
    effect: 'Half the frame in shadow; asymmetric layer stack for tension',
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
 * Narrative brief for Gemini raster + PYTHIA copy.
 */
function buildImageBrief(snapshot, plan, signalArt) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const match = snapshot.top_match;
  const lighting = LIGHTING_STYLES[plan.lightingStyle] || LIGHTING_STYLES.neon_glow;
  const layerLines = describeLayersForPrompt(signalArt, plan);

  const subject = top
    ? `${top.name} as focal intensity within a layered abstract signal field`
    : `Abstract market signal field — ${leading?.label || 'recalibrating signals'}`;

  const narrative = [
    `${SIGNAL_ART.name}: ${SIGNAL_ART.tagline}.`,
    signalArt.interpretation,
    `${subject}. Digital abstract art — NOT photorealistic, NOT literal charts.`,
    `Layout: ${signalArt.layoutMode} — ${signalArt.layoutDescription}.`,
    `Palette: primary accent ${plan.accent} (${plan.accentLabel}), dark void background, neon-adjacent digital tones.`,
    `1:1 square format. Multiple translucent signal layers overlap in coordinated depth — each layer maps to a live market signal.`,
    '',
    'SIGNAL LAYERS (back to front):',
    ...layerLines,
    '',
    `Lighting: ${lighting.label} — ${lighting.effect}.`,
    match?.startup?.name
      ? `Match layer connects ${match.startup.name} to ${match.investor?.firm_name || match.investor?.name} (${match.match_score}% fit).`
      : null,
    `Randomized composition variant #${signalArt.seedVariant} (deterministic from edition seed).`,
    `NEVER include: ${NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    style: SIGNAL_ART.style.join(', '),
    medium: SIGNAL_ART.medium,
    artDirection: SIGNAL_ART.id,
    composition: `${signalArt.layoutMode}, layered abstract depth, coordinated signal planes`,
    lighting: lighting.label,
    lightingStyle: plan.lightingStyle,
    aspectRatio: '1:1',
    accentHex: plan.accent,
    narrative,
    negative: NEGATIVE_PROMPT,
    seed: plan.seed,
    signalArt,
  };
}

module.exports = {
  SIGNAL_ART,
  NEGATIVE_PROMPT,
  LIGHTING_STYLES,
  pickLightingStyle,
  applyCompositionRules,
  buildImageBrief,
  thirdsX,
};
