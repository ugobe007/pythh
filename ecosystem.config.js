/**
 * PM2 Ecosystem Configuration
 * Manages all background processes for the application
 */

module.exports = {
  apps: [
    {
      name: 'hot-match-server',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      instances: 1,
      autorestart: true,
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
    {
      name: 'rss-scraper',
      script: 'npx',
      args: 'tsx scripts/core/ssot-rss-scraper.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      cron_restart: '*/15 * * * *',  // Every 15 minutes
      env: {
        NODE_ENV: 'production'
      },
      // SSOT scraper - parser is single source of truth for all decisions
      // Phase A: Always store events (100% coverage)
      // Phase B: Conditionally create graph joins (when graph_safe=true)
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
      autorestart: true,  // Self-healing: auto-restart on failure
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 10,  // Allow up to 10 restarts per hour
      min_uptime: '10s',  // Must stay up 10s to count as stable
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: {
        NODE_ENV: 'production'
      }
      // SELF-HEALING: Auto-restarts on crash, feeds GOD score training data
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
      cron_restart: '0 */2 * * *',  // Every 2 hours
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
      autorestart: false,  // Run once per cron cycle
      watch: false,
      max_memory_restart: '500M',
      cron_restart: '*/30 * * * *',  // Every 30 minutes
      env: {
        NODE_ENV: 'production'
      }
      // Rescues startups from misclassified "OTHER" events
      // Uses inference engine first (free), GPT-4 as fallback
      // Saves ~80% on API costs vs pure GPT approach
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
      cron_restart: '*/10 * * * * *',  // Every 10 seconds (near-real-time)
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
      name: 'match-regenerator',
      script: 'node',
      args: 'match-regenerator.js',
      cwd: './',
      instances: 1,  // CRITICAL: Exactly one instance
      autorestart: false,  // Run once per cron, then exit
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 60000,  // 1 min backoff if crash
      exp_backoff_restart_delay: 300000,  // Exponential up to 5 min
      max_restarts: 3,  // Max 3 restarts per hour (this is a heavy job)
      min_uptime: '60s',  // Must run 1 min to count as successful
      kill_timeout: 3600000,  // Hard kill after 1 hour if stuck
      cron_restart: '0 2 * * *',  // Daily at 2 AM (controlled nightly maintenance)
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '1000',  // Process 1000 matches per batch
        MAX_RUNTIME_MINUTES: '60'  // Self-terminate after 60 min
      }
      // MUST implement advisory lock: pg_try_advisory_lock(hashtext('match_regenerator'))
      // If lock fails → exit immediately (another instance running)
      // On exit → pg_advisory_unlock
      // Purpose: Keep 4.1M corpus fresh with new investor/startup data
    },
    {
      name: 'discovery-job-processor',
      script: 'node',
      args: 'process-discovery-jobs.js',
      cwd: './',
      instances: 1,
      autorestart: true,  // Keep alive - continuous polling
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
