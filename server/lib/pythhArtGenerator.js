'use strict';

/**
 * Pythh Signal Art — minimalist neon vector compositions from daily signals.
 * Skills: server/lib/signal-art/SKILL.md + mcpmarket-me/skills/ai-artist/
 */

const { getSupabaseClient } = require('./supabaseClient');
const { applyCompositionRules, buildImageBrief, LIGHTING_STYLES } = require('./signalArtPrompt');
const { generateArtCopy } = require('./signalArtCopy');
const { buildMidjourneyPrompt } = require('./signalArtMidjourney');

const VOID = '#050508';
const VOID_EDGE = '#0a0a0c';
const MIST = 'rgba(255,255,255,0.06)';
const MIST_FAINT = 'rgba(255,255,255,0.03)';

const NEON = {
  emerald: '#34d399',
  amber: '#fbbf24',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  rose: '#f472b6',
  lime: '#4ade80',
};

const SECTOR_NEON = {
  fintech: NEON.amber,
  gaming: NEON.violet,
  ai: NEON.emerald,
  'artificial intelligence': NEON.emerald,
  saas: NEON.cyan,
  healthcare: NEON.violet,
  climate: NEON.lime,
  crypto: NEON.rose,
  default: NEON.emerald,
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

function pickSectorNeon(sectors) {
  const key = (Array.isArray(sectors) ? sectors[0] : sectors || '').toLowerCase();
  for (const [k, c] of Object.entries(SECTOR_NEON)) {
    if (key.includes(k)) return c;
  }
  return SECTOR_NEON.default;
}

function godVariance(startups) {
  const scores = (startups || []).map((s) => s.total_god_score).filter((n) => n != null);
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);
}

function extractSnapshot(newsletter) {
  const nl = newsletter || {};
  return {
    edition_date: nl.date || new Date().toISOString().slice(0, 10),
    leading_signal: nl.signalsThatMatter?.leading || null,
    signal_dimensions: nl.signalsThatMatter?.dimensions?.slice(0, 5) || [],
    coverage: nl.signalsThatMatter?.coverage || 0,
    exemplars: nl.signalsThatMatter?.exemplars || [],
    hottest: (nl.hottestStartups || []).slice(0, 5),
    funding_count: (nl.moneyMoves || nl.fundingRounds || []).length,
    top_match: nl.topMatches?.[0] || null,
    editorial: nl.editorial?.text || null,
    top_sectors: (nl.sectorTrends || []).slice(0, 3).map((s) => s.sector),
  };
}

function planComposition(snapshot, seed) {
  const rand = mulberry32(seed);
  const leading = snapshot.leading_signal;
  const leadingPct = leading?.pct ?? 40;
  const coverage = snapshot.coverage || 50;
  const fundingCount = snapshot.funding_count || 0;
  const variance = godVariance(snapshot.hottest);
  const tension = Math.min(1, variance / 25);
  const matchScore = snapshot.top_match?.match_score ?? 50;
  const godScore = snapshot.hottest[0]?.total_god_score ?? 70;

  const accent = pickSectorNeon(
    snapshot.top_sectors?.[0] ? [snapshot.top_sectors[0]] : snapshot.exemplars[0]?.sectors,
  );
  const accentLabel = snapshot.top_sectors?.[0] || snapshot.exemplars[0]?.sectors?.[0] || 'mixed';

  const plan = {
    accent,
    accentLabel,
    leadingPct,
    coverage,
    fundingCount,
    tension,
    tensionLabel: tension > 0.55 ? 'asymmetric' : tension > 0.25 ? 'balanced' : 'centered',
    horizonY: 520,
    beaconX: 400,
    beaconH: 80 + leadingPct * 1.4 + (godScore - 50) * 0.35,
    arcSweep: 120 + leadingPct * 1.8,
    arcRadius: 220 + leadingPct * 0.9,
    streakCount: Math.min(6, Math.max(0, fundingCount)),
    tetherAngle: -35 + (matchScore / 100) * 70 + (rand() - 0.5) * 8,
    dimensions: snapshot.signal_dimensions.slice(0, 5),
  };

  return applyCompositionRules(plan, snapshot, seed);
}

function buildLegend(plan) {
  const lighting = LIGHTING_STYLES[plan.lightingStyle];
  return [
    { key: 'hue', label: 'Sector neon', value: plan.accentLabel },
    { key: 'arc', label: 'Leading signal', value: `${plan.leadingPct}% sweep` },
    { key: 'light', label: 'Lighting', value: lighting?.label || 'Neon glow' },
    { key: 'capital', label: 'Funding streaks', value: String(plan.fundingCount) },
    { key: 'form', label: 'Balance', value: plan.tensionLabel },
  ];
}

