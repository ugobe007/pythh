#!/usr/bin/env node
/**
 * IMPORT PORTFOLIO CSV
 *
 * Manually import VC portfolio companies from CSV into vc_portfolio_exhaust.
 * Matches companies to startup_uploads to get GOD scores for regression.
 *
 * CSV format (columns): investor, company_name, company_website (or company_url / url), round, amount, source_url
 * - investor: name or partial match (e.g. "Sequoia", "a16z")
 * - company_name: required
 * - company_website: optional, improves matching
 * - round: optional (e.g. "Seed", "Series A")
 * - amount: optional (e.g. 5000000)
 * - source_url: optional (portfolio page URL)
 *
 * Usage:
 *   node scripts/import-portfolio-csv.js path/to/portfolio.csv
 *   node scripts/import-portfolio-csv.js portfolio.csv --investor "Sequoia" --source-url "https://..."
 *   node scripts/import-portfolio-csv.js portfolio.csv --dry-run
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const dryRun = process.argv.includes('--dry-run');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const csvPath = args[0];
const overrideInvestor = process.argv.find((a) => a.startsWith('--investor='))?.split('=')[1];
const overrideSourceUrl = process.argv.find((a) => a.startsWith('--source-url='))?.split('=')[1];

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseRow = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if ((c === ',' && !inQuotes) || c === '\t') {
        out.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const header = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i]).map((v) => v.replace(/^"|"$/g, ''));
    const row = {};
    header.forEach((h, j) => {
      row[h] = vals[j] || '';
    });
    rows.push(row);
  }
  return rows;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    return u || null;
  } catch {
    return null;
  }
}

async function findInvestor(investorName) {
  if (!investorName) return null;
  const { data } = await supabase
    .from('investors')
    .select('id, name')
    .or(`name.ilike.%${investorName}%,firm.ilike.%${investorName}%`)
    .limit(5);
  return data && data.length > 0 ? data[0] : null;
}

async function findStartupByNameOrDomain(name, website) {
  if (!name || name.length < 2) return null;

  // 1. Exact name match
  let { data } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, website')
    .ilike('name', name)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();
  if (data) return data;

  // 2. Domain match if we have website
  const domain = extractDomain(website);
  if (domain) {
    const { data: byDomain } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, website')
      .eq('status', 'approved')
      .or(`website.ilike.%${domain}%,normalized_domain.eq.${domain}`)
      .limit(1)
      .maybeSingle();
    if (byDomain) return byDomain;
  }

  // 3. Contains match (name in our DB contains input or vice versa)
  const { data: contains } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, website')
    .eq('status', 'approved')
    .or(`name.ilike.%${name}%,name.ilike.${name}%`)
    .limit(5);
  if (contains && contains.length > 0) {
    const normalized = name.toLowerCase().replace(/\s+/g, '');
    const best = contains.find((c) =>
      c.name.toLowerCase().replace(/\s+/g, '').includes(normalized)
    );
    if (best) return best;
    if (contains[0].name.length - name.length < 5) return contains[0];
  }

  return null;
}

async function main() {
  if (!csvPath) {
    console.error('Usage: node scripts/import-portfolio-csv.js <REAL_PATH_TO.csv> [--investor=X] [--source-url=X] [--dry-run]');
    console.error('CSV columns: investor, company_name, company_website (or company_url), round, amount, source_url');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    console.error('Use the actual path to your CSV (not a placeholder). Example:');
    console.error('  npm run portfolio:import -- ~/Desktop/sequoia-portfolio.csv --investor=Sequoia');
    console.error('Or copy the template: scripts/portfolio-import-template.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  const col = (r, ...keys) => {
    for (const k of keys) {
      const v = r[k] || r[k.replace(/_/g, ' ')] || r[k.replace(/\s/g, '_')];
      if (v) return v;
    }
    return '';
  };

  console.log('\n📥 PORTFOLIO CSV IMPORT');
  console.log('═'.repeat(50));
  console.log(`File: ${csvPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log('');

  let investorId = null;
  let investorName = null;
  if (overrideInvestor) {
    const inv = await findInvestor(overrideInvestor);
    if (inv) {
      investorId = inv.id;
      investorName = inv.name;
      console.log(`Investor (override): ${investorName} (${investorId})`);
    } else {
      console.error(`Investor not found: ${overrideInvestor}`);
      process.exit(1);
    }
  }

  let imported = 0;
  let matched = 0;
  const unmatched = [];

  for (const row of rows) {
    const companyName = col(row, 'company_name', 'company name', 'name');
    if (!companyName) continue;

    const investorStr = overrideInvestor || col(row, 'investor', 'vc', 'fund');
    const companyWebsite = col(row, 'company_website', 'company_url', 'website', 'url');
    const round = col(row, 'round', 'stage');
    const amountStr = col(row, 'amount', 'investment_amount');
    const amount = amountStr ? parseFloat(String(amountStr).replace(/[^0-9.]/g, '')) : null;
    const sourceUrl = overrideSourceUrl || col(row, 'source_url', 'source url');

    if (!investorId && investorStr) {
      const inv = await findInvestor(investorStr);
      if (inv) {
        investorId = inv.id;
        investorName = inv.name;
      }
    }

    if (!investorId) {
      console.warn(`  ⚠️  No investor for "${companyName}" - skipping`);
      continue;
    }

    const startup = await findStartupByNameOrDomain(companyName, companyWebsite);
    if (startup) matched++;

    const record = {
      investor_id: investorId,
      startup_id: startup?.id || null,
      startup_name: companyName,
      startup_website: companyWebsite || null,
      source_type: 'manual',
      source_url: sourceUrl || null,
      round: round || null,
      amount: amount || null,
      raw: { imported_at: new Date().toISOString(), source: 'csv' },
    };

    if (!startup) {
      unmatched.push(companyName);
    }

    if (!dryRun) {
      const { error } = await supabase.from('vc_portfolio_exhaust').insert(record);
      if (error) {
        if (error.code === '23505') {
          // Duplicate - skip
        } else {
          console.error(`  Failed ${companyName}:`, error.message);
        }
      } else {
        imported++;
      }
    } else {
      console.log(`  ${startup ? '✓' : '○'} ${companyName}${startup ? ` → GOD ${startup.total_god_score}` : ' (no match)'}`);
      imported++;
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`Imported: ${imported}`);
  console.log(`Matched to startup_uploads: ${matched} (${rows.length ? ((matched / rows.length) * 100).toFixed(1) : 0}%)`);
  if (unmatched.length > 0 && unmatched.length <= 20) {
    console.log('\nUnmatched (no GOD score yet):');
    unmatched.forEach((n) => console.log(`  - ${n}`));
  } else if (unmatched.length > 20) {
    console.log(`\nUnmatched: ${unmatched.length} companies (first 10: ${unmatched.slice(0, 10).join(', ')})`);
  }
  console.log('\nNext: Run npm run portfolio:regression to analyze GOD vs performance.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
