import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const target = process.argv[2]; // weights_version OR "clear"

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

if (!target) {
  console.error('Usage: node scripts/god-rollback.js <weights_version|clear>');
  console.error('Example: node scripts/god-rollback.js god_v1_initial');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const override = target === "clear" ? null : target;

// Validate target exists
if (override) {
  const { data, error } = await supabase
    .from("god_weight_versions")
    .select("weights_version")
    .eq("weights_version", override)
    .maybeSingle();

  if (error || !data) {
    console.error(`❌ weights_version not found: ${override}`);
    process.exit(1);
  }
}

const { error } = await supabase
  .from("god_runtime_config")
  .update({ override_weights_version: override })
  .eq("id", 1);

if (error) {
  console.error("❌ Failed to set override", error);
  process.exit(1);
}

console.log(`✅ Rollback complete: override_weights_version = ${override ?? "null (cleared)"}`);

// Print current runtime
const { data: rt } = await supabase.rpc("get_god_runtime");
console.log("\nCurrent runtime:");
console.log(JSON.stringify(rt?.[0], null, 2));
