#!/usr/bin/env node
/**
 * Guard against Node.js 24+ — breaks undici, @supabase/supabase-js, and several ops scripts.
 * CI and Cloud Agents use Node 22 LTS. Run: nvm use (reads .nvmrc)
 */

const major = parseInt(process.version.slice(1).split('.')[0], 10);

if (major >= 24) {
  console.error(`
ERROR: Node.js ${process.version} is not supported for pythh ops scripts.

Node 24 breaks bundled undici and @supabase/supabase-js (AuthClient load failure).
Use Node 22 LTS instead:

  nvm install 22
  nvm use 22
  node -v   # should print v22.x

Then reinstall deps if needed:
  rm -rf node_modules && npm install

See .nvmrc and package.json "engines" for the supported range.
`.trim());
  process.exit(1);
}

if (major < 20) {
  console.error(`
ERROR: Node.js ${process.version} is too old. Requires Node >= 20 (recommended: 22 LTS).
  nvm install 22 && nvm use 22
`.trim());
  process.exit(1);
}
