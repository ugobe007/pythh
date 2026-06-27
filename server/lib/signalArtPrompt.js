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

/** Map signal → mood word only (never motif names — Gemini renders them as labels). */
function signalToMood(snapshot) {
  const leading = (snapshot.leading_signal?.label || '').toLowerCase();
  if (leading.includes('velocity') || leading.includes('execution')) return 'speed and forward momentum';
  if (leading.includes('capital') || leading.includes('funding')) return 'convergence and capital flow';
  if (leading.includes('conviction')) return 'quiet intensity and focus';
  if (leading.includes('momentum')) return 'building energy';
  return 'calm recalibration';
}

/** Pure visual scene — chromium time-travel in deep space, full bleed, no frame. */
function buildVisualPrompt(snapshot, plan, signalArt, lighting) {
  const anchor = pickAestheticAnchor(plan.seed || 0);
  const mood = signalToMood(snapshot);
  const accent = plan.accent;
  const depth = signalArt.layerCount || 5;

  return [
    `Full-bleed square digital artwork — edge to edge, no border, no white frame, no mat, no polaroid, no letterboxing.`,
    `Deep space black background (#050508) filling the entire canvas corner to corner.`,
    `${anchor}`,
    `Theme: time travel — ${depth} translucent temporal layers at staggered depths, each a ghost echo of the last, drifting through infinite void.`,
    `Chromium filter aesthetic: liquid metallic surfaces, anodized silver-violet chrome, mirror-like reflections, cool metallic sheen on every form.`,
    `Convey ${mood} through hyperspace motion — curved chrome light trails, temporal motion blur, forms stretched along a vanishing point into the distance.`,
    `One hot accent color ${accent} bleeding through the chrome layers like a signal burning through time.`,
    `Distant starless space, faint nebula mist, parallax depth between layers — near forms sharp, far forms faded and stretched.`,
    `${lighting.label} lighting with chrome specular highlights and soft bloom on the deepest layer.`,
    `Absolutely no writing, no labels, no white edges, no frame of any kind.`,
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
