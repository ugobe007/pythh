import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Track if credentials are missing (for error display)
export const hasValidSupabaseCredentials = !!(supabaseUrl && supabaseAnonKey);

if (!hasValidSupabaseCredentials) {
  console.error("⚠️ Missing Supabase environment variables. Please check your .env file.");
  console.error("VITE_SUPABASE_URL:", supabaseUrl ? "Set" : "Missing");
  console.error("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "Set" : "Missing");
  console.error("💡 Add these to your .env file in the project root:");
  console.error("   VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.error("   VITE_SUPABASE_ANON_KEY=your-anon-key-here");
}

// IMPORTANT: keep Database typing OFF until you login + regenerate types.
// Otherwise .from('votes') becomes `never` and you get hundreds of TS errors.
export const supabase = hasValidSupabaseCredentials
  ? createClient<any>(supabaseUrl, supabaseAnonKey)
  : createClient<any>(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );