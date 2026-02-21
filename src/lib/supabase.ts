import { createClient } from "@supabase/supabase-js";

// IMPORTANT: Vite's static env injection ONLY works with direct property access:
//   import.meta.env.VITE_*
// Assigning import.meta.env to a variable and using dynamic keys bypasses
// Vite's replacement, leaving undefined values in the browser bundle.

const isServer = typeof window === "undefined";

// Browser: Vite statically replaces import.meta.env.VITE_* at build time.
// Server/Node: process.env is used directly (scripts, GitHub Actions).
const supabaseUrl: string = isServer
  ? (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "" : "")
  : (import.meta.env.VITE_SUPABASE_URL || "");

const supabaseKey: string = isServer
  ? (typeof process !== "undefined"
      ? process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        ""
      : "")
  : (import.meta.env.VITE_SUPABASE_ANON_KEY || "");

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
export const supabase = hasValidSupabaseCredentials
  ? createClient<any>(supabaseUrl, supabaseKey)
  : createClient<any>(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseKey || "placeholder-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );