/**
 * PM2 Production Ecosystem Configuration (Fly.io)
 * 
 * Runs all background processes + Express server inside a single container.
 * The Vite dev server (hot-match-server) is NOT included — in production,
 * the frontend is pre-built and served as static files by Express.
 * 
 * Started via: pm2-runtime start ecosystem.prod.config.js
 */

module.exports = {
  apps: [
    // ========================================
    // EXPRESS API SERVER (serves frontend + API)
    // Binds to PORT env var (8080 on Fly.io)
    // ========================================
    {
      name: 'api-server',
      script: 'node',
      args: 'server/index.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '8080'
      }
    },

    // ========================================
    // SCRAPERS — Discovery pipeline
    // ========================================
    {
      name: 'simple-rss-discovery',
      script: 'node',
      args: 'scripts/core/simple-rss-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '0 */1 * * *',  // Every 1 hour
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'rss-scraper',
      script: 'node',
      args: 'scripts/core/ssot-rss-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '*/15 * * * *',  // Every 15 minutes
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'high-volume-discovery',
      script: 'node',
      args: 'scripts/high-volume-discovery.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '0 */1 * * *',  // Every 1 hour
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'html-scraper',
      script: 'node',
      args: 'scripts/scrapers/html-startup-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'vc-team-scraper',
      script: 'node',
      args: 'scripts/vc-team-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '400M',
      max_restarts: 3,
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'event-rescue-agent',
      script: 'node',
      args: 'scripts/event-rescue-agent.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 30000,
      cron_restart: '*/30 * * * *',  // Every 30 minutes
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // IMPORT & PROCESSING PIPELINE
    // ========================================
    {
      name: 'auto-import-pipeline',
      script: 'node',
      args: 'scripts/core/auto-import-pipeline.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 5,
      cron_restart: '15 */1 * * *',  // Every hour at :15
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'discovery-job-processor',
      script: 'node',
      args: 'process-discovery-jobs.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // ML & SCORING PIPELINE
    // ========================================
    {
      name: 'ml-training-scheduler',
      script: 'node',
      args: 'scripts/cron/ml-training-scheduler.js --daemon',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '0 */2 * * *',  // Every 2 hours
      env: {
        NODE_ENV: 'production',
        ML_TRAINING_SCHEDULE: '0 */2 * * *'
      }
    },
    {
      name: 'ml-auto-apply',
      script: 'node',
      args: 'ml-auto-apply.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',  // Every 2 hours at :30
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'ml-ontology-agent',
      script: 'node',
      args: 'scripts/ml-ontology-agent.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 300000,
      cron_restart: '0 */6 * * *',  // Every 6 hours
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // PYTHIA PIPELINE (Forum signals → GOD scores)
    // ========================================
    {
      name: 'pythia-collector',
      script: 'node',
      args: 'scripts/pythia/collect-from-forums.js 50',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */2 * * *',  // Every 2 hours
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythia-scorer',
      script: 'node',
      args: 'scripts/pythia/score-entities.js score startup 500',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',  // Every 2 hours at :30
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythia-sync',
      script: 'node',
      args: 'scripts/pythia/sync-pythia-scores.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '45 */2 * * *',  // Every 2 hours at :45
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // MATCH ENGINE
    // ========================================
    {
      name: 'match-worker',
      script: 'node',
      args: 'server/matchRunWorker.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,
      exp_backoff_restart_delay: 10000,
      max_restarts: 10,
      min_uptime: '5s',
      cron_restart: '*/10 * * * * *',  // Every 10 seconds
      env: {
        NODE_ENV: 'production',
        MAX_RUNS_PER_BATCH: '2',
        BATCH_TIMEOUT_MS: '8000'
      }
    },
    {
      name: 'match-regen-delta',
      script: 'node',
      args: 'match-regenerator.js --delta',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 60000,
      exp_backoff_restart_delay: 300000,
      max_restarts: 3,
      min_uptime: '60s',
      kill_timeout: 3600000,
      cron_restart: '0 3 */2 * *',  // Every 2 days at 3 AM
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '30'
      }
    },
    {
      name: 'match-regen-full',
      script: 'node',
      args: 'match-regenerator.js --full',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '2G',  // Higher limit for Fly (more RAM available)
      restart_delay: 60000,
      exp_backoff_restart_delay: 300000,
      max_restarts: 2,
      min_uptime: '60s',
      kill_timeout: 7200000,
      cron_restart: '0 2 * * 0',  // Weekly: Sunday 2 AM
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '120'
      }
    },

    // ========================================
    // HEALTH MONITORING
    // ========================================
    {
      name: 'system-guardian',
      script: 'node',
      args: 'scripts/archive/utilities/system-guardian.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '*/10 * * * *',  // Every 10 minutes
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythh-url-monitor',
      script: 'node',
      args: 'scripts/pythh-url-monitor.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 3,
      cron_restart: '*/5 * * * *',  // Every 5 minutes
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'submit-guardian',
      script: 'node',
      args: 'scripts/submit-flow-guardian.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 5,
      cron_restart: '*/2 * * * *',  // Every 2 minutes
      env: { NODE_ENV: 'production' }
    }
  ]
};
