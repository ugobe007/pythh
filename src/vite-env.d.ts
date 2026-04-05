/// <reference types="vite/client" />

interface Window {
  /** Injected in production index.html so Supabase URL/anon key match Fly runtime secrets. */
  __PYTHH_RUNTIME__?: { supabaseUrl?: string; supabaseAnonKey?: string };
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENAI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
