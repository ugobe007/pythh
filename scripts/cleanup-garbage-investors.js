#!/usr/bin/env node
/**
 * INVESTOR DATA CLEANUP
 * =====================
 * Identifies and removes garbage investor records that were accidentally
 * created from scraped article headline fragments.
 * 
 * Detection heuristics:
 *   1. Name too short (< 3 chars) or too long (> 80 chars / sentence-like)
 *   2. Name looks like an article fragment (contains verbs, articles at start)
 *   3. Name contains common scraper noise patterns
 *   4. No useful data (empty sectors, no score, empty bio)
 *   5. Has zero matches AND zero useful fields
 * 
 * Usage:
 *   node scripts/cleanup-garbage-investors.js                    # Preview delete (default)
 *   node scripts/cleanup-garbage-investors.js --execute          # Delete garbage rows
 *   node scripts/cleanup-garbage-investors.js --quarantine-suspicious
 *       # Preview quarantine (status=inactive, entity_gate=junk, clear matches)
 *   node scripts/cleanup-garbage-investors.js --quarantine-suspicious --execute
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbageInvestorName } = require('../lib/investorNameHeuristics');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const argv = process.argv.slice(2);
const isExecute = argv.includes('--execute');
const quarantineSuspicious = argv.includes('--quarantine-suspicious');
const isDryRun = !isExecute;

function isGarbageName(name) {
  return isGarbageInvestorName(name);
}

/** Avoid quarantining real firm rows mis-flagged by digit-prefix heuristics (e.g. 3G Capital). */
function shouldQuarantineSuspicious(investor) {
  if (investor.status === 'inactive' && investor.entity_gate === 'junk') return false;

  const name = String(investor.name || '').trim();
  const firm = String(investor.firm || '').trim();
  const hasSectors = Array.isArray(investor.sectors) && investor.sectors.length > 0;
  const score = Number(investor.investor_score) || 0;
  const core = name.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();
  const firmLike =
    /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Management|Holdings?|Advisors?)\s*$/i.test(core) ||
    /\s(LP|LLC|Inc\.?|Co\.?|Corp\.?|Ltd\.?)\s*$/i.test(core);

  if (name && firm && name.toLowerCase() === firm.toLowerCase() && firmLike && hasSectors && score >= 20) {
    return false;
  }

  // Solo-brand firms mis-flagged (OpenView, etc.) — short name, no scraper tokens
  if (name && firm && name.toLowerCase() === firm.toLowerCase() && hasSectors && score >= 30) {
    const words = name.split(/\s+/);
    if (
      words.length <= 3 &&
      !name.includes('(') &&
      !/\b(for|who|were|invested|investing|playbook|assistant|partner|raises|build)\b/i.test(name)
    ) {
      return false;
    }
  }

  return true;
}

function isDataPoor(investor) {
  const hasSectors = Array.isArray(investor.sectors) && investor.sectors.length > 0;
  const hasStage = Array.isArray(investor.stage) && investor.stage.length > 0;
  const hasBio = investor.bio && investor.bio.length > 10;
  const hasThesis = investor.investment_thesis && investor.investment_thesis.length > 10;
  const hasFirm = investor.firm && investor.firm.length > 2 && investor.firm !== investor.name;
  const hasLinkedin = investor.linkedin_url && investor.linkedin_url.length > 5;
  const hasEmail = investor.email && investor.email.length > 5;

  const usefulFields = [hasSectors, hasStage, hasBio, hasThesis, hasFirm, hasLinkedin, hasEmail].filter(Boolean).length;
  return usefulFields <= 1;
}

function modeLabel() {
  if (quarantineSuspicious) {
    return isDryRun ? '🔍 DRY RUN — quarantine preview' : '⚡ EXECUTE — quarantine suspicious';
  }
  return isDryRun ? '🔍 DRY RUN (preview only)' : '⚡ EXECUTE (will delete!)';
}

