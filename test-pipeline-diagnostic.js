#!/usr/bin/env node
/**
 * Pipeline Diagnostic Test Script
 * Runs the comprehensive pipeline state query for test cases
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runDiagnostic(startupId, label) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label} - Startup ID: ${startupId}`);
  console.log('='.repeat(80));

  // Run the comprehensive pipeline diagnostic query
  const { data, error } = await supabase.rpc('run_sql', {
    query: `
      with params as (
        select '${startupId}'::uuid as startup_id
      ),
      
      q as (
        select
          startup_id,
          status as queue_status,
          attempts,
          priority,
          updated_at,
          last_error
        from public.match_generation_queue
        where startup_id = (select startup_id from params)
        order by updated_at desc
        limit 1
      ),
      
      m as (
        select
          startup_id,
          count(*) as match_count,
          max(created_at) as last_match_at
        from public.startup_investor_matches
        where startup_id = (select startup_id from params)
        group by startup_id
      ),
      
      active as (
        select
          count(*) as active_investor_matches
        from public.startup_investor_matches sim
        join public.investors i on i.id = sim.investor_id
        where sim.startup_id = (select startup_id from params)
          and i.status = 'active'
      )
      
      select
        (select startup_id from params) as startup_id,
        coalesce(q.queue_status, 'not_queued') as queue_status,
        coalesce(q.attempts, 0) as attempts,
        q.updated_at as queue_updated_at,
        q.last_error,
        coalesce(m.match_count, 0) as match_count,
        m.last_match_at,
        (select active_investor_matches from active) as active_investor_matches,
        case
          when coalesce(m.match_count, 0) >= 1000 then 'ready'
          when coalesce(q.queue_status, 'not_queued') in ('pending','processing') then 'matching'
          else 'needs_queue'
        end as system_state;
    `
  });

  if (error) {
    // RPC might not exist, fall back to direct queries
    console.log('Using direct queries...\n');
    
    // Get queue status
    const { data: queueData } = await supabase
      .from('match_generation_queue')
      .select('startup_id, status, attempts, priority, updated_at, last_error')
      .eq('startup_id', startupId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    // Get match count
    const { count: matchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId);
    
    // Get active investor matches
    const { count: activeCount } = await supabase
      .from('startup_investor_matches')
      .select('investor_id', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .eq('investors.status', 'active');
    
    const result = {
      startup_id: startupId,
      queue_status: queueData?.status || 'not_queued',
      attempts: queueData?.attempts || 0,
      queue_updated_at: queueData?.updated_at || null,
      last_error: queueData?.last_error || null,
      match_count: matchCount || 0,
      active_investor_matches: activeCount || 0,
      system_state: matchCount >= 1000 ? 'ready' : 
                   (queueData?.status === 'pending' || queueData?.status === 'processing') ? 'matching' : 
                   'needs_queue'
    };
    
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log('🔍 Finding test cases...\n');
  
  // Find one ready job
  const { data: readyJobs } = await supabase
    .from('startup_jobs')
    .select('id, startup_id, url_normalized, status, progress')
    .eq('status', 'ready')
    .order('updated_at', { ascending: false })
    .limit(1);
  
  // Find one matching job
  const { data: matchingJobs } = await supabase
    .from('startup_jobs')
    .select('id, startup_id, url_normalized, status, progress')
    .eq('status', 'matching')
    .order('updated_at', { ascending: false })
    .limit(1);
  
  if (readyJobs?.[0]) {
    await runDiagnostic(readyJobs[0].startup_id, `READY JOB (${readyJobs[0].url_normalized})`);
  } else {
    console.log('⚠️  No ready jobs found');
  }
  
  if (matchingJobs?.[0]) {
    await runDiagnostic(matchingJobs[0].startup_id, `MATCHING JOB (${matchingJobs[0].url_normalized})`);
  } else {
    console.log('⚠️  No matching jobs found');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Pipeline diagnostic complete');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
