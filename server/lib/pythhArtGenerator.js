'use strict';

/**
 * Pythh Signal Art — digital abstract layered compositions from daily signals.
 * Registered direction: server/lib/signalArtDirection.js
 * Skill: server/lib/signal-art/SKILL.md
 */

const { getSupabaseClient } = require('./supabaseClient');
const { applyCompositionRules, buildImageBrief, LIGHTING_STYLES } = require('./signalArtPrompt');
const { interpretSignalLayers, buildLayerLegend, SIGNAL_ART } = require('./signalArtDirection');
const { generateArtCopy } = require('./signalArtCopy');
const { generateAndPersistRaster, getGeminiApiKey, deriveThumbnailUrl } = require('./signalArtGemini');

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
  const topMatches = (nl.topMatches || nl.hotMatches || []).slice(0, 3);
  return {
    edition_date: nl.date || new Date().toISOString().slice(0, 10),
    leading_signal: nl.signalsThatMatter?.leading || null,
    signal_dimensions: nl.signalsThatMatter?.dimensions?.slice(0, 5) || [],
    coverage: nl.signalsThatMatter?.coverage || 0,
    exemplars: nl.signalsThatMatter?.exemplars || [],
    hottest: (nl.hottestStartups || []).slice(0, 5),
    funding_count: (nl.moneyMoves || nl.fundingRounds || []).length,
    top_match: topMatches[0] || null,
    top_matches: topMatches,
    god_movers: (nl.scoreMovers || []).slice(0, 5),
    sector_trends: (nl.sectorTrends || []).slice(0, 5),
    editorial: nl.editorial?.text || null,
    top_sectors: (nl.sectorTrends || []).slice(0, 3).map((s) => s.sector),
  };
}

/** Stable seed from edition date + live signal fingerprint (not calendar alone). */
function buildSignalFingerprint(snapshot) {
  return [
    snapshot.leading_signal?.label,
    snapshot.leading_signal?.pct,
    snapshot.top_sectors?.join('|'),
    snapshot.funding_count,
    snapshot.top_match?.startup?.name,
    snapshot.top_match?.match_score,
    ...(snapshot.god_movers || []).slice(0, 3).map((m) => `${m.name}:${m.delta}`),
    ...(snapshot.sector_trends || []).slice(0, 2).map((s) => `${s.sector}:${s.count}:${s.avg_score}`),
    ...(snapshot.top_matches || []).slice(0, 2).map((m) => `${m.startup?.name}:${m.match_score}`),
    ...(snapshot.signal_dimensions || []).slice(0, 3).map((d) => `${d.key}:${d.pct}`),
  ]
    .filter((x) => x != null && x !== '')
    .join('::');
}

