/**
 * PM2 Ecosystem Configuration
 * Manages all background processes for the application
 * 
 * IMPORTANT: Run preflight check before starting:
 *   node scripts/preflight-check.js --quick
 * 
 * If preflight fails, DO NOT start processes until fixed.
 */

// Load .env so process.env vars are available for env blocks below
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'hot-match-server',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      instances: 1,
      autorestart: true,
      max_restarts: 10,  // Prevent infinite restart loops
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'api-server',
      script: 'node',
      args: 'server/index.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      max_restarts: 10,  // Prevent infinite restart loops
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ml-training-scheduler',
      script: 'node',
      args: 'scripts/cron/ml-training-scheduler.js --daemon',
      cwd: './',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '500M',
      cron_restart: '0 */2 * * *',  // Every 2 hours (changed from daily at 3 AM)
      env: {
        NODE_ENV: 'production',
        ML_TRAINING_SCHEDULE: '0 */2 * * *'  // Every 2 hours
      }
    },
    {
      name: 'ml-auto-apply',
      script: 'node',
      args: 'ml-auto-apply.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',  // Every 2 hours at :30 (30 min after ML training)
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // ========================================
    // SCORE RECALCULATION (GOD Score Momentum)
    // Recalculates all GOD scores + writes score_history for momentum tracking
    // ========================================
    {
      name: 'score-recalc',
      script: 'npx',
      args: 'tsx scripts/recalculate-scores.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '0 */2 * * *',  // Every 2 hours
      env: {
        NODE_ENV: 'production'
      }
      // Uses startupScoringService.ts SSOT for scoring
      // Includes: bootstrap scoring, momentum, AP/Promising, elite boost, spiky/hot
      // Writes to score_history table for momentum trend tracking
    },
    
    // ========================================
    // HOLDING REVIEW WORKER
    // Daily: retry enrichment on 'holding' startups, delete after 30 days
    // ========================================
    {
      name: 'holding-review-worker',
      script: 'node',
      args: 'scripts/holding-review-worker.js --limit=200',
      cwd: './',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,
      cron_restart: '0 3 * * *',  // Daily at 3am
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // ========================================
    // GOD SCORE MONITOR (Distribution health check)
    // Runs 5 min after score-recalc to verify distribution, logs to ai_logs
    // ========================================
    {
      name: 'god-score-monitor',
      script: 'node',
      args: 'scripts/god-score-monitor.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '200M',
      max_restarts: 3,
      min_uptime: '10s',
      restart_delay: 30000,
      cron_restart: '5 */2 * * *',  // Every 2 hours at :05 (5 min after score-recalc)
      env: {
        NODE_ENV: 'production'
      }
      // Reports distribution stats to ai_logs table (not chat)
      // Checks: avg, median, tiers, top/bottom startups, health flag
    },
    
    // ========================================
    // SIGNAL SCORING (Product velocity, funding, adoption, market, competitive)
    // Calculates 5 signal dimensions → signals_bonus (0-10 pts)
    // ========================================
    {
      name: 'signal-scoring',
      script: 'npx',
      args: 'tsx scripts/apply-signals-batch.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: {
        NODE_ENV: 'production'
      }
      // 5 signal dimensions: product_velocity, funding_acceleration,
      // customer_adoption, market_momentum, competitive_dynamics
      // Max bonus: 10 points added to GOD score
    },
    
    {
      name: 'rss-scraper',
      script: 'npx',
      args: 'tsx scripts/core/ssot-rss-scraper.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,  // FIXED: was true — conflicts with cron_restart causing double-execution
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 35000,  // Allow 35s for graceful shutdown (SIGINT handler needs 30s)
      cron_restart: '*/15 * * * *',  // Every 15 minutes
      env: {
        NODE_ENV: 'production',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        SUPABASE_URL: process.env.VITE_SUPABASE_URL,  // Pass as both for compatibility
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
      },
      // SSOT scraper - parser is single source of truth for all decisions
      // Phase A: Always store events (100% coverage)
      // Phase B: Conditionally create graph joins (when graph_safe=true)
    },
    
    // ========================================
    // SIMPLE RSS SCRAPER (writes to discovered_startups)
    // Tuned for throughput: 1s delay, 75 items per feed
    // ========================================
    {
      name: 'simple-rss-discovery',
      script: 'node',
      args: 'scripts/core/simple-rss-scraper.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 10000,
      watch: false,
      max_memory_restart: '500M',
      cron_restart: '0 */2 * * *',  // Every 2 hours (was 1 hour — too aggressive)
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // ========================================
    // HTML STARTUP SCRAPER (University/Accelerator)
    // ========================================
    {
      name: 'html-scraper',
      script: 'node',
      args: 'scripts/scrapers/html-startup-scraper.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: {
        NODE_ENV: 'production'
      },
      // Scrapes: YC, Princeton, Bristol, Waterloo, Stanford SPARK, VentureRadar
    },
    
    // ========================================
    // ML ONTOLOGY LEARNING (Fully Automated)
    // ========================================
    {
      name: 'ml-ontology-agent',
      script: 'node',
      args: 'scripts/ml-ontology-agent.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Disabled - let cron_restart handle scheduling
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,  // Reduced - prevent restart loops
      min_uptime: '30s',  // Must stay up 30s to count as stable
      restart_delay: 300000, // Wait 5 minutes between restarts
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: {
        NODE_ENV: 'production',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || ''
      }
      // SELF-HEALING: Runs on cron schedule, has internal circuit breaker
      // Auto-applies high-confidence (≥85%) entity classifications
      // Flags low-confidence for optional review
      // Runs independently of GOD scoring system
    },
    
    // ========================================
    // PYTHIA PIPELINE (Forum signals → GOD scores)
    // ========================================
    {
      name: 'pythia-collector',
      script: 'scripts/pythia/collect-from-forums.js',
      args: '50',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '15 */2 * * *',  // Every 2 hours at :15 (staggered from score-recalc at :00)
      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: '.env.pyth'
      }
    },
    {
      name: 'pythia-scorer',
      script: 'scripts/pythia/score-entities.js',
      args: 'score startup 500',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',  // Every 2 hours at :30
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'pythia-sync',
      script: 'scripts/pythia/sync-pythia-scores.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '45 */2 * * *',  // Every 2 hours at :45
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'system-guardian',
      script: 'scripts/archive/utilities/system-guardian.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '*/10 * * * *',  // Every 10 minutes
      env: {
        NODE_ENV: 'production'
      }
    },
    // ========================================
    // EVENT RESCUE AGENT - Self-healing scraper
    // ========================================
    {
      name: 'event-rescue-agent',
      script: 'node',
      args: 'scripts/event-rescue-agent.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // FIXED: was true — conflicts with cron_restart
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '*/30 * * * *',  // Every 30 minutes
      env: {
        NODE_ENV: 'production'
      }
      // Rescues startups from misclassified "OTHER" events
      // Uses inference engine first (free), GPT-4 as fallback
      // Saves ~80% on API costs vs pure GPT approach
    },
    
    // ========================================
    // AUTO-IMPORT PIPELINE (discovered_startups → startup_uploads)
    // Imports quality startups, assigns GOD scores, queues for matching
    // ========================================
    {
      name: 'auto-import-pipeline',
      script: 'node',
      args: 'scripts/core/auto-import-pipeline.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle, exits when done
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 5,
      cron_restart: '15 */1 * * *',  // Every hour at :15 (15 min after scrapers)
      env: {
        NODE_ENV: 'production'
      }
      // Converts discovered_startups → startup_uploads with quality filtering
      // Generates initial GOD scores and queues for match generation
    },
    
    // ========================================
    // ORACLE WEEKLY REFRESH (Retention System)
    // Regenerates insights for returning users every Sunday
    // ========================================
    {
      name: 'oracle-weekly-refresh',
      script: 'node',
      args: 'server/jobs/oracle-weekly-refresh.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 20 * * 0',  // Sunday at 8pm (week=0)
      env: {
        NODE_ENV: 'production'
      }
      // Finds sessions completed 7+ days ago
      // Generates fresh insights using inference engine
      // Creates notifications to bring users back
      // Target: 60% 7-day retention (vs 15% baseline)
    },
    {
      name: 'oracle-digest-sender',
      script: 'node',
      args: 'server/jobs/oracle-digest-sender.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 9 * * 1',  // Monday at 9am (week=1)
      env: {
        NODE_ENV: 'production'
      }
      // Sends weekly email digest with fresh insights
      // Uses Resend API (alerts@pythh.ai)
      // Includes: insights, actions, score updates
      // Target: 45% open rate, 15% click-through
    },
    // ========================================
    // MATCH ENGINE - Pattern A v1.1 (PRODUCTION)
    // ========================================
    {
      name: 'match-worker',
      script: 'node',
      args: 'server/matchRunWorker.js',
      cwd: './',
      instances: 1,  // CRITICAL: Exactly one instance
      autorestart: false,  // Run once per cron, then exit
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,  // 5s backoff if crash
      exp_backoff_restart_delay: 10000,  // Exponential backoff up to 10s
      max_restarts: 10,  // Max 10 restarts per hour
      min_uptime: '5s',  // Must run 5s to count as successful
      cron_restart: '*/2 * * * *',  // Every 2 minutes (was 6-field seconds cron — too aggressive)
      env: {
        NODE_ENV: 'production',
        MAX_RUNS_PER_BATCH: '2',  // Process max 2 runs per tick
        BATCH_TIMEOUT_MS: '8000'  // Hard stop at 8s
      }
      // Worker uses advisory lock (pg_try_advisory_lock) to prevent double-running
      // Pattern: Read-only from startup_investor_matches (no writes to 4.1M corpus)
      // Uses get_top_matches(limit:200) - instant with index
    },
    {
      name: 'match-regen-delta',
      script: 'node',
      args: 'match-regenerator.js --delta',
      cwd: './',
      instances: 1,  // CRITICAL: Exactly one instance
      autorestart: false,  // Run once per cron, then exit
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 60000,  // 1 min backoff if crash
      exp_backoff_restart_delay: 300000,  // Exponential up to 5 min
      max_restarts: 3,
      min_uptime: '60s',
      kill_timeout: 3600000,  // Hard kill after 1 hour if stuck
      cron_restart: '0 3 */2 * *',  // Every 2 days at 3 AM (delta: only changed startups)
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '30'
      }
      // Delta mode: only re-scores startups updated in last 48h
      // Typical run: ~200-500 startups × 3,855 investors → ~25K matches → ~5 min
    },
    {
      name: 'match-regen-full',
      script: 'node',
      args: 'match-regenerator.js --full',
      cwd: './',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 60000,
      exp_backoff_restart_delay: 300000,
      max_restarts: 2,
      min_uptime: '60s',
      kill_timeout: 7200000,  // Hard kill after 2 hours
      cron_restart: '0 2 * * 0',  // Weekly: Sunday 2 AM (full refresh)
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '120'
      }
      // Full mode: re-scores ALL startups × ALL investors
      // ~7,200 startups × 3,855 investors → ~360K matches → ~50 min
    },
    {
      name: 'discovery-job-processor',
      script: 'node',
      args: 'process-discovery-jobs.js',
      cwd: './',
      instances: 1,
      autorestart: true,  // Keep alive - continuous polling
      max_restarts: 10,   // Prevent infinite restart loops
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // ========================================
    // HIGH-VOLUME DISCOVERY (200+ startups/day, 100+ investors/day)
    // CRITICAL: This was dying silently — now has autorestart + more restarts
    // ========================================
    {
      name: 'high-volume-discovery',
      script: 'node',
      args: 'scripts/high-volume-discovery.js',
      cwd: './',
      instances: 1,
      autorestart: true,   // CHANGED: was false — if it crashes, restart!
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 3,    // Prevent connection pool exhaustion
      min_uptime: '30s',   // Must run 30s to count
      restart_delay: 60000, // Wait 1 min between restarts
      cron_restart: '0 */2 * * *',  // Every 2 hours (prevent connection storms)
      env: {
        NODE_ENV: 'production'
      }
      // Uses AI entity extraction from 65+ RSS sources + Google News
      // Goal: 200+ startups/day, 100+ investors/day
    },
    {
      name: 'vc-team-scraper',
      script: 'node',
      args: 'scripts/vc-team-scraper.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 3,
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: {
        NODE_ENV: 'production'
      }
      // Scrapes 50+ VC firm team pages
      // Discovers individual partners, principals, associates
    },
    
    // ========================================
    // EMBEDDING WATCHER - Auto-generates vector embeddings
    // Polls for startups/investors missing embeddings, generates via OpenAI
    // ========================================
    {
      name: 'embedding-watcher',
      script: 'node',
      args: 'scripts/embedding-watcher-standalone.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 30000,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
      // Generates text-embedding-3-small (1536-dim) vectors
      // Polls every 30s for missing embeddings on startups AND investors
      // Uses OpenAI API — rate-limited to avoid quota issues
    },
    
    // ========================================
    // SOCIAL SIGNALS SCRAPER - Psych signal enrichment
    // Scrapes Reddit, HN, Twitter for startup mentions & sentiment
    // ========================================
    {
      name: 'social-signals-scraper',
      script: 'node',
      args: 'scripts/enrichment/social-signals-scraper.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 3,
      cron_restart: '0 */4 * * *',  // Every 4 hours
      env: {
        NODE_ENV: 'production'
      }
      // Extracts FOMO, conviction, urgency, risk signals
      // Feeds into psychological bonus in GOD score calculation
    },

    // ========================================
    // PYTHH URL MONITOR - AI Health Agent
    // ========================================
    {
      name: 'pythh-url-monitor',
      script: 'node',
      args: 'scripts/pythh-url-monitor.js',
      cwd: './',
      instances: 1,
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 3,
      cron_restart: '*/5 * * * *',  // Every 5 minutes
      env: {
        NODE_ENV: 'production'
      }
      // Monitors SUBMIT URL and Matching Engine health
      // Auto-heals stuck jobs and triggers match generation
    },
    
    // ========================================
    // SUBMIT FLOW GUARDIAN - DISABLED (causes api-server restart loop)
    // The guardian kills the api-server every 2 min if health check is slow,
    // which on a memory-constrained Fly machine creates a crash loop.
    // Re-enable only after adding a boot grace period.
    // ========================================
    // {
    //   name: 'submit-guardian',
    //   script: 'node',
    //   args: 'scripts/submit-flow-guardian.js',
    //   cwd: './',
    //   instances: 1,
    //   autorestart: false,
    //   watch: false,
    //   max_memory_restart: '256M',
    //   max_restarts: 5,
    //   cron_restart: '*/2 * * * *',
    //   env: { NODE_ENV: 'production' }
    // }
  ]
};
