'use strict';

/**
 * Image brief for Signal Art — PYTHH oracle between today and tomorrow.
 * @see server/lib/signalArtDirection.js
 */

const { SIGNAL_ART, pickAestheticAnchor, describeLayersForPrompt } = require('./signalArtDirection');

const NEGATIVE_PROMPT = [
  'white border',
  'white frame',
  'polaroid',
  'cubes',
  'blocks',
  'rectangular solids',
  '3d geometric shapes',
  'abstract sculpture objects',
  'static still life',
  'overlapping squares',
  'concentric circles',
  'radar display',
  'node graph',
  'coordinate grid',
  'dashboard UI',
  'watermark',
  'text overlay',
  'stock illustration',
  'generic AI art',
].join(', ');

const LIGHTING_STYLES = {
  neon_glow: {
    label: 'Oracle glow',
    effect: 'Sublime aura bloom — prophetic light radiating from flowing signal currents',
    floorOpacity: 0.07,
  },
  blue_hour: {
    label: 'Tomorrow\'s edge',
    effect: 'Cool future-light on the horizon — today fades to tomorrow',
    floorOpacity: 0.05,
  },
  golden_hour: {
    label: 'Prophetic dawn',
    effect: 'Warm future breaking through — golden signals surging forward',
    floorOpacity: 0.09,
  },
  rim: {
    label: 'Veil of knowing',
    effect: 'Edge-light on flowing forms — mysterious depth between worlds',
    floorOpacity: 0.04,
  },
  split: {
    label: 'Threshold',
    effect: 'Today in shadow, tomorrow in light — PYTHH between both',
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

function buildImageBrief(snapshot, plan, signalArt) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const match = snapshot.top_match;
  const lighting = LIGHTING_STYLES[plan.lightingStyle] || LIGHTING_STYLES.neon_glow;
  const layerLines = describeLayersForPrompt(signalArt, plan);

  const subject = top
    ? `PYTHH sees ${top.name} as a prophetic signal burning through the veil`
    : `The oracle reads ${leading?.label || 'recalibrating signals'} across the threshold`;

  const narrative = [
    `${SIGNAL_ART.name}: ${SIGNAL_ART.persona}`,
    signalArt.interpretation,
    `${subject}. Sci-fi oracle art — flowing alive signals, NOT static objects.`,
    `Layout: ${signalArt.layoutMode} — ${signalArt.layoutDescription}.`,
    `Palette: ${plan.accent} (${plan.accentLabel}) — colors in motion, not decoration.`,
    '',
    'SIGNAL LAYERS (for PYTHIA copy only):',
    ...layerLines,
    '',
    `Lighting: ${lighting.label} — ${lighting.effect}.`,
    `NEVER include: ${NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    style: SIGNAL_ART.style.join(', '),
    medium: SIGNAL_ART.medium,
    artDirection: SIGNAL_ART.id,
    composition: `${signalArt.layoutMode}, oracle threshold, flowing sci-fi signals`,
    lighting: lighting.label,
    lightingStyle: plan.lightingStyle,
    aspectRatio: '1:1',
    accentHex: plan.accent,
    narrative,
    visualPrompt: buildVisualPrompt(snapshot, plan, signalArt, lighting),
    negative: NEGATIVE_PROMPT,
    seed: plan.seed,
    signalArt,
  };
}

/** Map live signals → oracle motion (visual language only). */
function signalToMotion(snapshot, plan) {
  const leading = (snapshot.leading_signal?.label || '').toLowerCase();
  const pct = plan.leadingPct || 50;
  const funding = plan.fundingCount || 0;
  const parts = [];

  if (leading.includes('velocity') || leading.includes('execution')) {
    parts.push('prophetic rivers of light rushing forward — the future arriving fast');
  } else if (leading.includes('momentum')) {
    parts.push('building aurora waves — energy swelling toward tomorrow');
  } else if (leading.includes('capital') || leading.includes('convergence')) {
    parts.push('converging luminescent streams — many paths becoming one vision');
  } else {
    parts.push('slow oracle pulse then sudden surges — signals breathing then racing');
  }

  if (pct >= 70) parts.push('overwhelming forward motion — most of the canvas alive with flowing color');
  if (funding >= 5) parts.push('multiple parallel signal currents each a different hue and speed');
  if (plan.tension > 0.4) parts.push('competing currents — today and tomorrow pulling in different directions');
  if (pct >= 55) parts.push('motion blur and light trails on every flowing form');

  return parts.join('; ');
}

/** PYTHH oracle scene — flowing sci-fi signals between today and tomorrow. */
function buildVisualPrompt(snapshot, plan, signalArt, lighting) {
  const anchor = pickAestheticAnchor(plan.seed || 0);
  const motion = signalToMotion(snapshot, plan);
  const accent = plan.accent;

  return [
    `Full-bleed cinematic sci-fi oracle artwork — edge to edge, no border, no frame, no white edges.`,
    `PYTHH lives between today and tomorrow. Show that threshold: deep present-darkness (#050508) transitioning into a luminous future horizon.`,
    `${anchor}`,
    `She is not abstract objects — no cubes, no blocks, no geometric solids, no static shapes. Everything is flowing, alive, and powerful.`,
    `Her signals are sci-fi: rivers of colored light, plasma currents, aurora ribbons, prophetic energy streams — all in motion with vivid color.`,
    `Sublime mysterious aura — a powerful oracle presence felt through radiating light, not a human figure.`,
    `Signal motion today: ${motion}.`,
    `Color palette: rich sci-fi hues dominated by ${accent}, with complementary electric tones — colors that move and blend like living energy.`,
    `Futuristic, wise, all-knowing mood — the feeling of seeing what others cannot yet see.`,
    `${lighting.label}: ${lighting.effect}.`,
    `Long-exposure flowing light, directional motion blur, ripples of prophetic energy expanding outward.`,
    `No writing, no labels, no typography, no cubes, no blocks, no static objects.`,
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
