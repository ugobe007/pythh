'use strict';

/**
 * Image brief for Signal Art — layered digital abstract compositions.
 * @see server/lib/signalArtDirection.js (registered art direction)
 */

const { SIGNAL_ART, pickAestheticAnchor, describeLayersForPrompt } = require('./signalArtDirection');

const NEGATIVE_PROMPT = [
  'white border',
  'white frame',
  'polaroid',
  'mat board',
  'picture frame',
  'letterbox bars',
  'overlapping squares',
  'transparent rectangles',
  'concentric circles',
  'radar display',
  'node graph',
  'constellation network',
  'coordinate grid',
  'prism light beams',
  '3d render',
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
    /** Full brief for PYTHIA copy / storage — not sent verbatim to Gemini. */
    narrative,
    /** Visual-only prompt for image models — no labels, lists, or metadata text. */
    visualPrompt: buildVisualPrompt(snapshot, plan, signalArt, lighting),
    negative: NEGATIVE_PROMPT,
    seed: plan.seed,
    signalArt,
  };
}

/** Map live signals → kinetic motion description (visual only, no labels). */
function signalToMotion(snapshot, plan) {
  const leading = (snapshot.leading_signal?.label || '').toLowerCase();
  const pct = plan.leadingPct || 50;
  const funding = plan.fundingCount || 0;
  const parts = [];

  if (leading.includes('velocity') || leading.includes('execution')) {
    parts.push('aggressive forward thrust — diagonal velocity streaks dominating the frame');
  } else if (leading.includes('momentum')) {
    parts.push('accelerating wavefronts — motion building from left to right');
  } else if (leading.includes('capital') || leading.includes('convergence')) {
    parts.push('converging trajectories — multiple paths rushing toward a focal point');
  } else {
    parts.push('slow drift with sudden bursts — signals pulsing then surging');
  }

  if (pct >= 70) parts.push('high-energy sweep across two-thirds of the canvas');
  if (funding >= 5) parts.push(`${Math.min(funding, 8)} parallel motion trails racing at different speeds`);
  if (plan.tension > 0.4) parts.push('asymmetric shear — motion torn between competing directions');
  if (pct >= 55) parts.push('visible motion blur tails on every luminous form');

  return parts.join('; ');
}

/** Pure visual scene — signals in motion, chromium time-travel, full bleed. */
function buildVisualPrompt(snapshot, plan, signalArt, lighting) {
  const anchor = pickAestheticAnchor(plan.seed || 0);
  const motion = signalToMotion(snapshot, plan);
  const accent = plan.accent;
  const depth = signalArt.layerCount || 5;

  return [
    `Full-bleed square digital artwork — edge to edge, no border, no white frame, no mat, no polaroid.`,
    `Deep space black (#050508) corner to corner. EVERYTHING IS IN MOTION — nothing static, nothing resting.`,
    `${anchor}`,
    `Kinetic signal motion: ${motion}.`,
    `Time-travel depth: ${depth} temporal layers each caught at a different moment of movement — ghost trails, motion blur, velocity streaks layered through parallax.`,
    `Chromium filter: liquid metallic surfaces mid-flow, anodized silver-violet chrome with mirror reflections streaking along the direction of travel.`,
    `Show propagation — ripples expanding, arcs mid-swing, particles on ballistic paths, wavefronts pushing through the void.`,
    `Long-exposure light painting aesthetic — luminous paths traced through space showing where signals traveled.`,
    `One hot accent ${accent} burning along the fastest trajectory like a leading signal outrunning the rest.`,
    `Directional motion blur on all forms. Near layers sharp and fast; distant layers faded streaks receding into the vanishing point.`,
    `${lighting.label} with chrome specular highlights streaking along motion paths.`,
    `No writing, no labels, no white edges, no frame. Pure kinetic abstract art.`,
  ].join(' ');
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