/** Paginated delete — avoids Supabase statement timeout on large .in(investor_id) batches. */
async function deleteMatchesForInvestor(investorId) {
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .select('id')
      .eq('investor_id', investorId)
      .limit(200);
    if (error) throw new Error(`Match fetch error: ${error.message}`);
    if (!data?.length) break;

    const ids = data.map((row) => row.id);
    if (!isDryRun) {
      const { error: delErr } = await supabase
        .from('startup_investor_matches')
        .delete()
        .in('id', ids);
      if (delErr) throw new Error(`Match delete error: ${delErr.message}`);
    }
    deleted += ids.length;
    if (ids.length < 200) break;
  }
  return deleted;
}

async function countMatchesForInvestorsBatch(investorIds) {
  let total = 0;
  for (let i = 0; i < investorIds.length; i += 25) {
    const batch = investorIds.slice(i, i + 25);
    const { count, error } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .in('investor_id', batch);
    if (error) throw new Error(`Match count error: ${error.message}`);
    total += count || 0;
  }
  return total;
}

async function deleteMatchesForInvestors(investors) {
  if (!investors.length) return 0;
  if (isDryRun) {
    return countMatchesForInvestorsBatch(investors.map((inv) => inv.id));
  }

  let total = 0;
  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    total += await deleteMatchesForInvestor(inv.id);
    if ((i + 1) % 25 === 0 || i === investors.length - 1) {
      console.log(
        `  … matches ${i + 1}/${investors.length} investors · ${total.toLocaleString()} rows cleared`
      );
    }
  }
  return total;
}

async function quarantineInvestors(investors) {
  if (!investors.length) return 0;
  const now = new Date().toISOString();
  let quarantined = 0;

  for (let i = 0; i < investors.length; i += 100) {
    const batch = investors.slice(i, i + 100);
    const ids = batch.map((inv) => inv.id);

    if (isDryRun) {
      quarantined += batch.length;
      continue;
    }

    const { error } = await supabase
      .from('investors')
      .update({
        status: 'inactive',
        entity_gate: 'junk',
        entity_gate_reason: 'garbage_name_scraper',
        entity_gate_at: now,
        updated_at: now,
      })
      .in('id', ids);

    if (error) throw new Error(`Quarantine update error: ${error.message}`);
    quarantined += batch.length;
  }

  return quarantined;
}

