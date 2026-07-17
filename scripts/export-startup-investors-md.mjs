#!/usr/bin/env node
/**
 * Export full ranked investor list + emails for a startup (DB + PYTHIA inference).
 *
 * Usage:
 *   node scripts/export-startup-investors-md.mjs --startup-id=<uuid>
 *   node scripts/export-startup-investors-md.mjs --url=https://stagegate.space
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FIRM_DOMAIN_MAP = {
  'Sequoia Capital': 'sequoiacap.com',
  'Andreessen Horowitz': 'a16z.com',
  a16z: 'a16z.com',
  'General Catalyst': 'generalcatalyst.com',
  Accel: 'accel.com',
  Benchmark: 'benchmark.com',
  Greylock: 'greylock.com',
  'Index Ventures': 'indexventures.com',
  'Lightspeed Venture Partners': 'lsvp.com',
  Lightspeed: 'lsvp.com',
  NEA: 'nea.com',
  GV: 'gv.com',
  'Google Ventures': 'gv.com',
  'Bessemer Venture Partners': 'bvp.com',
  Bessemer: 'bvp.com',
  'First Round Capital': 'firstround.com',
  'First Round': 'firstround.com',
  'Founders Fund': 'foundersfund.com',
  'Tiger Global': 'tigerglobal.com',
  SoftBank: 'softbank.com',
  'SoftBank Group': 'softbank.com',
  Eclipse: 'eclipse.vc',
  'Playground Global': 'playground.global',
  'Pear VC': 'pear.vc',
  Pear: 'pear.vc',
  'Lowercarbon Capital': 'lowercarbon.com',
  'Mayfield Fund': 'mayfield.com',
  Mayfield: 'mayfield.com',
  'B Capital': 'bcapgroup.com',
  Neo: 'neo.com',
  'Google Ventures': 'gv.com',
  'Brick & Mortar Ventures': 'brickandmortarventures.com',
  'TDK Ventures': 'tdk-ventures.com',
  'Innovation Endeavors': 'innovationendeavors.com',
  'Vsquared Ventures': 'vsquared.vc',
  DCVC: 'dcvc.com',
};

function parseArgs(argv) {
  const out = { startupId: null, url: null, output: null };
  for (const arg of argv) {
    if (arg.startsWith('--startup-id=')) out.startupId = arg.slice('--startup-id='.length);
    if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    if (arg.startsWith('--output=')) out.output = arg.slice('--output='.length);
  }
  return out;
}

function inferFirmDomain(firmName) {
  if (!firmName) return 'example.com';
  if (FIRM_DOMAIN_MAP[firmName]) return FIRM_DOMAIN_MAP[firmName];
  const slug = firmName
    .toLowerCase()
    .replace(/\b(capital|ventures?|partners?|management|fund|group|inc\.?|llc\.?|&)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return `${slug || 'fund'}.com`;
}

function parseName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'contact', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function domainFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

function isLikelyPersonName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}

function isLikelyFundName(name) {
  return /\b(ventures?|capital|partners?|fund|vc|global|holdings|group)\b/i.test(String(name || ''));
}

function inferInvestorEmails(fullName, firmName, urlDomain) {
  const firm = firmName || fullName || 'Fund';
  const { firstName, lastName } = parseName(fullName);
  const domain = urlDomain || inferFirmDomain(firm);
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, '') || 'contact';
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const fi = fn.charAt(0);

  const personal = [
    `${fn}@${domain}`,
    ln ? `${fn}.${ln}@${domain}` : null,
    ln ? `${fi}.${ln}@${domain}` : null,
  ].filter(Boolean);

  const pitch = [`pitches@${domain}`, `deals@${domain}`, `dealflow@${domain}`];
  const generic = [`info@${domain}`, `hello@${domain}`];

  const isFundEntity =
    !isLikelyPersonName(fullName) ||
    (fullName === firmName && isLikelyFundName(fullName) && !urlDomain);

  const primary = isFundEntity ? pitch[0] : personal[0];
  const alternates = isFundEntity
    ? [...pitch.slice(1), ...generic]
    : [...personal.slice(1), ...pitch.slice(0, 2)];

  return { domain, primary, alternates, isFundEntity };
}

function resolveEmail(inv) {
  if (inv.email?.includes('@')) {
    return { address: inv.email, source: 'verified', status: inv.email_status || 'verified' };
  }
  if (inv.email_best_guess?.includes('@')) {
    return { address: inv.email_best_guess, source: 'db_inferred', status: inv.email_status || 'inferred' };
  }
  const urlDomain = domainFromUrl(inv.url);
  const inferred = inferInvestorEmails(inv.name, inv.firm || inv.name, urlDomain);
  return { address: inferred.primary, source: urlDomain ? 'pythia_url_domain' : 'pythia_inferred', status: 'pattern', ...inferred };
}

function whyTags(raw, reasoning) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    if (raw.includes(' · ')) return raw.split(' · ').map((s) => s.trim()).filter(Boolean);
    return [raw.trim()];
  }
  if (reasoning?.trim()) return [reasoning.trim()];
  return [];
}

function stageLabel(stage) {
  const list = Array.isArray(stage)
    ? stage
    : stage != null && String(stage).trim()
      ? [String(stage)]
      : [];
  return list.map((s) => s.replace(/_/g, ' ')).join(', ') || '—';
}

async function resolveStartupId(supabase, { startupId, url }) {
  if (startupId) return startupId;
  if (!url) throw new Error('Provide --startup-id or --url');
  const normalized = url.replace(/\/$/, '');
  const { data } = await supabase
    .from('startup_uploads')
    .select('id')
    .or(`website.eq.${normalized},website.eq.${normalized}/`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) throw new Error(`No startup found for ${url}`);
  return data.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const startupId = await resolveStartupId(supabase, args);

  const { data: startup, error: startupErr } = await supabase
    .from('startup_uploads')
    .select('id, name, website, sectors, stage, total_god_score')
    .eq('id', startupId)
    .maybeSingle();
  if (startupErr || !startup) throw new Error(startupErr?.message || 'startup not found');

  const { data: matches, error: matchErr } = await supabase
    .from('startup_investor_matches')
    .select(`
      match_score, reasoning, why_you_match,
      investors:investor_id (
        id, name, firm, sectors, stage, type, investor_tier,
        email, email_best_guess, email_status, email_has_mx,
        investment_thesis, linkedin_url, url
      )
    `)
    .eq('startup_id', startupId)
    .order('match_score', { ascending: false });
  if (matchErr) throw new Error(matchErr.message);

  const rows = (matches || []).filter((m) => m.investors);
  const startupUrl = startup.website || args.url || '';
  const slug = (startup.name || 'startup').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const outPath =
    args.output ||
    path.join(ROOT, 'docs', `${slug}-investors.md`);

  let verified = 0;
  let dbInferred = 0;
  let urlDomain = 0;
  let pattern = 0;

  const lines = [
    `# ${startup.name || 'Startup'} — Investor Match Report`,
    '',
    `**Startup:** ${startup.name}`,
    `**Website:** ${startupUrl}`,
    `**Sectors:** ${Array.isArray(startup.sectors) ? startup.sectors.join(', ') : '—'}`,
    `**GOD score:** ${startup.total_god_score != null ? `${Math.round(startup.total_god_score)} / 100` : '—'}`,
    `**Total ranked investors:** ${rows.length}`,
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '---',
    '',
    'Emails: **verified** from database · **inferred** from enrichment · **pattern** from PYTHIA name+firm rules (verify before sending).',
    '',
    '## Summary',
    '',
    '| Rank | Investor | Firm | Match | Primary email | Source |',
    '| ---: | --- | --- | ---: | --- | --- |',
  ];

  rows.forEach((m, i) => {
    const inv = m.investors;
    const email = resolveEmail(inv);
    if (email.source === 'verified') verified++;
    else if (email.source === 'db_inferred') dbInferred++;
    else if (email.source === 'pythia_url_domain') urlDomain++;
    else pattern++;

    const score = Math.round(Number(m.match_score) || 0);
    lines.push(
      `| ${i + 1} | ${inv.name || '—'} | ${inv.firm || '—'} | ${score}% | ${email.address} | ${email.source} |`,
    );
  });

  lines.push(
    '',
    `**Email coverage:** ${verified} verified · ${dbInferred} DB inferred · ${urlDomain} from firm URL · ${pattern} name pattern`,
    '',
    '---',
    '',
  );

  rows.forEach((m, i) => {
    const inv = m.investors;
    const email = resolveEmail(inv);
    const tags = whyTags(m.why_you_match, m.reasoning);
    const score = Math.round(Number(m.match_score) || 0);
    const sectors = Array.isArray(inv.sectors) ? inv.sectors.join(', ') : inv.sectors || '—';

    lines.push(`## #${i + 1} — ${inv.name || 'Unknown'}`);
    lines.push('');
    lines.push('| Field | Detail |');
    lines.push('| --- | --- |');
    lines.push(`| Firm | ${inv.firm || '—'} |`);
    lines.push(`| Match score | ${score}% |`);
    lines.push(`| Stage focus | ${stageLabel(inv.stage)} |`);
    lines.push(`| Sectors | ${sectors} |`);
    if (inv.investor_tier) lines.push(`| Investor tier | ${inv.investor_tier} |`);
    lines.push(`| Primary email | ${email.address} |`);
    lines.push(`| Email source | ${email.source} |`);
    if (inv.linkedin_url) lines.push(`| LinkedIn | ${inv.linkedin_url} |`);
    if (inv.url) lines.push(`| Website | ${inv.url} |`);
    lines.push('');

    if (email.alternates?.length) {
      lines.push('### Alternate email targets');
      email.alternates.slice(0, 4).forEach((a) => lines.push(`- ${a}`));
      lines.push(`- Domain: \`${email.domain}\``);
      lines.push('');
    }

    if (tags.length) {
      lines.push('### Match signals');
      tags.forEach((t) => lines.push(`- ${t}`));
      lines.push('');
    }

    if (m.reasoning) {
      lines.push('### PYTHIA reasoning');
      lines.push(m.reasoning);
      lines.push('');
    }

    if (inv.investment_thesis) {
      lines.push('### Investment thesis');
      lines.push(String(inv.investment_thesis).slice(0, 500));
      lines.push('');
    }

    lines.push('---', '');
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${rows.length} investors → ${outPath}`);
  console.log(`Emails: ${verified} verified, ${dbInferred} db inferred, ${urlDomain} url domain, ${pattern} pattern`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
