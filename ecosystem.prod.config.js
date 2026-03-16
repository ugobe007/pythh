/**
 * PM2 Production Ecosystem Configuration (Fly.io)
 * 
 * PERFORMANCE FIX: Only api-server + system-guardian run on this 2-CPU machine.
 * All scrapers/workers are DISABLED to prevent event loop starvation and 
 * Supabase connection pool exhaustion. Re-enable when machine is upgraded.
 * 
 * Started via: pm2-runtime start ecosystem.prod.config.js
 * 
 * IMPORTANT: api-server must listen on 0.0.0.0:8080 for Fly proxy (server/index.js does this).
 */

const TSX = '/app/node_modules/.bin/tsx';

module.exports = {
  apps: [
    // ========================================
    // EXPRESS API SERVER (serves frontend + API)
    // Must listen on 0.0.0.0:8080 for Fly.io (see server/index.js app.listen)
    // ========================================
    {
      name: 'api-server',
      interpreter: 'node',
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
    // HEALTH MONITORING (lightweight, runs every 10 min)
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

    // ========================================
    // HOLDING REVIEW WORKER (daily at 3am — lightweight)
    // Retries enrichment, deletes after 30 days with no data
    // ========================================
    {
      name: 'holding-review-worker',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/holding-review-worker.js',
      args: '--limit=100',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      cron_restart: '0 3 * * *',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // ORACLE SIGNAL BACKFILL (daily at 4am)
    // Populates signals[] + focus_areas for Oracle "where investing now/next"
    // ========================================
    {
      name: 'oracle-signal-backfill',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/oracle-signal-backfill.js',
      args: '--limit=200',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '384M',
      cron_restart: '0 4 * * *',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // SOCIAL MEDIA POSTER - Daily AI-written posts at 9am
    // Posts to Twitter/X, LinkedIn, Threads (Instagram pending image gen)
    // See SOCIAL_MEDIA_SETUP.md for credential setup
    // ========================================
    {
      name: 'social-poster',
      script: 'node',
      args: 'server/social-poster.js',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      max_restarts: 3,
      cron_restart: '0 9 * * 1,3,5',
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // PORTFOLIO MONITORING AGENT
    // Scans HN Algolia for each portfolio company, logs events to portfolio_events
    // ========================================
    {
      name: 'portfolio-monitor',
      interpreter: TSX,
      exec_mode: 'fork',
      script: 'scripts/portfolio-monitor.mjs',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '384M',
      cron_restart: '0 6 * * *',   // 6 AM UTC daily
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // SOCIAL SIGNALS FETCHER
    // Enriches data-sparse startups (GOD 40-60) with public-API signals:
    //   Google News RSS count, GitHub stars/commits, iTunes rating count
    // Stores in extracted_data.social_signals; run recalculate-scores after.
    // ========================================
    {
      name: 'social-signals-fetcher',
      interpreter: 'node',
      exec_mode: 'fork',
      script: 'scripts/social-signals-fetcher.mjs',
      cwd: '/app',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 1,
      cron_restart: '0 2 * * 3',   // 2 AM UTC every Wednesday
      env: { NODE_ENV: 'production' }
    },

    // ========================================
    // ALL OTHER PROCESSES DISABLED FOR PERFORMANCE
    // Uncomment to re-enable when resources allow
    // ========================================
    // { name: 'simple-rss-discovery', ... },
    // { name: 'rss-scraper', ... },
    // { name: 'high-volume-discovery', ... },
    // { name: 'html-scraper', ... },
    // { name: 'vc-team-scraper', ... },
    // { name: 'event-rescue-agent', ... },
    // { name: 'auto-import-pipeline', ... },
    // { name: 'discovery-job-processor', ... },
    // { name: 'ml-training-scheduler', ... },
    // { name: 'ml-auto-apply', ... },
    // { name: 'ml-ontology-agent', ... },
    // { name: 'pythia-collector', ... },
    // { name: 'pythia-scorer', ... },
    // { name: 'pythia-sync', ... },
    // { name: 'match-worker', ... },
    // { name: 'match-regen-delta', ... },
    // { name: 'match-regen-full', ... },
    // { name: 'oracle-weekly-refresh', ... },
    // { name: 'oracle-digest-sender', ... },
    // { name: 'pythh-url-monitor', ... },
  ]
};
