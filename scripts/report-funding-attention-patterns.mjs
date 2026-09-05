#!/usr/bin/env node
/**
 * Run funding-attention pattern logic over verified ledger rows.
 *
 * Answers: why the raise happened, whether later firms follow a well-known
 * lead, and when a partner/founder is writing a personal angel check.
 *
 * Dry-run by default. --apply merges pattern notes into investors.signals
 * (observed_thesis.patterns only — never investment_thesis).
 *
 *   npm run funding:attention:patterns
 *   npm run funding:attention:patterns -- --apply --limit=400
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import {
  buildPatternReport,
  classifyCheckVehicle,
  detectFollowTheLead,
  patternNotesForInvestor,
} from '../lib/fundingAttentionPatterns.mjs';

const apply = process.argv.includes('--apply');
const jsonOut = process.argv.includes('--json');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 400), 1), 5000);
const reportPath = reportArg?.slice('--report='.length)
  || `reports/funding-attention-patterns-${new Date().toISOString().slice(0, 10)}.json`;

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

async function pageIn(table, columns, ids, idCol = 'id') {
  const out = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    if (!chunk.length) break;
    const { data, error } = await db.from(table).select(columns).in(idCol, chunk);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

async function main() {
  const { data: events, error } = await db
    .from('funding_evidence_events')
    .select('id,startup_id,startup_name_raw,verification_status,announced_at,occurred_at,created_at,round_type,metadata')
    .in('verification_status', ['verified', 'corroborated'])
    .not('metadata->funding_attention_extracted_at', 'is', null)
    .order('announced_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const eventIds = (events || []).map((row) => row.id);
  const participants = await pageIn(
    'funding_evidence_participants',
    'funding_event_id,investor_id,investor_name_raw,resolution_status,participant_role',
    eventIds,
    'funding_event_id',
  );
  const resolved = participants.filter((row) => row.resolution_status === 'resolved' && row.investor_id);
  const investorIds = [...new Set(resolved.map((row) => row.investor_id))];
  const investorRows = await pageIn(
    'investors',
    'id,name,firm,type,investor_type,capital_type,is_individual,title,stage,check_size_min,check_size_max,bio,investment_thesis,signals',
    investorIds,
  );
  const investorsById = new Map(investorRows.map((row) => [row.id, row]));
  const byEvent = new Map();
  for (const row of resolved) {
    const list = byEvent.get(row.funding_event_id) || [];
    list.push(row);
    byEvent.set(row.funding_event_id, list);
  }

  const shaped = (events || []).map((event) => ({
    ...event,
    aspects: event.metadata?.funding_attention_aspects || [],
    cited: event.metadata?.funding_attention_cited,
    participants: byEvent.get(event.id) || [],
  }));

  const report = buildPatternReport({ events: shaped, investorsById });
  report.mode = apply ? 'apply' : 'dry-run';
  report.notes = [
    'investment_thesis is never written',
    'startup GOD weights are unchanged',
    'follow-the-lead requires a later verified event after a well-known firm',
  ];

  if (apply) {
    const followByInvestor = new Map();
    const sidecarByInvestor = new Map();
    const triggerByInvestor = new Map();

    const byStartup = new Map();
    for (const event of shaped) {
      const roster = (event.participants || []).map((row) => {
        const profile = investorsById.get(row.investor_id) || {};
        return { ...profile, id: row.investor_id, name: profile.name || row.investor_name_raw };
      });
      const startupKey = event.startup_id
        || (String(event.startup_name_raw || '').trim() ? `name:${String(event.startup_name_raw).toLowerCase()}` : null);
      if (!startupKey) continue;
      const list = byStartup.get(startupKey) || [];
      list.push({
        id: event.id,
        startup_name: event.startup_name_raw,
        announced_at: event.announced_at || event.occurred_at,
        investors: roster,
      });
      byStartup.set(startupKey, list);

      for (const person of roster) {
        const affinity = triggerByInvestor.get(person.id) || {};
        const why = event.metadata?.funding_attention_why;
        if (why) affinity[why] = (affinity[why] || 0) + 1;
        triggerByInvestor.set(person.id, affinity);
        const vehicle = classifyCheckVehicle(person, roster, event);
        if (vehicle.vehicle === 'personal_angel') {
          sidecarByInvestor.set(person.id, { why: vehicle.why, startup: event.startup_name_raw });
        }
      }
    }
    for (const group of byStartup.values()) {
      const detected = detectFollowTheLead(group);
      if (!detected.followed) continue;
      if (detected.leader?.investor_id) {
        followByInvestor.set(detected.leader.investor_id, { as: 'leader', firm: detected.leader.firm });
      }
      for (const follower of detected.followers) {
        for (const name of follower.names || []) {
          const match = investorRows.find((row) => (row.firm || row.name) === name);
          if (match) followByInvestor.set(match.id, { as: 'follower', after: detected.leader.firm });
        }
      }
    }

    let patched = 0;
    for (const investor of investorRows) {
      const current = investor.signals && typeof investor.signals === 'object' ? { ...investor.signals } : {};
      const observed = current.observed_thesis && typeof current.observed_thesis === 'object'
        ? { ...current.observed_thesis }
        : {};
      observed.patterns = patternNotesForInvestor(investor, {
        follow_the_lead: followByInvestor.get(investor.id) || null,
        sidecar: sidecarByInvestor.get(investor.id) || null,
        trigger_affinity: triggerByInvestor.get(investor.id) || {},
      });
      current.observed_thesis = observed;
      const { error: upErr } = await db.from('investors').update({
        signals: current,
        updated_at: new Date().toISOString(),
      }).eq('id', investor.id);
      if (upErr) {
        console.error(`  investor ${investor.id}: ${upErr.message}`);
        continue;
      }
      patched += 1;
    }
    report.stats = { investor_pattern_patches: patched };
  }

  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    report.report_path = reportPath;
  } catch {
    report.report_path = null;
  }

  const printed = jsonOut ? report : {
    mode: report.mode,
    events: report.events,
    startups: report.startups,
    trigger_counts: report.trigger_counts,
    capital_role_counts: report.capital_role_counts,
    check_vehicle_counts: report.check_vehicle_counts,
    follow_the_lead: {
      startups_with_follow: report.follow_the_lead.startups_with_follow,
      examples: report.follow_the_lead.examples.slice(0, 5),
    },
    personal_angel_sidecars: {
      count: report.personal_angel_sidecars.count,
      examples: report.personal_angel_sidecars.examples.slice(0, 5),
    },
    founder_angels: report.founder_angels,
    lessons: report.lessons,
    report_path: report.report_path,
  };
  console.log(JSON.stringify(printed, null, 2));
  if (!apply) console.log('\nDRY RUN — no writes. Re-run with --apply to stamp investor pattern notes.');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
