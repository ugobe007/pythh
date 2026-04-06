import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or service role key");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const goldenPath = path.resolve("golden/god_golden_set.json");
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

let failed = 0;

console.log(`\n🧪 Running GOD Score Golden Set Tests`);
console.log(`   Version: ${golden.weights_version}`);
console.log(`   Cases: ${golden.cases.length}\n`);

for (const c of golden.cases) {
  let explain;
  let fromFallback = false;

  const { data, error } = await supabase.rpc("get_god_explain", {
    p_startup_id: c.startup_id,
    p_weights_version: golden.weights_version,
  });

  if (error) {
    console.warn(`[WARN] RPC error for ${c.startup_id}, falling back to startup_uploads`, error.message || error);
  }

  if (data?.found) {
    explain = data.explain;
  } else {
    // Fallback path: use startup_uploads as the source of truth
    const { data: startup, error: startupError } = await supabase
      .from("startup_uploads")
      .select(
        "name, total_god_score, team_score, traction_score, market_score, product_score, vision_score"
      )
      .eq("id", c.startup_id)
      .maybeSingle();

    if (startupError || !startup || startup.total_god_score == null) {
      failed++;
      console.error(
        `[FAIL] No explanation or total_god_score found for ${c.startup_id} @ ${golden.weights_version}`
      );
      continue;
    }

    explain = {
      total_score: startup.total_god_score,
      base_total_score: startup.total_god_score,
      signals_bonus: 0,
      component_scores: {
        team: startup.team_score,
        traction: startup.traction_score,
        market: startup.market_score,
        product: startup.product_score,
        vision: startup.vision_score,
      },
    };
    fromFallback = true;
  }
  const total = Number(explain.total_score ?? NaN);
  const base = Number(explain.base_total_score ?? NaN);
  const signals = Number(explain.signals_bonus ?? NaN);
  
  if (!Number.isFinite(total)) {
    failed++;
    console.error(`[FAIL] total_score missing/invalid for ${c.startup_id}`);
    continue;
  }

  // Validate score range
  if (total < c.min_total || total > c.max_total) {
    failed++;
    console.error(
      `[FAIL] ${c.name}: total_score ${total} not in [${c.min_total}, ${c.max_total}]`
    );
  }

  // CRITICAL INVARIANT: signals_bonus must be in [0, 10]
  if (Number.isFinite(signals) && signals > 10.0001) {
    failed++;
    console.error(
      `[FAIL] ${c.name}: signals_bonus ${signals} > 10`
    );
  }

  // CRITICAL INVARIANT: signal delta (total - base) must be <= 10
  if (Number.isFinite(base)) {
    const delta = total - base;
    if (delta > 10.0001) {
      failed++;
      console.error(
        `[FAIL] ${c.name}: signal delta ${delta} > 10`
      );
    }
  }

  const comps = explain.component_scores || {};
  for (const k of c.must_include_components || []) {
    if (!(k in comps)) {
      failed++;
      console.error(`[FAIL] ${c.name}: missing component "${k}"`);
    }
  }

  const sourceLabel = fromFallback ? "startup_uploads" : "god_score_explanations";
  console.log(`[OK] ${c.name} [${sourceLabel}]: total=${total}, base=${base}, signals=${signals}`);
}

if (failed > 0) {
  console.error(`\n❌ Golden set failed: ${failed} checks failed`);
  process.exit(1);
}

console.log("\n✅ Golden set passed");
