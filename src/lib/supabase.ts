import { createClient } from "@supabase/supabase-js";

// Support both browser (Vite) and Node/CLI environments.
// In the browser, Vite injects import.meta.env.*.
// In Node (scripts, GitHub Actions), we fall back to process.env.
const rawEnv: Record<string, any> =
  (typeof import.meta !== "undefined" && (import.meta as any).env) ||
  (typeof process !== "undefined" ? (process.env as any) : {});

const isServer = typeof window === "undefined";

const supabaseUrl: string =
  rawEnv.VITE_SUPABASE_URL || rawEnv.SUPABASE_URL || "";

// On the server, prefer the service key when available; in the browser, only use anon keys.
const supabaseKey: string = isServer
  ? rawEnv.SUPABASE_SERVICE_KEY ||
    rawEnv.SUPABASE_SERVICE_ROLE_KEY ||
    rawEnv.VITE_SUPABASE_ANON_KEY ||
    rawEnv.SUPABASE_ANON_KEY ||
    ""
  : rawEnv.VITE_SUPABASE_ANON_KEY || rawEnv.SUPABASE_ANON_KEY || "";

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