function floorGlowColor(plan) {
  if (plan.lightingStyle === 'blue_hour') return NEON.cyan;
  if (plan.lightingStyle === 'golden_hour') return NEON.amber;
  return plan.accent;
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const start = (startDeg * Math.PI) / 180;
  const end = ((startDeg + sweepDeg) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function generateSvg(snapshot, seed) {
  const plan = planComposition(snapshot, seed);
  const rand = mulberry32(seed + 1);
  const W = 800;
  const H = 800;
  const { accent, horizonY, beaconX, beaconH, arcSweep, arcRadius, streakCount, tetherAngle } = plan;
  const lighting = LIGHTING_STYLES[plan.lightingStyle] || LIGHTING_STYLES.neon_glow;
  const floorColor = floorGlowColor(plan);
  const floorOp = lighting.floorOpacity;

  const beaconTop = horizonY - beaconH;
  const beaconW = 28 + plan.leadingPct * 0.15;
  const beacon = [
    `${beaconX.toFixed(1)},${horizonY}`,
    `${(beaconX - beaconW).toFixed(1)},${horizonY}`,
    `${beaconX.toFixed(1)},${beaconTop.toFixed(1)}`,
    `${(beaconX + beaconW).toFixed(1)},${horizonY}`,
  ].join(' ');

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="Pythh signal composition — minimalist neon vector">`,
  );

  parts.push('<defs>');
  parts.push(
    `<linearGradient id="void" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${VOID}"/><stop offset="72%" stop-color="${VOID_EDGE}"/><stop offset="100%" stop-color="${VOID}"/></linearGradient>`,
  );
  parts.push(
    `<linearGradient id="floorGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${floorColor}" stop-opacity="0"/><stop offset="100%" stop-color="${floorColor}" stop-opacity="${floorOp}"/></linearGradient>`,
  );
  parts.push(
    `<filter id="neonBloom" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
  );
  parts.push('</defs>');

  parts.push('<g id="background">');
  parts.push(`<rect width="${W}" height="${H}" fill="url(#void)"/>`);
  if (plan.lightingStyle === 'split') {
    parts.push(`<rect x="0" y="0" width="${(W / 2).toFixed(0)}" height="${H}" fill="#000" opacity="0.35"/>`);
  }
  parts.push(`<rect x="0" y="${horizonY}" width="${W}" height="${H - horizonY}" fill="url(#floorGlow)"/>`);
  parts.push(`<line x1="48" y1="${horizonY}" x2="752" y2="${horizonY}" stroke="${MIST}" stroke-width="1"/>`);
  parts.push(
    `<circle cx="400" cy="${horizonY + 40}" r="${arcRadius + 60}" fill="none" stroke="${MIST_FAINT}" stroke-width="1"/>`,
  );
  parts.push('</g>');

  parts.push('<g id="midground">');
  const arcStart = -90 - arcSweep / 2 + (plan.tension > 0.35 ? (rand() - 0.5) * 12 : 0);
  parts.push(
    `<path d="${arcPath(400, horizonY + 20, arcRadius, arcStart, arcSweep)}" fill="none" stroke="${accent}" stroke-opacity="0.22" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  if (arcSweep > 140) {
    parts.push(
      `<path d="${arcPath(400, horizonY + 20, arcRadius - 36, arcStart + 12, arcSweep - 24)}" fill="none" stroke="${MIST}" stroke-width="1" stroke-linecap="round"/>`,
    );
  }

  const dims = plan.dimensions.length ? plan.dimensions : [{ pct: plan.leadingPct }];
  dims.forEach((dim, i) => {
    const tickH = 24 + (dim.pct || 20) * 0.55;
    const x = 720 - i * 14;
    parts.push(
      `<line x1="${x}" y1="${horizonY - 8}" x2="${x}" y2="${(horizonY - 8 - tickH).toFixed(1)}" stroke="${i === 0 ? accent : MIST}" stroke-opacity="${i === 0 ? 0.45 : 0.2}" stroke-width="1.5" stroke-linecap="round"/>`,
    );
  });

  const streakBaseX = 72;
  const streakBaseY = horizonY + 28;
  const streakColor = plan.lightingStyle === 'golden_hour' ? NEON.amber : `${NEON.amber}`;
  for (let i = 0; i < streakCount; i++) {
    const ox = i * 10;
    const len = 36 + rand() * 28;
    parts.push(
      `<line x1="${streakBaseX + ox}" y1="${streakBaseY + i * 6}" x2="${(streakBaseX + ox + len * 0.85).toFixed(1)}" y2="${(streakBaseY + i * 6 - len * 0.32).toFixed(1)}" stroke="${streakColor}" stroke-opacity="0.38" stroke-width="1" stroke-linecap="round"/>`,
    );
  }
  parts.push('</g>');

  parts.push('<g id="foreground" filter="url(#neonBloom)">');
  parts.push(
    `<polyline points="${beacon}" fill="none" stroke="${accent}" stroke-width="2.25" stroke-linejoin="miter" stroke-linecap="square"/>`,
  );
  if (plan.lightingStyle === 'rim' || plan.lightingStyle === 'split' || plan.lightingStyle === 'neon_glow') {
    parts.push(
      `<line x1="${(beaconX + beaconW * 0.35).toFixed(1)}" y1="${beaconTop.toFixed(1)}" x2="${(beaconX + beaconW * 0.35).toFixed(1)}" y2="${horizonY.toFixed(1)}" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"/>`,
    );
  }
  parts.push(
    `<line x1="${beaconX.toFixed(1)}" y1="${horizonY}" x2="${beaconX.toFixed(1)}" y2="${(horizonY + 18).toFixed(1)}" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5"/>`,
  );

  const tetherLen = 100 + plan.leadingPct * 0.6;
  const rad = (tetherAngle * Math.PI) / 180;
  const ax = beaconX - 90;
  const ay = horizonY - 40;
  const bx = ax + Math.cos(rad) * tetherLen;
  const by = ay + Math.sin(rad) * tetherLen * 0.55;
  parts.push(
    `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4" fill="none" stroke="${accent}" stroke-width="1.5"/>`,
  );
  parts.push(
    `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="4" fill="none" stroke="${NEON.amber}" stroke-width="1.5" stroke-opacity="0.85"/>`,
  );
  parts.push(
    `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${MIST}" stroke-width="1"/>`,
  );
  parts.push('</g>');

  parts.push('</svg>');

  plan.legend = buildLegend(plan);
  plan.compositionNotes = {
    background: 'void gradient, golden-ratio horizon, faint dome',
    midground: `${arcSweep.toFixed(0)}° signal arc, ${dims.length} ticks, ${streakCount} capital streaks`,
    foreground: 'beacon chevron + match tether (rule of thirds)',
    lighting: `${lighting.label} — ${lighting.effect}`,
  };

  return { svg: parts.join('\n'), params: plan };
}

async function generatePythhArtEdition(newsletter) {
  const snapshot = extractSnapshot(newsletter);
  const seed = hashSeed(`pythh-art-${snapshot.edition_date}`);
  const { svg, params } = generateSvg(snapshot, seed);
  const imageBrief = buildImageBrief(snapshot, params);
  const midjourney = buildMidjourneyPrompt(snapshot, params, imageBrief);
  const copy = await generateArtCopy(snapshot, params, imageBrief);

  return {
    edition_date: snapshot.edition_date,
    seed,
    svg,
    midjourney,
    raster_url: null,
    signal_snapshot: {
      ...snapshot,
      composition: params.compositionNotes,
      image_brief: imageBrief,
      midjourney,
      raster_url: null,
    },
    copy: {
      ...copy,
      midjourney: {
        imagine: midjourney.imagine,
        profileUrl: midjourney.profileUrl,
        username: midjourney.username,
        seed: midjourney.seed,
      },
    },
    generated_at: new Date().toISOString(),
  };
}

async function saveArtEdition(edition) {
  const supabase = getSupabaseClient();
  const row = {
    edition_date: edition.edition_date,
    seed: edition.seed,
    svg: edition.svg,
    signal_snapshot: edition.signal_snapshot,
    copy: edition.copy,
    generated_at: edition.generated_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('pythh_art_editions')
    .upsert(row, { onConflict: 'edition_date' });
  if (error) throw error;
  return row;
}

async function loadArtEdition(editionDate) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pythh_art_editions')
    .select('*')
    .eq('edition_date', editionDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listArtEditions({ limit = 30 } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pythh_art_editions')
    .select('edition_date, copy, generated_at')
    .order('edition_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = {
  generatePythhArtEdition,
  saveArtEdition,
  loadArtEdition,
  listArtEditions,
  hashSeed,
  planComposition,
  buildImageBrief,
};
