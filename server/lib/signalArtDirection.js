'use strict';

/**
 * Registered art direction for Pythh Signal Art.
 * Digital abstract compositions — multiple signal layers, seed-randomized layout,
 * PYTHH's interpretation of live market data.
 */

const SIGNAL_ART = {
  id: 'signal-art',
  name: 'Signal Art',
  tagline: 'Digital abstract compositions from live market signals',
  style: ['digital art', 'abstract', 'layered', 'chromium', 'deep-space', 'time-travel', 'signal-driven'],
  medium: 'Gemini raster (primary) · SVG fallback',
  version: '2.2',
  theme: 'chromium time-travel — signals in motion through deep space',
  /** Anti-patterns — Gemini defaults to these; ban explicitly in every prompt. */
  avoid: [
    'white border or polaroid frame',
    'overlapping transparent squares or rectangles',
    'concentric radar circles',
    'node graphs or constellation networks',
    'prism light beams',
    'stock synthwave wallpaper',
    'dashboard or UI aesthetics',
  ],
};

/** Organic motifs — avoid words that trigger grids/radar (lattice, plane, ring, node). */
const MOTIF_BY_KEYWORD = [
  ['execution', 'flowing velocity trail'],
  ['velocity', 'flowing velocity trail'],
  ['momentum', 'soft pulse halo'],
  ['capital', 'single luminous arc'],
  ['funding', 'ascending light streaks'],
  ['match', 'thin tension filament'],
  ['sector', 'atmospheric color wash'],
  ['god', 'luminous focal ember'],
  ['score', 'luminous focal ember'],
  ['coverage', 'deep void mist'],
  ['recalibrat', 'drifting particle haze'],
  ['innovation', 'fractured light shard'],
  ['traction', 'rising signal trail'],
  ['conviction', 'steady vertical beacon'],
];

const LAYOUT_MODES = [
  { id: 'warp', description: 'temporal layers converging toward a distant vanishing point' },
  { id: 'drift', description: 'ghosted signal forms at staggered depths, floating in space' },
  { id: 'tunnel', description: 'chrome filaments lining a receding corridor through the void' },
  { id: 'echo', description: 'same luminous form repeated at fading opacities — time echoes' },
  { id: 'shear', description: 'hyperspace streaks sheared across deep-space depth' },
  { id: 'ember', description: 'distant chrome sparks scattered across infinite black' },
];

