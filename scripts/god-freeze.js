import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const on = process.argv[2]; // "true" or "false"

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

if (on !== "true" && on !== "false") {
  console.error("Usage: node scripts/god-freeze.js true|false");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const freeze = on === "true";

const { error } = await supabase
  .from("god_runtime_config")
  .update({ freeze })
  .eq("id", 1);

if (error) {
  console.error("❌ Failed to set freeze", error);
  process.exit(1);
}

console.log(`✅ Freeze ${freeze ? "ENABLED" : "DISABLED"}`);

// Print current runtime
const { data: rt } = await supabase.rpc("get_god_runtime");
console.log("\nCurrent runtime:");
console.log(JSON.stringify(rt?.[0], null, 2));
