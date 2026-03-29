/**
 * Server-side Supabase Client Configuration
 * 
 * This provides a properly configured Supabase client for server-side use
 * in Node.js scripts, background workers, and API routes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Same resolution order as server/lib/supabaseClient.js. Runtime (Fly) has no .env file — use [env] + secrets.
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[server/config/supabase] Missing Supabase env. Need a valid HTTPS URL and a key. ' +
      'Set SUPABASE_URL + SUPABASE_SERVICE_KEY (Fly: `fly secrets set`), ' +
      'or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in fly.toml [env] / dashboard. ' +
      `Got url=${supabaseUrl ? 'set' : 'MISSING'}, key=${supabaseServiceKey ? 'set' : 'MISSING'}.`
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Export for CommonJS compatibility
export default supabase;
