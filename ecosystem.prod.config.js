/**
 * PM2 Production Ecosystem Configuration (Fly.io)
 *
 * BATCH JOBS: All scheduled workers run on GitHub Actions — see docs/BATCH_JOBS.md.
 * Fly runs ONLY the API server (Dockerfile CMD: npx tsx server/index.js).
 *
 * Local full stack: pm2 start ecosystem.config.js (dev machine).
 */

module.exports = {
  apps: [
    // Fly Dockerfile does NOT start PM2. This entry documents the expected web process only.
    // {
    //   name: 'api-server',
    //   script: 'server/index.js',
    //   env: { NODE_ENV: 'production', PORT: '8080' },
    // },
  ],
};
