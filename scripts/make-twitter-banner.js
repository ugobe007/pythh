#!/usr/bin/env node
/**
 * Pythh Twitter Banner Generator
 * ================================
 * Renders a live signal-flow dashboard using real startup data from Supabase.
 * Output: public/pythh-twitter-banner.png (1500×500px)
 */

const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const W   = 1500;
const H   = 500;
const BG  = '#0b0d13';
const CYN = '#4dd9e0';
const OUT = path.join(__dirname, '../public/pythh-twitter-banner.png');

// Layout constants
const NAME_X     = 58;
const BAR_X      = 310;
const BAR_MAX_W  = 1010;
const BAR_H      = 16;
const SCORE_X    = W - 90;
const ROW_START  = 148;
const ROW_GAP    = 52;
const ROWS       = 7;

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function fetchStartups() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data } = await sb
    .from('startup_uploads')
    .select('name, total_god_score, traction_score, sectors')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(ROWS);
  return data || [];
}

async function generate() {
  console.log('🔮 Pythh Twitter Banner — Signal Flow');
  console.log('======================================');

  const startups = await fetchStartups();
  if (!startups.length) { console.error('No startup data'); process.exit(1); }

  // Build rows SVG
  const rows = startups.slice(0, ROWS).map((s, i) => {
    const y      = ROW_START + i * ROW_GAP;
    const barY   = y - BAR_H / 2 + 4;
    const score  = s.total_god_score ?? 0;
    const barW   = Math.round((score / 100) * BAR_MAX_W);
    const sector = Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors ?? '');
    // Alternate row bg for readability
    const rowBg  = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'none';

    return `
  <!-- row ${i}: ${esc(s.name)} -->
  <rect x="${NAME_X - 8}" y="${y - 22}" width="${W - NAME_X * 2 + 16}" height="${ROW_GAP - 2}"
    fill="${rowBg}" rx="2"/>
  <text x="${NAME_X}" y="${y + 4}"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="17" fill="white" opacity="0.88">${esc(s.name)}</text>
  ${sector ? `<text x="${NAME_X + 4}" y="${y + 20}"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="10" fill="${CYN}" opacity="0.45" letter-spacing="1">${esc(sector.toUpperCase())}</text>` : ''}
  <!-- bar track -->
  <rect x="${BAR_X}" y="${barY}" width="${BAR_MAX_W}" height="${BAR_H}"
    fill="white" fill-opacity="0.05" rx="${BAR_H / 2}"/>
  <!-- bar fill -->
  <rect x="${BAR_X}" y="${barY}" width="${barW}" height="${BAR_H}"
    fill="${CYN}" fill-opacity="0.82" rx="${BAR_H / 2}"/>
  <!-- score -->
  <text x="${SCORE_X}" y="${y + 5}"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="17" fill="white" opacity="0.9" text-anchor="end"
    font-weight="600">${score}</text>`;
  }).join('\n');

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#090b11"/>
      <stop offset="100%" stop-color="#0e1219"/>
    </linearGradient>
    <!-- Left edge glow -->
    <radialGradient id="lglow" cx="0%" cy="50%" r="40%">
      <stop offset="0%"   stop-color="${CYN}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${CYN}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#lglow)"/>

  <!-- Header: SIGNAL FLOW -->
  <text x="${NAME_X}" y="56"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="11" letter-spacing="4" fill="${CYN}" opacity="0.6">SIGNAL FLOW</text>

  <!-- Live dot + label -->
  <circle cx="${NAME_X + 112}" cy="51" r="4" fill="${CYN}" opacity="0.9"/>
  <text x="${NAME_X + 124}" y="56"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="11" letter-spacing="2" fill="${CYN}" opacity="0.9">LIVE</text>

  <!-- pythh.ai top-right -->
  <text x="${W - 56}" y="56"
    font-family="Georgia,'Times New Roman',serif"
    font-size="22" fill="white" opacity="0.7" text-anchor="end">pythh.ai</text>

  <!-- Header divider -->
  <line x1="${NAME_X}" y1="72" x2="${W - NAME_X}" y2="72"
    stroke="${CYN}" stroke-width="0.5" stroke-opacity="0.2"/>

  <!-- Column headers -->
  <text x="${BAR_X}" y="97"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="10" letter-spacing="3" fill="white" opacity="0.25">SIGNAL STRENGTH</text>
  <text x="${SCORE_X}" y="97"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="10" letter-spacing="3" fill="white" opacity="0.25" text-anchor="end">SCORE</text>

  ${rows}

  <!-- Bottom rule -->
  <line x1="${NAME_X}" y1="${H - 22}" x2="${W - NAME_X}" y2="${H - 22}"
    stroke="${CYN}" stroke-width="1" stroke-opacity="0.2"/>

  <!-- Footer note -->
  <text x="${NAME_X}" y="${H - 8}"
    font-family="ui-monospace,'SF Mono',Menlo,monospace"
    font-size="10" letter-spacing="2" fill="white" opacity="0.2">PYTHH SIGNAL ENGINE  ·  LIVE RANKINGS</text>
</svg>`;

  const buf  = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
  fs.writeFileSync(OUT, buf);
  const kb = (buf.length / 1024).toFixed(0);
  console.log(`\n✅  ${OUT}`);
  console.log(`💾  ${kb} KB`);
  console.log(`\nShowing ${startups.length} startups:`);
  startups.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} — ${s.total_god_score}`));
}

generate().catch(err => { console.error('❌', err.message); process.exit(1); });