function deriveArtSeed(snapshot) {
  const fp = buildSignalFingerprint(snapshot);
  return hashSeed(`pythh-art-${snapshot.edition_date}-${fp}`);
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

function buildLegend(plan, signalArt) {
  const lighting = LIGHTING_STYLES[plan.lightingStyle];
  const base = [
    { key: 'direction', label: 'Art direction', value: SIGNAL_ART.name },
    { key: 'layout', label: 'Layout', value: signalArt.layoutMode },
    { key: 'layers', label: 'Signal layers', value: String(signalArt.layerCount) },
    { key: 'hue', label: 'Sector tone', value: plan.accentLabel },
    { key: 'light', label: 'Lighting', value: lighting?.label || 'Neon glow' },
    { key: 'form', label: 'Balance', value: plan.tensionLabel },
  ];
  const layerLegend = buildLayerLegend(signalArt).slice(0, 3);
  return [...base, ...layerLegend];
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

function renderSignalLayerSvg(layer, accent) {
  const color = layer.color || accent;
  const op = layer.opacity.toFixed(2);
  const r = Math.round(40 + layer.scale * 90);
  const x = layer.x ?? 400;
  const y = layer.y ?? 400;
  const rot = layer.rotation || 0;
  const transform = `rotate(${rot} ${x} ${y})`;
  const motionRad = ((rot - 90) * Math.PI) / 180;
  const tailLen = r * 1.2;
  const tailOp = (parseFloat(op) * 0.35).toFixed(2);

  const motionTail = `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(motionRad) * tailLen).toFixed(1)}" y2="${(y + Math.sin(motionRad) * tailLen).toFixed(1)}" stroke="${color}" stroke-opacity="${tailOp}" stroke-width="1.5" stroke-linecap="round"/>`;

  let main;
  if (layer.motif.includes('arc') || layer.motif.includes('ring') || layer.motif.includes('pulse')) {
    main = `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${Math.round(r * 0.55)}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.5" transform="${transform}"/>`;
  } else if (
    layer.motif.includes('filament') ||
    layer.motif.includes('ribbon') ||
    layer.motif.includes('streak') ||
    layer.motif.includes('trail') ||
    layer.motif.includes('river') ||
    layer.motif.includes('current')
  ) {
    const x2 = x + Math.cos((rot * Math.PI) / 180) * r * 1.4;
    const y2 = y + Math.sin((rot * Math.PI) / 180) * r * 0.6;
    main = `<line x1="${x}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-opacity="${op}" stroke-width="2.5" stroke-linecap="round"/>`;
  } else if (layer.motif.includes('wash') || layer.motif.includes('void') || layer.motif.includes('mist')) {
    main = `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${Math.round(r * 0.4)}" fill="${color}" opacity="${(parseFloat(op) * 0.25).toFixed(2)}" transform="${transform}"/>`;
  } else {
    main = `<circle cx="${x}" cy="${y}" r="${Math.round(r * 0.35)}" fill="${color}" opacity="${(parseFloat(op) * 0.5).toFixed(2)}" transform="${transform}"/>`;
  }
  return motionTail + main;
}

function renderFlowRibbons(W, H, accent, rand, count = 5) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const y0 = 80 + rand() * (H - 160);
    const cp1x = 120 + rand() * 200;
    const cp1y = y0 - 80 - rand() * 120;
    const cp2x = 480 + rand() * 200;
    const cp2y = y0 + 60 + rand() * 100;
    const xEnd = W - 40 - rand() * 80;
    const yEnd = y0 + (rand() - 0.5) * 80;
    parts.push(
      `<path d="M 0 ${y0.toFixed(0)} C ${cp1x.toFixed(0)} ${cp1y.toFixed(0)} ${cp2x.toFixed(0)} ${cp2y.toFixed(0)} ${xEnd.toFixed(0)} ${yEnd.toFixed(0)}" fill="none" stroke="${accent}" stroke-opacity="${(0.06 + rand() * 0.1).toFixed(2)}" stroke-width="${(2 + rand() * 2).toFixed(1)}" stroke-linecap="round"/>`,
    );
  }
  return parts.join('\n');
}