async function main() {
  console.log('\n🧹 INVESTOR DATA CLEANUP');
  console.log('═'.repeat(50));
  console.log(`   Mode: ${modeLabel()}`);
  console.log();

  // Fetch all investors with basic info
  let allInvestors = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, firm, bio, investment_thesis, sectors, stage, investor_score, investor_tier, linkedin_url, email, status, entity_gate')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    allInvestors = allInvestors.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📊 Total investors: ${allInvestors.length}`);

  // Identify garbage records
  const garbage = [];
  const suspicious = [];

  for (const investor of allInvestors) {
    const nameIsGarbage = isGarbageName(investor.name);
    const dataPoor = isDataPoor(investor);

    if (nameIsGarbage && dataPoor) {
      garbage.push(investor);
    } else if (nameIsGarbage) {
      suspicious.push(investor);
    }
  }

  console.log(`🗑️  Garbage (bad name + no data): ${garbage.length}`);
  console.log(`⚠️  Suspicious (bad name but has data): ${suspicious.length}\n`);

  // Show sample garbage records
  if (garbage.length > 0) {
    console.log('--- Sample GARBAGE records (will DELETE) ---');
    for (const inv of garbage.slice(0, 20)) {
      const sectors = Array.isArray(inv.sectors) ? inv.sectors.join(',') : '[]';
      console.log(`  "${inv.name}" | sectors: ${sectors} | score: ${inv.investor_score}`);
    }
    if (garbage.length > 20) console.log(`  ... and ${garbage.length - 20} more\n`);
  }

  const alreadyQuarantined = suspicious.filter(
    (inv) => inv.status === 'inactive' && inv.entity_gate === 'junk'
  );
  const toQuarantine = suspicious.filter(
    (inv) => shouldQuarantineSuspicious(inv) && !(inv.status === 'inactive' && inv.entity_gate === 'junk')
  );
  const quarantineSkipped = suspicious.filter((inv) => !shouldQuarantineSuspicious(inv));
  const matchCleanupTargets = [
    ...toQuarantine,
    ...alreadyQuarantined.filter((inv) => isGarbageName(inv.name)),
  ].filter((inv, idx, arr) => arr.findIndex((x) => x.id === inv.id) === idx);

  if (suspicious.length > 0) {
    const suspiciousHeading = quarantineSuspicious
      ? '--- Sample SUSPICIOUS records (will QUARANTINE) ---'
      : '--- Sample SUSPICIOUS records (will KEEP but flag) ---';
    console.log(`\n${suspiciousHeading}`);
    for (const inv of toQuarantine.slice(0, 10)) {
      const sectors = Array.isArray(inv.sectors) ? inv.sectors.join(',') : '[]';
      console.log(`  "${inv.name}" | sectors: ${sectors} | firm: ${inv.firm || 'none'}`);
    }
    if (toQuarantine.length > 10) console.log(`  ... and ${toQuarantine.length - 10} more`);
    if (alreadyQuarantined.length > 0) {
      console.log(`  (${alreadyQuarantined.length} already quarantined — skipped)`);
    }
    if (quarantineSkipped.length > 0) {
      console.log(`  (${quarantineSkipped.length} likely real firms — skipped)`);
    }
    console.log();
  }

  if (quarantineSuspicious) {
    if (isDryRun) {
      console.log('\n🔍 DRY RUN complete. Run with --quarantine-suspicious --execute to apply.');
      console.log(`   Would quarantine: ${toQuarantine.length} records`);
      const matchRows = await deleteMatchesForInvestors(matchCleanupTargets);
      console.log(`   Would clear ${matchRows.toLocaleString()} associated match row(s)`);
      return;
    }

    if (toQuarantine.length === 0 && matchCleanupTargets.length === 0) {
      console.log('\n✅ No suspicious records left to quarantine.');
      return;
    }

    if (toQuarantine.length > 0) {
      console.log(`\n⚡ Quarantining ${toQuarantine.length} suspicious investors...`);
      const quarantined = await quarantineInvestors(toQuarantine);
      console.log(`  ✅ Quarantined ${quarantined} investor records (inactive + entity_gate=junk)`);
    } else {
      console.log(`\n⚡ All ${alreadyQuarantined.length} suspicious investors already quarantined — clearing stale matches…`);
    }

    console.log(`  Clearing matches for ${matchCleanupTargets.length} junk investor(s) (per-investor — may take 10–30 min)…`);
    const matchRows = await deleteMatchesForInvestors(matchCleanupTargets);
    console.log(`  ✅ Cleared ${matchRows.toLocaleString()} associated match row(s)`);
    console.log('\n✅ Quarantine complete!');
    return;
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN complete. Run with --execute to delete garbage records.');
    console.log(`   Would delete: ${garbage.length} records`);
    console.log(`   Would keep: ${allInvestors.length - garbage.length} records`);
    if (suspicious.length > 0) {
      console.log(`   Suspicious (not deleted): ${suspicious.length} — use --quarantine-suspicious to hide`);
    }
    return;
  }

  if (garbage.length > 0) {
    console.log(`\n⚡ Deleting ${garbage.length} garbage investors...`);
    
    const garbageIds = garbage.map((g) => g.id);

    console.log('  Clearing associated matches (per-investor)…');
    await deleteMatchesForInvestors(garbage);
    console.log('  ✅ Cleared associated matches');
    
    // Then delete investors
    let deleted = 0;
    for (let i = 0; i < garbageIds.length; i += 100) {
      const batch = garbageIds.slice(i, i + 100);
      
      const { error: delErr } = await supabase
        .from('investors')
        .delete()
        .in('id', batch);
      
      if (delErr) {
        console.error(`  Delete error: ${delErr.message}`);
      } else {
        deleted += batch.length;
      }
    }
    
    console.log(`  ✅ Deleted ${deleted} garbage investor records`);
  }

  console.log('\n✅ Cleanup complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
