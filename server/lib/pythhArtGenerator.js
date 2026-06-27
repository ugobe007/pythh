'use strict';

/**
 * Pythh Signal Art — deterministic generative SVG from daily market signals.
 * Hybrid MVP: algorithmic composition + template PYTHIA copy (LLM optional later).
 */

const { getSupabaseClient } = require('./supabaseClient');

const PALETTE = {
  bg: '#0a0a0c',
  bg2: '#12121a',
  emerald: '#34d399',
  emeraldDim: 'rgba(52,211,153,0.35)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.3)',
  slate: '#64748b',
  slateDim: 'rgba(100,116,139,0.25)',
  white: 'rgba(255,255,255,0.08)',
  stroke: 'rgba(255,255,255,0.12)',
};

const SECTOR_HUE = {
  fintech: PALETTE.amber,
  ai: PALETTE.emerald,
  'artificial intelligence': PALETTE.emerald,
  saas: '#38bdf8',
  healthcare: '#a78bfa',
  climate: '#4ade80',
  crypto: '#f472b6',
  default: PALETTE.emerald,
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

function pickSectorColor(sectors) {
  const list = Array.isArray(sectors) ? sectors : [];
  const key = (list[0] || '').toLowerCase();
  for (const [k, c] of Object.entries(SECTOR_HUE)) {
    if (key.includes(k)) return c;
  }
  return SECTOR_HUE.default;
}

function godVariance(startups) {
  const scores = (startups || []).map((s) => s.total_god_score).filter((n) => n != null);
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
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

function buildLegend(params) {
  return [
    { key: 'hue', label: 'Dominant sector heat', value: params.accentLabel },
    { key: 'rings', label: 'Leading signal strength', value: `${params.leadingPct}% → ${params.ringCount} rings` },
    { key: 'grid', label: 'Startups scored', value: String(params.coverage) },
    { key: 'lines', label: 'Funding moves (7d)', value: String(params.fundingCount) },
    { key: 'nodes', label: 'Composition chaos', value: params.chaosLabel },
  ];
}

function buildCopy(snapshot, params) {
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const funding = snapshot.funding_count;
  const match = snapshot.top_match;

  const process = [
    `Edition ${snapshot.edition_date} — seeded deterministically from live platform signals.`,
    leading
      ? `Dominant dimension: ${leading.label} (${leading.pct}% of cap). ${leading.blurb}`
      : 'Signals recalibrating across the board.',
    `${params.coverage} startups in the composition window; ${funding} funding move${funding === 1 ? '' : 's'} encoded as diagonal tension lines.`,
    top
      ? `Focal gravity: ${top.name} (GOD ${top.total_god_score})${top.why ? ` — ${top.why.slice(0, 120)}` : ''}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const philosophy = [
    'PYTHIA does not illustrate the market — it compresses it.',
    'Each ring is conviction density; each fracture is disagreement among scored names.',
    'The geometry precedes the narrative. Founders feel this shape before they can name the round.',
    match?.startup?.name && match?.investor?.name
      ? `Today's sharpest tension: ${match.startup.name} ↔ ${match.investor.firm_name || match.investor.name} (${match.match_score}% fit) — a pairing the grid keeps returning to.`
      : 'When capital converges, the form tightens. When it disperses, the grid splinters.',
  ].join(' ');

  const introspection =
    snapshot.editorial ||
    (leading
      ? `The market is leaning hard into ${leading.label.toLowerCase()}. Most founders are still pitching the old story.`
      : 'Quiet day on the signal layer — the composition is holding its breath.');

  return {
    title: `Signal Composition № ${snapshot.edition_date.replace(/-/g, '.')}`,
    subtitle: leading?.label || 'Daily market geometry',
    process,
    philosophy,
    introspection,
    legend: params.legend,
    featured_startup: top?.name || null,
    featured_match: match
      ? `${match.startup?.name || 'Startup'} × ${match.investor?.firm_name || match.investor?.name || 'Investor'}`
      : null,
  };
}

function generateSvg(snapshot, seed) {
  const rand = mulberry32(seed);
  const W = 800;
  const H = 800;
  const cx = W / 2;
  const cy = H / 2;

  const leading = snapshot.leading_signal;
  const leadingPct = leading?.pct ?? 40;
  const coverage = snapshot.coverage || 50;
  const fundingCount = snapshot.funding_count || 0;
  const variance = godVariance(snapshot.hottest);
  const chaos = Math.min(1, variance / 25);

  const accent = pickSectorColor(
    snapshot.top_sectors?.[0] ? [snapshot.top_sectors[0]] : snapshot.exemplars[0]?.sectors,
  );
  const accentLabel = snapshot.top_sectors?.[0] || snapshot.exemplars[0]?.sectors?.[0] || 'mixed';

  const ringCount = Math.max(3, Math.min(9, Math.round(leadingPct / 12)));
  const gridStep = Math.max(32, Math.min(80, Math.round(120 - coverage / 8)));
  const nodeCount = Math.max(5, Math.min(14, Math.round(6 + chaos * 8)));
  const lineCount = Math.min(24, fundingCount * 2 + 4);

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="Pythh signal composition">`,
  );
  parts.push('<defs>');
  parts.push(
    `<radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="${PALETTE.bg2}"/><stop offset="100%" stop-color="${PALETTE.bg}"/></radialGradient>`,
  );
  parts.push(
    `<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
  );
  parts.push('</defs>');

  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // Grid
  for (let x = 0; x <= W; x += gridStep) {
    const op = 0.04 + (x / W) * 0.06;
    parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${PALETTE.white}" stroke-opacity="${op.toFixed(3)}" stroke-width="1"/>`);
  }
  for (let y = 0; y <= H; y += gridStep) {
    const op = 0.04 + (y / H) * 0.06;
    parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${PALETTE.white}" stroke-opacity="${op.toFixed(3)}" stroke-width="1"/>`);
  }

  // Concentric rings
  for (let i = ringCount; i >= 1; i--) {
    const r = 40 + i * (28 + leadingPct * 0.35);
    const dash = chaos > 0.5 ? '6 10' : 'none';
    const rot = (rand() - 0.5) * 12;
    const stroke = i === ringCount ? accent : PALETTE.stroke;
    const op = 0.15 + (i / ringCount) * 0.45;
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${stroke}" stroke-opacity="${op.toFixed(2)}" stroke-width="${i === ringCount ? 2 : 1}" stroke-dasharray="${dash}" transform="rotate(${rot.toFixed(1)} ${cx} ${cy})"/>`,
    );
  }

  // Node cluster
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2 + rand() * 0.8;
    const dist = 80 + rand() * (160 + chaos * 120);
    const nx = cx + Math.cos(angle) * dist;
    const ny = cy + Math.sin(angle) * dist * (0.85 + rand() * 0.3);
    const nr = 4 + rand() * (10 + leadingPct * 0.08);
    nodes.push({ x: nx, y: ny, r: nr });
    const fill = i % 3 === 0 ? accent : i % 3 === 1 ? PALETTE.amberDim : PALETTE.slateDim;
    parts.push(`<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${nr.toFixed(1)}" fill="${fill}"/>`);
  }

  // Connect nodes (network)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rand() > 0.62 - chaos * 0.15) continue;
      parts.push(
        `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="${PALETTE.emeraldDim}" stroke-width="1"/>`,
      );
    }
  }

  // Funding tension lines
  for (let i = 0; i < lineCount; i++) {
    const x1 = rand() * W;
    const y1 = rand() * H;
    const x2 = x1 + (rand() - 0.5) * 200;
    const y2 = y1 + (rand() - 0.5) * 200;
    parts.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${PALETTE.amberDim}" stroke-width="1" stroke-opacity="0.5"/>`,
    );
  }

  // Central polygon (focal)
  const sides = 3 + Math.floor(rand() * 5);
  const polyR = 48 + leadingPct * 0.6;
  const polyPoints = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2 + rand() * 0.2;
    polyPoints.push(`${(cx + Math.cos(a) * polyR).toFixed(1)},${(cy + Math.sin(a) * polyR).toFixed(1)}`);
  }
  parts.push(
    `<polygon points="${polyPoints.join(' ')}" fill="none" stroke="${accent}" stroke-width="2" filter="url(#glow)" opacity="0.9"/>`,
  );

  // Arc accents
  for (let i = 0; i < 3; i++) {
    const r = 200 + i * 45 + rand() * 30;
    const start = rand() * 180;
    const sweep = 40 + rand() * 80;
    parts.push(
      `<path d="M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos((start + sweep) * (Math.PI / 180))} ${cy + r * Math.sin((start + sweep) * (Math.PI / 180))}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5"/>`,
    );
  }

  parts.push('</svg>');

  const legend = buildLegend({
    accentLabel,
    leadingPct,
    ringCount,
    coverage,
    fundingCount,
    chaosLabel: chaos > 0.55 ? 'fractured' : chaos > 0.25 ? 'balanced' : 'coherent',
  });

  return {
    svg: parts.join('\n'),
    params: { ringCount, gridStep, nodeCount, lineCount, leadingPct, coverage, fundingCount, chaos, accentLabel, legend },
  };
}

function generatePythhArtEdition(newsletter) {
  const snapshot = extractSnapshot(newsletter);
  const seed = hashSeed(`pythh-art-${snapshot.edition_date}`);
  const { svg, params } = generateSvg(snapshot, seed);
  const copy = buildCopy(snapshot, params);

  return {
    edition_date: snapshot.edition_date,
    seed,
    svg,
    signal_snapshot: snapshot,
    copy,
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
};