function renderLayoutBackdrop(layoutMode, plan, accent, W, H, horizonY, rand, snapshot = {}) {
  const parts = [];
  switch (layoutMode) {
    case 'threshold':
      parts.push(`<rect x="0" y="0" width="${W / 2}" height="${H}" fill="#000000" opacity="0.42"/>`);
      parts.push(`<rect x="${W / 2}" y="0" width="${W / 2}" height="${H}" fill="${accent}" opacity="0.07"/>`);
      break;
    case 'aurora':
      parts.push(renderFlowRibbons(W, H, accent, rand, 7));
      for (let i = 0; i < 6; i++) {
        const y = 60 + i * 38;
        const cp = 80 + rand() * 60;
        parts.push(
          `<path d="M 0 ${y} Q ${(W / 3).toFixed(0)} ${y - cp} ${(W / 2).toFixed(0)} ${y + 25} T ${W} ${y - 15}" fill="none" stroke="${accent}" stroke-opacity="${(0.07 + i * 0.025).toFixed(2)}" stroke-width="2.5" stroke-linecap="round"/>`,
        );
      }
      break;
    case 'prophecy': {
      const cx = plan.beaconX || 400;
      const cy = horizonY - 60;
      parts.push(renderFlowRibbons(W, H, accent, rand, 4));
      for (let i = 0; i < 4; i++) {
        const r = 90 + i * 55;
        parts.push(
          `<path d="${arcPath(cx, cy, r, -120 + i * 8, 240 - i * 16)}" fill="none" stroke="${accent}" stroke-opacity="${(0.06 + i * 0.03).toFixed(2)}" stroke-width="1.5" stroke-linecap="round"/>`,
        );
      }
      break;
    }
    case 'conduit':
      for (let i = 0; i < 5; i++) {
        const x = 100 + i * 130;
        const drift = Math.round((rand() - 0.5) * 50);
        parts.push(
          `<line x1="${x}" y1="${H}" x2="${x + drift}" y2="100" stroke="${accent}" stroke-opacity="${(0.1 + rand() * 0.08).toFixed(2)}" stroke-width="2" stroke-linecap="round"/>`,
        );
      }
      break;
    case 'awakening':
      parts.push(`<ellipse cx="400" cy="720" rx="360" ry="200" fill="${accent}" opacity="0.14"/>`);
      parts.push(`<ellipse cx="400" cy="680" rx="220" ry="120" fill="${accent}" opacity="0.22"/>`);
      break;
    case 'veil':
      for (let i = 0; i < 7; i++) {
        const y = 90 + i * 95;
        parts.push(
          `<line x1="0" y1="${y}" x2="${W}" y2="${y + 18 - i * 2}" stroke="${accent}" stroke-opacity="0.06" stroke-width="1"/>`,
        );
      }
      break;
    default:
      break;
  }
  return parts.join('\n');
}

function generateSvg(snapshot, seed) {
  const plan = planComposition(snapshot, seed);
  const signalArt = interpretSignalLayers(snapshot, plan, seed);
  const rand = mulberry32(seed + 1);
  const W = 800;
  const H = 800;
  const { accent, horizonY, beaconX, beaconH, arcSweep, arcRadius, streakCount, tetherAngle } = plan;
  const lighting = LIGHTING_STYLES[plan.lightingStyle] || LIGHTING_STYLES.neon_glow;
  const floorColor = floorGlowColor(plan);
  const floorOp = lighting.floorOpacity;

  const beaconTop = horizonY - beaconH;
  const beaconW = 28 + plan.leadingPct * 0.15;
  const layoutMode = signalArt.layoutMode;
  const useBeacon = layoutMode !== 'aurora' && layoutMode !== 'veil';
  const beacon = [
    `${beaconX.toFixed(1)},${horizonY}`,
    `${(beaconX - beaconW).toFixed(1)},${horizonY}`,
    `${beaconX.toFixed(1)},${beaconTop.toFixed(1)}`,
    `${(beaconX + beaconW).toFixed(1)},${horizonY}`,
  ].join(' ');

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="Pythh Signal Art — layered abstract digital composition">`,
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
  parts.push(renderLayoutBackdrop(signalArt.layoutMode, plan, accent, W, H, horizonY, rand, snapshot));
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

  parts.push('<g id="signal-layers" opacity="0.92">');
  for (const layer of [...signalArt.layers].sort((a, b) => a.zIndex - b.zIndex)) {
    if (layer.id === 'void') continue;
    parts.push(renderSignalLayerSvg(layer, accent));
  }
  parts.push('</g>');

  parts.push('<g id="foreground" filter="url(#neonBloom)">');
  if (useBeacon) {
    parts.push(
      `<polyline points="${beacon}" fill="none" stroke="${accent}" stroke-width="2.25" stroke-linejoin="miter" stroke-linecap="square"/>`,
    );
  }
  if (useBeacon && (plan.lightingStyle === 'rim' || plan.lightingStyle === 'split' || plan.lightingStyle === 'neon_glow')) {
    parts.push(
      `<line x1="${(beaconX + beaconW * 0.35).toFixed(1)}" y1="${beaconTop.toFixed(1)}" x2="${(beaconX + beaconW * 0.35).toFixed(1)}" y2="${horizonY.toFixed(1)}" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"/>`,
    );
  }
  if (useBeacon) {
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
  }
  parts.push('</g>');

  parts.push('</svg>');

  plan.legend = buildLegend(plan, signalArt);
  plan.compositionNotes = {
    artDirection: SIGNAL_ART.name,
    layout: signalArt.layoutMode,
    interpretation: signalArt.interpretation,
    background: 'void gradient, golden-ratio horizon, chromatic wash layers',
    midground: `${signalArt.layerCount} coordinated signal layers (${signalArt.layoutMode})`,
    foreground: 'focal bloom + match filament overlay',
    lighting: `${lighting.label} — ${lighting.effect}`,
  };

  return { svg: parts.join('\n'), params: plan, signalArt };
}

async function generatePythhArtEdition(newsletter, { repoRoot = null, generateRaster = true } = {}) {
  const snapshot = extractSnapshot(newsletter);
  const seed = deriveArtSeed(snapshot);
  const signalFingerprint = buildSignalFingerprint(snapshot);
  const { svg, params, signalArt } = generateSvg(snapshot, seed);
  const imageBrief = buildImageBrief(snapshot, params, signalArt);
  const copy = await generateArtCopy(snapshot, params, imageBrief, signalArt);

  let raster = { ok: false, reason: 'skipped' };
  if (generateRaster && process.env.SIGNAL_ART_RASTER !== '0') {
    raster = await generateAndPersistRaster({
      editionDate: snapshot.edition_date,
      imageBrief,
      repoRoot,
    });
    if (raster.ok) {
      console.log(`[signal-art] Raster saved (${raster.model}): ${raster.raster_url}`);
      if (raster.thumbnail_url) {
        console.log(`[signal-art] Thumbnail saved: ${raster.thumbnail_url}`);
      }
    } else {
      console.warn(`[signal-art] Raster skipped: ${raster.reason} — ${raster.error || raster.hint || ''}`);
    }
  }

  return {
    edition_date: snapshot.edition_date,
    seed,
    svg,
    raster_url: raster.ok ? raster.raster_url : null,
    thumbnail_url: raster.ok ? raster.thumbnail_url : null,
    raster_provider: raster.ok ? raster.provider : null,
    raster_model: raster.ok ? raster.model : null,
    signal_snapshot: {
      ...snapshot,
      signal_fingerprint: signalFingerprint,
      art_direction: SIGNAL_ART,
      signal_art: {
        layoutMode: signalArt.layoutMode,
        interpretation: signalArt.interpretation,
        layerCount: signalArt.layerCount,
        layers: signalArt.layers.map(({ id, label, motif, role, signal }) => ({
          id,
          label,
          motif,
          role,
          signal,
        })),
      },
      composition: params.compositionNotes,
      image_brief: imageBrief,
      raster_url: raster.ok ? raster.raster_url : null,
      thumbnail_url: raster.ok ? raster.thumbnail_url : null,
      raster_provider: raster.ok ? raster.provider : null,
      raster_model: raster.ok ? raster.model : null,
      raster_error: raster.ok ? null : { reason: raster.reason, error: raster.error, hint: raster.hint },
    },
    copy: {
      ...copy,
      art_direction: SIGNAL_ART.name,
      raster_provider: raster.ok ? raster.provider : null,
    },
    generated_at: new Date().toISOString(),
  };
}

async function saveArtEdition(edition) {
  const supabase = getSupabaseClient();
  const snap = { ...(edition.signal_snapshot || {}) };
  if (edition.raster_url) snap.raster_url = edition.raster_url;
  if (edition.thumbnail_url) snap.thumbnail_url = edition.thumbnail_url;
  if (edition.raster_provider) snap.raster_provider = edition.raster_provider;
  if (edition.raster_model) snap.raster_model = edition.raster_model;

  const row = {
    edition_date: edition.edition_date,
    seed: edition.seed,
    svg: edition.svg,
    signal_snapshot: snap,
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

async function ensureArtEditionRaster(row, { repoRoot = null } = {}) {
  if (!row?.edition_date) return row;

  const snap = { ...(row.signal_snapshot || {}) };
  let raster_url = row.raster_url ?? snap.raster_url ?? null;
  let thumbnail_url = row.thumbnail_url ?? snap.thumbnail_url ?? null;

  if (raster_url && thumbnail_url) {
    return {
      ...row,
      raster_url,
      thumbnail_url,
      signal_snapshot: snap,
    };
  }

  if (process.env.SIGNAL_ART_RASTER === '0') return row;

  const priorError = snap.raster_error;
  if (
    priorError &&
    ['missing_api_key', 'tier_upgrade_required'].includes(priorError.reason) &&
    !getGeminiApiKey()
  ) {
    return row;
  }

  const imageBrief = snap.image_brief;
  if (!imageBrief?.visualPrompt) {
    return row;
  }

  const raster = await generateAndPersistRaster({
    editionDate: row.edition_date,
    imageBrief,
    repoRoot,
  });

  if (!raster.ok) {
    snap.raster_error = {
      reason: raster.reason,
      error: raster.error,
      hint: raster.hint,
      attempted_at: new Date().toISOString(),
    };
    return { ...row, signal_snapshot: snap };
  }

  raster_url = raster.raster_url;
  thumbnail_url = raster.thumbnail_url ?? deriveThumbnailUrl(raster_url);
  snap.raster_url = raster_url;
  snap.thumbnail_url = thumbnail_url;
  snap.raster_provider = raster.provider;
  snap.raster_model = raster.model;
  snap.raster_error = null;

  const updated = {
    ...row,
    raster_url,
    thumbnail_url,
    raster_provider: raster.provider,
    raster_model: raster.model,
    signal_snapshot: snap,
    copy: {
      ...(row.copy || {}),
      raster_provider: raster.provider,
    },
  };

  try {
    await saveArtEdition(updated);
  } catch (e) {
    console.warn('[signal-art] raster backfill save failed:', e.message);
  }

  return updated;
}

function previousEditionDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * When live signals are unchanged day-over-day, regenerate today's edition so layout/prompt vary by date.
 */
async function refreshStaleTodayEdition(row, { repoRoot, generateNewsletter, today }) {
  if (!row || row.edition_date !== today || !generateNewsletter) return row;

  const yesterday = previousEditionDate(today);
  const prev = await loadArtEdition(yesterday);
  if (!prev) return row;

  const fp = row.signal_snapshot?.signal_fingerprint;
  const prevFp = prev.signal_snapshot?.signal_fingerprint;
  if (!fp || fp !== prevFp) return row;

  const prevLayout =
    prev.signal_snapshot?.signal_art?.layoutMode ?? prev.copy?.layout_mode;
  const todayLayout =
    row.signal_snapshot?.signal_art?.layoutMode ?? row.copy?.layout_mode;
  if (prevLayout !== todayLayout) return row;

  if (row.signal_snapshot?.art_daily_refresh === yesterday) return row;

  console.log(
    `[signal-art] Regenerating ${today} — same market fingerprint as ${yesterday} (${todayLayout})`,
  );
  const newsletter = await generateNewsletter({ bust: true });
  const edition = await generatePythhArtEdition(newsletter, { repoRoot, generateRaster: true });
  edition.signal_snapshot = {
    ...edition.signal_snapshot,
    art_daily_refresh: yesterday,
  };
  try {
    await saveArtEdition(edition);
  } catch (e) {
    console.warn('[signal-art] daily refresh save failed:', e.message);
    return row;
  }
  return edition;
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
    .select('edition_date, copy, generated_at, signal_snapshot')
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
  ensureArtEditionRaster,
  refreshStaleTodayEdition,
  previousEditionDate,
  hashSeed,
  deriveArtSeed,
  buildSignalFingerprint,
  planComposition,
  buildImageBrief,
};
