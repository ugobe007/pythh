/**
 * PM2 Production Ecosystem Configuration (Fly.io)
 * 
 * Runs all background processes + Express server inside a single container.
 * The Vite dev server (hot-match-server) is NOT included — in production,
 * the frontend is pre-built and served as static files by Express.
 * 
 * ALL processes use tsx as interpreter to handle TypeScript imports
 * (several .js files require .ts modules — plain node can't parse them).
 * 
 * Started via: pm2-runtime start ecosystem.prod.config.js
 */

const TSX = '/app/node_modules/.bin/tsx';

module.exports = {
  apps: [
    // ========================================
    // EXPRESS API SERVER (serves frontend + API)
    // Binds to PORT env var (8080 on Fly.io)
    // ========================================
    {
      name: 'api-server',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'server/index.js',
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
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/core/simple-rss-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 30000,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '0 */2 * * *',  // Every 2 hours (prevents connection storms)
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'rss-scraper',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/core/ssot-rss-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 30000,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '0 */1 * * *',  // Every hour (was every 15min — too aggressive)
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'high-volume-discovery',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/high-volume-discovery.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '0 */2 * * *',  // Every 2 hours (prevents connection storms)
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'html-scraper',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/scrapers/html-startup-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */6 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'vc-team-scraper',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/vc-team-scraper.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '400M',
      max_restarts: 3,
      cron_restart: '0 */6 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'event-rescue-agent',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/event-rescue-agent.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 60000,
      cron_restart: '0 */1 * * *',  // Every hour (was every 30min)
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // IMPORT & PROCESSING PIPELINE
    // ========================================
    {
      name: 'auto-import-pipeline',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/core/auto-import-pipeline.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 5,
      cron_restart: '15 */1 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'discovery-job-processor',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'process-discovery-jobs.js',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 30000,
      watch: false,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // ML & SCORING PIPELINE
    // ========================================
    {
      name: 'ml-training-scheduler',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/cron/ml-training-scheduler.js',
      args: '--daemon',
      cwd: '/app',
      instances: 1,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 30000,
      watch: false,
      max_memory_restart: '400M',
      cron_restart: '0 */4 * * *',  // Every 4 hours (was 2)
      env: {
        NODE_ENV: 'production',
        ML_TRAINING_SCHEDULE: '0 */2 * * *'
      }
    },
    {
      name: 'ml-auto-apply',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'ml-auto-apply.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'ml-ontology-agent',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/ml-ontology-agent.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,
      min_uptime: '30s',
      restart_delay: 300000,
      cron_restart: '0 */6 * * *',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // PYTHIA PIPELINE (Forum signals → GOD scores)
    // ========================================
    {
      name: 'pythia-collector',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/pythia/collect-from-forums.js',
      args: '50',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */2 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythia-scorer',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/pythia/score-entities.js',
      args: 'score startup 500',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '30 */2 * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythia-sync',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/pythia/sync-pythia-scores.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '45 */2 * * *',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // MATCH ENGINE
    // ========================================
    {
      name: 'match-worker',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'server/matchRunWorker.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,
      exp_backoff_restart_delay: 10000,
      max_restarts: 10,
      min_uptime: '5s',
      cron_restart: '*/10 * * * * *',
      env: {
        NODE_ENV: 'production',
        MAX_RUNS_PER_BATCH: '2',
        BATCH_TIMEOUT_MS: '8000'
      }
    },
    {
      name: 'match-regen-delta',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'match-regenerator.js',
      args: '--delta',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '1500M',
      restart_delay: 60000,
      exp_backoff_restart_delay: 300000,
      max_restarts: 3,
      min_uptime: '60s',
      kill_timeout: 3600000,
      cron_restart: '0 3 */2 * *',
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '30'
      }
    },
    {
      name: 'match-regen-full',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'match-regenerator.js',
      args: '--full',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '2G',
      restart_delay: 60000,
      exp_backoff_restart_delay: 300000,
      max_restarts: 2,
      min_uptime: '60s',
      kill_timeout: 7200000,
      cron_restart: '0 2 * * 0',
      env: {
        NODE_ENV: 'production',
        BATCH_SIZE: '500',
        MAX_RUNTIME_MINUTES: '120'
      }
    },

    // ========================================
    // ORACLE RETENTION SYSTEM
    // ========================================
    {
      name: 'oracle-weekly-refresh',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'server/jobs/oracle-weekly-refresh.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 3,
      cron_restart: '0 20 * * 0', // Sunday 8pm
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'oracle-digest-sender',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'server/jobs/oracle-digest-sender.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 3,
      cron_restart: '0 9 * * 1', // Monday 9am
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // HEALTH MONITORING
    // ========================================
    {
      name: 'system-guardian',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/archive/utilities/system-guardian.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      cron_restart: '*/10 * * * *',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'pythh-url-monitor',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/pythh-url-monitor.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 3,
      cron_restart: '*/5 * * * *',
      env: { NODE_ENV: 'production' }
    },
    // DISABLED: submit-guardian causes api-server restart loop.
    // It kills the server every 2 min if health check is slow during boot.
    // Re-enable only after adding a boot grace period.
    // {
    //   name: 'submit-guardian',
    //   interpreter: TSX,
    //   exec_mode: 'fork',
    //   script: 'scripts/submit-flow-guardian.js',
    //   cwd: '/app',
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
