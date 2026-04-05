import { createClient } from "@supabase/supabase-js";

// IMPORTANT: Vite's static env injection ONLY works with direct property access:
//   import.meta.env.VITE_*
// Assigning import.meta.env to a variable and using dynamic keys bypasses
// Vite's replacement, leaving undefined values in the browser bundle.

const isServer = typeof window === "undefined";

/** Set by server/index.js in injected <script> before the app bundle loads (production Fly/runtime env). */
function browserSupabaseUrl(): string {
  const r = typeof window !== "undefined" ? window.__PYTHH_RUNTIME__ : undefined;
  const fromHost = r?.supabaseUrl?.trim();
  if (fromHost) return fromHost;
  return (import.meta.env.VITE_SUPABASE_URL as string) || "";
}

function browserSupabaseAnonKey(): string {
  const r = typeof window !== "undefined" ? window.__PYTHH_RUNTIME__ : undefined;
  const fromHost = r?.supabaseAnonKey?.trim();
  if (fromHost) return fromHost;
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
}

// Browser: prefer window.__PYTHH_RUNTIME__ (injected HTML), then Vite build-time env.
// Server/Node: process.env (scripts, GitHub Actions, Fly).
const supabaseUrl: string = isServer
  ? (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "" : "")
  : browserSupabaseUrl();

const supabaseKey: string = isServer
  ? (typeof process !== "undefined"
      ? process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        ""
      : "")
  : browserSupabaseAnonKey();

// Track if credentials are missing (for error display)
export const hasValidSupabaseCredentials = !!(supabaseUrl && supabaseKey);

if (!hasValidSupabaseCredentials) {
  console.error("⚠️ Missing Supabase environment variables. Please check your .env file.");
  console.error("VITE_SUPABASE_URL/SUPABASE_URL:", supabaseUrl ? "Set" : "Missing");
  if (isServer) {
    console.error(
      "Service or anon key:",
      supabaseKey ? "Set" : "Missing (SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY)"
    );
  } else {
    console.error("VITE_SUPABASE_ANON_KEY:", supabaseKey ? "Set" : "Missing");
  }
  console.error("💡 Add these to your .env file in the project root:");
  console.error("   VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.error("   VITE_SUPABASE_ANON_KEY=your-anon-key-here");
}

// IMPORTANT: keep Database typing OFF until you login + regenerate types.
// Otherwise .from('votes') becomes `never` and you get hundreds of TS errors.

// Browser: Enable session persistence and auto-refresh
// Server: Disable persistence (no localStorage available)
const authConfig = isServer
  ? {
      persistSession: false,
      autoRefreshToken: false,
    }
  : {
      persistSession: true,  // ✅ Enable session persistence in browser
      autoRefreshToken: true, // ✅ Enable automatic token refresh
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    };

export const supabase = hasValidSupabaseCredentials
  ? createClient<any>(supabaseUrl, supabaseKey, { auth: authConfig })
  : createClient<any>(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseKey || "placeholder-key",
      { auth: authConfig }
    );