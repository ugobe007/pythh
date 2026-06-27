'use strict';

/**
 * Registered art direction for Pythh Signal Art.
 * Digital abstract compositions — multiple signal layers, seed-randomized layout,
 * PYTHH's interpretation of live market data.
 */

const SIGNAL_ART = {
  id: 'signal-art',
  name: 'Signal Art',
  tagline: 'PYTHH sees between today and tomorrow — living sci-fi signals in motion',
  persona: 'PYTHH is an oracle: futuristic, wise, all-knowing. She lives on the threshold of present and future.',
  style: ['sci-fi', 'oracle', 'solar-corona', 'magnetic-loops', 'flowing', 'kinetic', 'sublime', 'prophetic', 'signal-driven'],
  medium: 'Gemini raster (primary) · SVG fallback',
  version: '3.1',
  theme: 'oracle between worlds — solar corona signals, magnetic loops, living light',
  reference: 'solar_rays — dual glowing cores with nested elliptical magnetic loops, white-blue hot centers, warm orange-gold-red outer rays, horizontal lens flares, deep starfield',
  avoid: [
    'white border or polaroid frame',
    'cubes blocks or rectangular solids',
    '3d geometric shapes or abstract sculptures',
    'overlapping transparent squares',
    'static still-life objects',
    'concentric radar circles',
    'node graphs or constellation networks',
    'dashboard or UI aesthetics',
    'stock synthwave wallpaper',
  ],
};

/** Flowing sci-fi signal forms — organic, alive, never cubic or static. */
const MOTIF_BY_KEYWORD = [
  ['execution', 'rushing river of light'],
  ['velocity', 'rushing river of light'],
  ['momentum', 'surging aurora wave'],
  ['capital', 'converging luminescent streams'],
  ['funding', 'ascending plasma trails'],
  ['match', 'intertwined energy filaments'],
  ['sector', 'living color aura'],
  ['god', 'prophetic core glow'],
  ['score', 'prophetic core glow'],
  ['coverage', 'veil of tomorrow'],
  ['recalibrat', 'drifting oracle mist'],
  ['innovation', 'fractured future-light'],
  ['traction', 'rising signal current'],
  ['conviction', 'steady pillar of light'],
  ['receptivity', 'solar corona magnetic loops'],
  ['investor', 'solar corona magnetic loops'],
  ['news', 'surging aurora wave'],
];

const LAYOUT_MODES = [
  {
    id: 'solar_rays',
    description: 'dual solar cores — white-blue hot centers, nested magnetic elliptical loops in orange-gold-red, horizontal lens flares, starfield void (canonical PYTHH reference)',
  },
  { id: 'threshold', description: 'today\'s darkness on one side, tomorrow\'s glow on the other — PYTHH between them' },
  { id: 'prophecy', description: 'flowing signal rivers spiraling toward a luminous future point' },
  { id: 'aurora', description: 'alive ribbon energy sweeping through the void' },
  { id: 'conduit', description: 'channels of sci-fi light connecting present to future' },
  { id: 'awakening', description: 'signals erupting from darkness into full color motion' },
  { id: 'veil', description: 'sublime aura parting to reveal what is coming' },
];

