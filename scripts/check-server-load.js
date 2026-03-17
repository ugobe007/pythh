#!/usr/bin/env node
/**
 * Pre-deploy check: ensure route modules that caused deploy failures load without throwing.
 * - instantSubmit: used to require .ts (now try/catch) and warmed DB on load (now removed).
 * Run: node scripts/check-server-load.js   or  npm run check:server
 * Exit 0 = OK, exit 1 = load failed (fix before fly deploy).
 */
process.env.NODE_ENV = 'production';
process.env.FLY_APP_NAME = 'hot-honey';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder';

const path = require('path');
const appRoot = path.join(__dirname, '..');

try {
  require(path.join(appRoot, 'server', 'routes', 'instantSubmit.js'));
  console.log('[check-server-load] OK (instantSubmit loads without .ts or DB at startup)');
  process.exit(0);
} catch (e) {
  console.error('[check-server-load] FAIL:', e.message);
  process.exit(1);
}
