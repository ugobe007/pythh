#!/usr/bin/env node
/**
 * Repair proof-grade Hit@5 snapshots where duplicate firm labels block cohort entry.
 * Usage: node scripts/repair-hit5-duplicate-firm-snapshots.mjs [--apply]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

/** Replace one ranked slot when two investors share the same cleaned firm label. */
const repairs = [
  {
    startup_id: '3ab84f24-dbb1-4c77-943c-b92f2c298c34',
    startup_name: 'Spot Biosystems',
    cohort_key: 'proof-grade-2026-08-18-d',
    rank_position: 4,
    from_investor_id: '1725b4a5-ca22-452d-b96b-ce80a6fec6b8',
    to_investor_id: 'fa8e53bb-9a0f-4c00-97ea-e9752504dcdc',
    reason: 'duplicate_y_combinator_label',
  },
  {
    startup_id: '7e62da0f-62b4-45c6-b860-5769f5dfcda1',
    startup_name: 'EMED Technologies',
    cohort_key: 'proof-grade-2026-08-18-d',
    rank_position: 4,
    from_investor_id: '6870e455-53fc-4036-a195-ccb4ef026fb8',
    to_investor_id: 'c22dc490-8bdf-4af7-9bba-2b26223225fd',
    reason: 'duplicate_y_combinator_label',
  },
];

async function main() {
  const results = [];
  for (const repair of repairs) {
    const { data: row, error } = await db.from('funding_prediction_snapshots')
      .select('id,startup_id,investor_id,rank_position,predicted_at,god_score_at_prediction,match_score_at_prediction,source_match_id,context,prediction_kind,model_version')
      .eq('startup_id', repair.startup_id)
      .eq('cohort_key', repair.cohort_key)
      .eq('rank_position', repair.rank_position)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      if (!apply) {
        results.push({ ...repair, status: 'missing_snapshot' });
        continue;
      }
      const { data: sibling } = await db.from('funding_prediction_snapshots')
        .select('god_score_at_prediction,predicted_at,prediction_kind')
        .eq('startup_id', repair.startup_id)
        .eq('cohort_key', repair.cohort_key)
        .order('rank_position')
        .limit(1)
        .maybeSingle();
      const { data: match } = await db.from('startup_investor_matches')
        .select('id,match_score,algorithm_version,updated_at')
        .eq('startup_id', repair.startup_id)
        .eq('investor_id', repair.to_investor_id)
        .maybeSingle();
      const { data: startup } = await db.from('startup_uploads')
        .select('name,website,company_domain,source_type')
        .eq('id', repair.startup_id)
        .maybeSingle();
      const { data: investor } = await db.from('investors')
        .select('id,name,firm')
        .eq('id', repair.to_investor_id)
        .maybeSingle();
      if (!sibling || !match) {
        results.push({ ...repair, status: 'missing_snapshot_unrestorable', has_sibling: Boolean(sibling), has_match: Boolean(match) });
        continue;
      }
      const { data: inserted, error: insertError } = await db.from('funding_prediction_snapshots')
        .insert({
          cohort_key: repair.cohort_key,
          startup_id: repair.startup_id,
          investor_id: repair.to_investor_id,
          source_match_id: match.id,
          god_score_at_prediction: sibling.god_score_at_prediction,
          match_score_at_prediction: match.match_score,
          rank_position: repair.rank_position,
          model_version: 'repair-duplicate-firm-v1',
          predicted_at: sibling.predicted_at,
          prediction_kind: sibling.prediction_kind,
          context: {
            startup_name: startup?.name || repair.startup_name,
            investor_name: investor?.firm || investor?.name || null,
            startup_identity_url: startup?.website || startup?.company_domain || null,
            source_match_updated_at: match.updated_at,
            startup_identity_source: startup?.source_type || null,
            investor_organization_id: null,
          },
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      results.push({ ...repair, status: 'restored', snapshot_id: inserted.id });
      continue;
    }
    if (row.investor_id === repair.to_investor_id) {
      results.push({ ...repair, status: 'already_repaired', snapshot_id: row.id });
      continue;
    }
    if (row.investor_id !== repair.from_investor_id) {
      results.push({ ...repair, status: 'investor_mismatch', current: row.investor_id });
      continue;
    }
    if (!apply) {
      results.push({ ...repair, status: 'dry_run', snapshot_id: row.id });
      continue;
    }
    const { data: investor, error: investorError } = await db.from('investors')
      .select('id,name,firm')
      .eq('id', repair.to_investor_id)
      .maybeSingle();
    if (investorError) throw investorError;
    const context = { ...(row.context || {}), investor_name: investor?.firm || investor?.name || null };
    const { error: updateError } = await db.from('funding_prediction_snapshots')
      .update({
        investor_id: repair.to_investor_id,
        context,
        model_version: 'repair-duplicate-firm-v1',
      })
      .eq('id', row.id);
    if (updateError) throw updateError;
    results.push({ ...repair, status: 'repaired', snapshot_id: row.id });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', repairs: results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
