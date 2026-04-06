#!/usr/bin/env node
/**
 * ML Training Scheduler
 * Runs ML training on a schedule (daily at 3 AM by default)
 *
 * Other schedulers (separate processes):
 *   - scripts/cron/dq-report-scheduler.js — data-quality rollup
 *   - scripts/cron/ml-match-maintenance-scheduler.js — match feedback train + drift (+ optional snapshot backfill)
 *
 * Usage:
 *   node scripts/cron/ml-training-scheduler.js              # Run once and exit
 *   node scripts/cron/ml-training-scheduler.js --daemon     # Run continuously with schedule
 */

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const TRAINING_SCRIPT = path.join(__dirname, '..', '..', 'run-ml-training.js');
const SCHEDULE = process.env.ML_TRAINING_SCHEDULE || '0 3 * * *'; // Default: 3 AM daily

function runMLTraining() {
  return new Promise((resolve, reject) => {
    console.log(`\n[${new Date().toISOString()}] 🤖 Starting scheduled ML training...\n`);
    
    const trainingProcess = spawn('node', [TRAINING_SCRIPT], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      shell: true
    });
    
    trainingProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n[${new Date().toISOString()}] ✅ ML training completed successfully\n`);
        resolve();
      } else {
        console.error(`\n[${new Date().toISOString()}] ❌ ML training exited with code ${code}\n`);
        reject(new Error(`Training failed with code ${code}`));
      }
    });
    
    trainingProcess.on('error', (error) => {
      console.error(`\n[${new Date().toISOString()}] ❌ Error starting ML training: ${error.message}\n`);
      reject(error);
    });
  });
}

// Check if running as daemon
const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  console.log('🤖 ML Training Scheduler (Daemon Mode)');
  console.log('═'.repeat(70));
  console.log(`📅 Schedule: ${SCHEDULE}`);
  console.log(`📝 Script: ${TRAINING_SCRIPT}`);
  console.log('═'.repeat(70));
  console.log('\n💡 To change schedule, set ML_TRAINING_SCHEDULE environment variable');
  console.log('   Examples:');
  console.log('     "0 3 * * *"     - Daily at 3 AM (default)');
  console.log('     "0 */6 * * *"   - Every 6 hours');
  console.log('     "0 3,15 * * *"  - Daily at 3 AM and 3 PM');
  console.log('     "0 0 * * 0"     - Weekly on Sunday at midnight');
  console.log('\n🔄 Starting scheduler...\n');
  
  // Run immediately on startup
  runMLTraining().catch(error => {
    console.error('❌ Initial training run failed:', error.message);
  });
  
  // Schedule recurring runs
  const job = cron.schedule(SCHEDULE, async () => {
    try {
      await runMLTraining();
    } catch (error) {
      console.error('❌ Scheduled training failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });
  
  console.log('✅ Scheduler started. Waiting for next run...\n');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down ML training scheduler...');
    job.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down ML training scheduler...');
    job.stop();
    process.exit(0);
  });
  
} else {
  // Run once and exit
  console.log('🤖 Running ML training (one-time execution)...\n');
  runMLTraining()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Training failed:', error);
      process.exit(1);
    });
}