/** Seed-picked aesthetic anchors — kinetic signals in motion. */
const AESTHETIC_ANCHORS = [
  'Like chrome signal pulses caught mid-flight through a wormhole — every form frozen in motion, never at rest.',
  'Like long-exposure photography of data streams — luminous trails arcing through black space at impossible speed.',
  'Like ripples propagating through liquid metal — each wave a signal echoing outward in chrome and violet.',
  'Like ballistic light trajectories in zero gravity — curved paths, motion blur tails, kinetic energy visible in every stroke.',
  'Like hyperspace jump interrupted — layered velocity streaks shearing past the viewer, temporal ghosts trailing behind.',
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function labelToMotif(label) {
  const l = (label || '').toLowerCase();
  for (const [keyword, motif] of MOTIF_BY_KEYWORD) {
    if (l.includes(keyword)) return motif;
  }
  return 'abstract signal field';
}

function pickLayoutMode(seed, tension) {
  const idx = (seed + Math.round(tension * 1000)) % LAYOUT_MODES.length;
  return LAYOUT_MODES[idx];
}

function buildInterpretation(snapshot, plan, layout, layers) {
  const leading = snapshot.leading_signal?.label || 'mixed signals';
  const match = snapshot.top_match;
  const matchNote = match?.startup?.name
    ? ` Match tension: ${match.startup.name} ↔ ${match.investor?.firm_name || match.investor?.name}.`
    : '';
  return (
    `PYTHH interprets ${snapshot.edition_date} as ${leading.toLowerCase()} dominant — ` +
    `${layers.length} coordinated abstract signal layers in ${layout.id} formation, ` +
    `sector tone ${plan.accentLabel}, balance ${plan.tensionLabel}.${matchNote}`
  );
}

/**
 * Map live signals → layered abstract motifs with seed-randomized placement.
 */
function interpretSignalLayers(snapshot, plan, seed) {
  const rand = mulberry32(seed + 7919);
  const layout = pickLayoutMode(seed, plan.tension || 0);
  const layers = [];

  layers.push({
    id: 'void',
    signal: 'coverage',
    label: `${snapshot.coverage || 0} names in view`,
    motif: 'deep void mist',
    role: 'background',
    zIndex: 0,
    opacity: Math.min(0.35, 0.12 + (snapshot.coverage || 50) / 400),
    scale: 1,
    rotation: Math.round(rand() * 360),
    x: 400,
    y: 400,
  });

  layers.push({
    id: 'sector',
    signal: 'sector',
    label: plan.accentLabel,
    motif: 'atmospheric color wash',
    role: 'background',
    zIndex: 1,
    opacity: 0.14 + rand() * 0.1,
    scale: 0.9 + rand() * 0.35,
    rotation: Math.round(rand() * 180),
    color: plan.accent,
    x: 280 + rand() * 240,
    y: 260 + rand() * 200,
  });

  if (snapshot.leading_signal) {
    const pct = plan.leadingPct || snapshot.leading_signal.pct || 40;
    layers.push({
      id: 'leading',
      signal: 'leading',
      label: snapshot.leading_signal.label,
      motif: labelToMotif(snapshot.leading_signal.label),
      role: 'midground',
      zIndex: 3,
      opacity: 0.28 + pct / 220,
      scale: 0.55 + pct / 130,
      rotation: Math.round(rand() * 70 - 35),
      intensity: pct,
      x: plan.beaconX || 400,
      y: (plan.horizonY || 520) - 80,
    });
  }

  (snapshot.signal_dimensions || []).slice(0, 5).forEach((dim, i) => {
    const pct = dim.pct || 25;
    layers.push({
      id: `dimension-${i}`,
      signal: dim.key || `dim-${i}`,
      label: dim.label || `Signal ${i + 1}`,
      motif: labelToMotif(dim.label),
      role: i < 2 ? 'midground' : 'foreground',
      zIndex: 4 + i,
      opacity: 0.18 + pct / 250,
      scale: 0.3 + pct / 110,
      rotation: Math.round(rand() * 100 - 50),
      intensity: pct,
      x: 120 + rand() * 560,
      y: 140 + rand() * 480,
    });
  });

  if (plan.fundingCount > 0) {
    layers.push({
      id: 'capital',
      signal: 'funding',
      label: `${plan.fundingCount} capital move${plan.fundingCount === 1 ? '' : 's'}`,
      motif: 'parallel thrust ribbons',
      role: 'midground',
      zIndex: 2,
      opacity: 0.22 + Math.min(0.28, plan.fundingCount * 0.035),
      scale: 0.45 + plan.fundingCount * 0.06,
      rotation: Math.round(rand() * 50 - 25),
      x: 100 + rand() * 200,
      y: plan.horizonY || 520,
    });
  }

  if (snapshot.top_match) {
    const score = snapshot.top_match.match_score || 50;
    layers.push({
      id: 'match',
      signal: 'match',
      label: `${snapshot.top_match.startup?.name || 'Startup'} ↔ ${snapshot.top_match.investor?.firm_name || snapshot.top_match.investor?.name || 'Investor'}`,
      motif: 'tension filament bridge',
      role: 'foreground',
      zIndex: 10,
      opacity: 0.4 + score / 280,
      scale: 0.38 + score / 180,
      rotation: plan.tetherAngle || 0,
      intensity: score,
      x: plan.beaconX ? plan.beaconX - 90 : 310,
      y: (plan.horizonY || 520) - 40,
    });
  }

  if (snapshot.hottest?.[0]) {
    layers.push({
      id: 'focal',
      signal: 'god_score',
      label: snapshot.hottest[0].name,
      motif: 'intensity bloom node',
      role: 'foreground',
      zIndex: 11,
      opacity: 0.32 + ((snapshot.hottest[0].total_god_score || 70) - 50) / 200,
      scale: 0.42 + ((snapshot.hottest[0].total_god_score || 70) - 50) / 150,
      rotation: Math.round(rand() * 40 - 20),
      x: plan.beaconX || 400,
      y: (plan.horizonY || 520) - 120,
    });
  }

  const interpretation = buildInterpretation(snapshot, plan, layout, layers);

  return {
    direction: SIGNAL_ART,
    layoutMode: layout.id,
    layoutDescription: layout.description,
    interpretation,
    layers,
    layerCount: layers.length,
    seedVariant: seed % 9973,
  };
}

function describeLayersForPrompt(signalArt, plan) {
  const sorted = [...signalArt.layers].sort((a, b) => a.zIndex - b.zIndex);
  return sorted.map((layer, i) => {
    const colorNote = layer.color ? `, color ${layer.color}` : '';
    return (
      `Layer ${i + 1} (${layer.role}): "${layer.motif}" from ${layer.label} — ` +
      `opacity ${layer.opacity.toFixed(2)}, scale ${layer.scale.toFixed(2)}, ` +
      `rotation ${layer.rotation}°${colorNote}`
    );
  });
}

function buildLayerLegend(signalArt) {
  return signalArt.layers
    .filter((l) => l.id !== 'void')
    .slice(0, 6)
    .map((layer) => ({
      key: layer.id,
      label: layer.motif,
      value: layer.label,
    }));
}

function pickAestheticAnchor(seed) {
  return AESTHETIC_ANCHORS[seed % AESTHETIC_ANCHORS.length];
}

module.exports = {
  SIGNAL_ART,
  LAYOUT_MODES,
  AESTHETIC_ANCHORS,
  labelToMotif,
  interpretSignalLayers,
  describeLayersForPrompt,
  buildLayerLegend,
  pickAestheticAnchor,
};