/** Oracle aesthetic anchors — PYTHH between today and tomorrow. */
const AESTHETIC_ANCHORS = [
  'Like twin solar oracles in deep space — each a blazing white-blue core wrapped in nested magnetic field loops of orange, gold, and red, with sharp horizontal lens-flare rays cutting through the void.',
  'Like an oracle at the threshold of two timelines — today\'s deep void on one side, tomorrow\'s luminous horizon on the other, flowing energy between them.',
  'Like bioluminescent prophecy — living rivers of colored light spiraling through darkness, alive and breathing.',
  'Like sci-fi aurora shaped by intelligence — sublime ribbon energy sweeping through space, powerful and mysterious.',
  'Like signals seen by an all-knowing mind — plasma streams, color waves, and light currents flowing with purpose and speed.',
  'Like the moment before the future arrives — the air charged, colors building, motion everywhere, nothing still.',
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

function pickLayoutMode(snapshot, plan, seed) {
  const leading = (snapshot.leading_signal?.label || '').toLowerCase();
  const movers = snapshot.god_movers || [];
  const netDelta = movers.reduce((s, m) => s + (m.delta || 0), 0);
  const rising = movers.filter((m) => (m.delta || 0) > 0).length;
  const falling = movers.filter((m) => (m.delta || 0) < 0).length;
  const matchCount = (snapshot.top_matches || []).length;

  const matchScore = snapshot.top_match?.match_score || 0;

  // Canonical reference: dual solar-ray cores when a strong match or dominant signal profile exists
  if (snapshot.top_match && matchScore >= 70) {
    return LAYOUT_MODES.find((l) => l.id === 'solar_rays') || LAYOUT_MODES[0];
  }
  if ((plan.leadingPct || 0) >= 62 && (matchCount >= 1 || snapshot.hottest?.[0])) {
    return LAYOUT_MODES.find((l) => l.id === 'solar_rays') || LAYOUT_MODES[0];
  }

  if (plan.fundingCount >= 10) return LAYOUT_MODES.find((l) => l.id === 'aurora') || LAYOUT_MODES[3];
  if (netDelta >= 20 || rising >= 3) return LAYOUT_MODES.find((l) => l.id === 'awakening') || LAYOUT_MODES[5];
  if (netDelta <= -20 || falling >= 3) return LAYOUT_MODES.find((l) => l.id === 'veil') || LAYOUT_MODES[6];
  if (matchCount >= 2 || leading.includes('capital') || leading.includes('convergence')) {
    return LAYOUT_MODES.find((l) => l.id === 'solar_rays') || LAYOUT_MODES[0];
  }
  if (leading.includes('velocity') || leading.includes('execution')) {
    return LAYOUT_MODES.find((l) => l.id === 'solar_rays') || LAYOUT_MODES[0];
  }
  if (plan.tension > 0.55) return LAYOUT_MODES.find((l) => l.id === 'threshold') || LAYOUT_MODES[1];
  if (leading.includes('receptivity') || leading.includes('momentum')) {
    return LAYOUT_MODES.find((l) => l.id === 'solar_rays') || LAYOUT_MODES[0];
  }

  const fp = [
    snapshot.edition_date,
    leading,
    plan.accentLabel,
    plan.fundingCount,
    netDelta,
    matchCount,
  ].join('|');
  let h = 0;
  for (let i = 0; i < fp.length; i++) h = (Math.imul(31, h) + fp.charCodeAt(i)) | 0;
  const idx = (Math.abs(h) + seed) % LAYOUT_MODES.length;
  return LAYOUT_MODES[idx];
}

function buildInterpretation(snapshot, plan, layout, layers) {
  const leading = snapshot.leading_signal?.label || 'mixed signals';
  const match = snapshot.top_match;
  const matchNote = match?.startup?.name
    ? ` Match tension: ${match.startup.name} ↔ ${match.investor?.firm_name || match.investor?.name}.`
    : '';
  const movers = snapshot.god_movers || [];
  const moverNote = movers.length
    ? ` GOD movement: ${movers.slice(0, 2).map((m) => `${m.name} ${m.delta > 0 ? '+' : ''}${m.delta}`).join(', ')}.`
    : '';
  const sectorNote = snapshot.sector_trends?.[0]
    ? ` Sector tide: ${snapshot.sector_trends[0].sector}.`
    : '';
  return (
    `PYTHH the oracle reads ${snapshot.edition_date}: ${leading.toLowerCase()} dominant — ` +
    `she sees ${layers.length} living signals flowing between today and tomorrow, ` +
    `${layout.id} formation, sector aura ${plan.accentLabel}.${sectorNote}${moverNote}${matchNote}`
  );
}

/**
 * Map live signals → layered abstract motifs with seed-randomized placement.
 */
function interpretSignalLayers(snapshot, plan, seed) {
  const rand = mulberry32(seed + 7919);
  const layout = pickLayoutMode(snapshot, plan, seed);
  const layers = [];
  const leadingLabel = (snapshot.leading_signal?.label || '').toLowerCase();

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
    if ((dim.label || '').toLowerCase() === leadingLabel) return;
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

  (snapshot.god_movers || []).slice(0, 3).forEach((m, i) => {
    const delta = m.delta || 0;
    layers.push({
      id: `god-mover-${i}`,
      signal: 'god_delta',
      label: `${m.name} ${delta > 0 ? '+' : ''}${delta} GOD`,
      motif: delta > 0 ? 'rising signal current' : 'drifting oracle mist',
      role: delta > 0 ? 'midground' : 'background',
      zIndex: 2 + i,
      opacity: 0.2 + Math.min(0.35, Math.abs(delta) / 80),
      scale: 0.35 + Math.min(0.4, Math.abs(delta) / 100),
      rotation: delta > 0 ? Math.round(rand() * 40 - 20) : Math.round(rand() * 60 - 30),
      x: 140 + i * 180 + rand() * 80,
      y: 180 + rand() * 320,
    });
  });

  (snapshot.sector_trends || []).slice(0, 2).forEach((st, i) => {
    layers.push({
      id: `sector-trend-${i}`,
      signal: 'sector_trend',
      label: `${st.sector} · ${st.count} cos`,
      motif: i === 0 ? 'living color aura' : 'parallel thrust ribbons',
      role: 'background',
      zIndex: 1 + i,
      opacity: 0.1 + Math.min(0.22, (st.count || 1) / 200),
      scale: 0.7 + Math.min(0.5, (st.avg_score || 60) / 200),
      rotation: Math.round(rand() * 120 - 60),
      color: i === 0 ? plan.accent : undefined,
      x: 200 + i * 220,
      y: 300 + rand() * 160,
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

  (snapshot.top_matches || []).slice(1, 3).forEach((m, i) => {
    const score = m.match_score || 50;
    layers.push({
      id: `match-${i + 2}`,
      signal: 'match',
      label: `${m.startup?.name || 'Startup'} ↔ ${m.investor?.firm_name || m.investor?.name || 'Investor'}`,
      motif: 'intertwined energy filaments',
      role: 'foreground',
      zIndex: 9 - i,
      opacity: 0.28 + score / 320,
      scale: 0.3 + score / 220,
      rotation: (plan.tetherAngle || 0) + (i + 1) * 28,
      x: 180 + rand() * 440,
      y: 160 + rand() * 280,
    });
  });

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
