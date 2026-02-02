#!/usr/bin/env node
/**
 * BACKFILL STARTUP SIGNALS
 * =========================
 * 
 * Runs SignalCascade on all approved startups to populate startup_signals table.
 * This enables ML agent to train on historical signal data.
 * 
 * Usage:
 *   node backfill-startup-signals.js
 *   node backfill-startup-signals.js --limit 100  # Process first 100
 *   node backfill-startup-signals.js --batch 50   # Batch size
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { SignalCascade } = require('../server/services/signalCascade');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const args = process.argv.slice(2);
const all = args.includes('--all');
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : (all ? null : 1000);
const batchSize = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) : 50;

async function backfillStartupSignals() {
  console.log('🚀 Backfilling startup_signals table...\n');

  try {
    // Fetch approved startups
    console.log('📊 Fetching approved startups...');
    
    // First, get the count
    const { count: totalCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    console.log(`📌 Total approved startups in database: ${totalCount}`);
    
    let startups = [];
    
    if (limit) {
      // Fetch limited number
      console.log(`📌 Processing ${limit} startups (use --all to process all)`);
      const { data, error: fetchError } = await supabase
        .from('startup_uploads')
        .select('id, name, description, website, extracted_data, tagline, location, sectors, stage, raise_amount, raise_type')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (fetchError) {
        console.error('❌ Error fetching startups:', fetchError);
        return;
      }
      startups = data;
    } else {
      // Fetch ALL in chunks (Supabase has a 1000 row limit by default)
      console.log(`📌 Processing ALL ${totalCount} approved startups (fetching in chunks)...`);
      const chunkSize = 1000;
      let offset = 0;
      
      while (offset < totalCount) {
        console.log(`   Fetching chunk: ${offset + 1} to ${Math.min(offset + chunkSize, totalCount)}...`);
        const { data: chunk, error: chunkError } = await supabase
          .from('startup_uploads')
          .select('id, name, description, website, extracted_data, tagline, location, sectors, stage, raise_amount, raise_type')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .range(offset, offset + chunkSize - 1);
        
        if (chunkError) {
          console.error('❌ Error fetching chunk:', chunkError);
          break;
        }
        
        startups = startups.concat(chunk);
        offset += chunkSize;
        
        if (chunk.length < chunkSize) {
          break; // No more data
        }
      }
    }

    console.log(`✅ Found ${startups.length} approved startups\n`);

    // Initialize SignalCascade with supabase client
    const signalCascade = new SignalCascade(supabase);
    let processed = 0;
    let totalSignals = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < startups.length; i += batchSize) {
      const batch = startups.slice(i, Math.min(i + batchSize, startups.length));
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(startups.length / batchSize)} (${batch.length} startups)...`);

      for (const startup of batch) {
        try {
          // Build text from startup data
          const text = [
            startup.name || '',
            startup.tagline || '',
            startup.description || '',
            startup.website || '',
            startup.location || '',
            (startup.sectors || []).join(', '),
            startup.raise_type || '',
            startup.raise_amount ? `$${startup.raise_amount}` : '',
            JSON.stringify(startup.extracted_data || {})
          ].join(' ');

          // Build structure
          const structure = {
            metadata: {
              name: startup.name,
              sectors: startup.sectors,
              stage: startup.stage,
              location: startup.location
            },
            extracted_data: startup.extracted_data || {}
          };

          // Build context with startupId
          const context = {
            startupId: startup.id,
            source: 'backfill',
            timestamp: new Date().toISOString()
          };

          // Process with SignalCascade (will automatically persist to startup_signals)
          const signals = await signalCascade.process(text, structure, context);

          // Count signals
          let signalCount = 0;
          for (const [category, data] of Object.entries(signals)) {
            if (data && typeof data === 'object') {
              for (const value of Object.values(data)) {
                if (value !== null && value !== undefined && value !== false) {
                  if (Array.isArray(value)) signalCount += value.length;
                  else signalCount++;
                }
              }
            }
          }

          totalSignals += signalCount;
          processed++;

          if (processed % 10 === 0) {
            console.log(`   ✅ Processed ${processed}/${startups.length} startups (${totalSignals} total signals)`);
          }

        } catch (err) {
          errors++;
          console.error(`   ❌ Error processing ${startup.name}:`, err.message);
        }
      }

      // Brief pause between batches
      if (i + batchSize < startups.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`   Processed: ${processed}/${startups.length} startups`);
    console.log(`   Total Signals: ${totalSignals}`);
    console.log(`   Avg Signals/Startup: ${(totalSignals / processed).toFixed(1)}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));

    // Log to ai_logs
    await supabase.from('ai_logs').insert({
      type: 'signal_backfill',
      action: 'backfill_complete',
      status: 'success',
      output: {
        processed,
        totalSignals,
        avgSignals: (totalSignals / processed).toFixed(1),
        errors,
        timestamp: new Date().toISOString()
      }
    });

    console.log('\n✅ Logged to ai_logs table');

    // Check startup_signals table
    const { count: signalCount } = await supabase
      .from('startup_signals')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 startup_signals table now has ${signalCount} total signals`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
    await supabase.from('ai_logs').insert({
      type: 'signal_backfill',
      action: 'backfill_error',
      status: 'error',
      output: { error: err.message, stack: err.stack }
    });
  }
}

// Run
backfillStartupSignals();
