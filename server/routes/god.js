/**
 * GOD Score Guardrails API Routes
 * CommonJS module for Express server compatibility
 */

const express = require('express');
const { getSupabaseClient } = require('../lib/supabaseClient');

const router = express.Router();

router.get("/runtime", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_god_runtime");
    if (error) return res.status(500).json({ error: "RPC_ERROR", details: error });
    return res.json(data?.[0] ?? null);
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

router.get("/explain/:startupId", async (req, res) => {
  try {
    const { startupId } = req.params;
    const weightsVersion = req.query.weights_version || null;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("get_god_explain", {
      p_startup_id: startupId,
      p_weights_version: weightsVersion,
    });

    if (error) return res.status(500).json({ error: "RPC_ERROR", details: error });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

async function assertWeightsVersionExists(version) {
  if (!version) return true;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("god_weight_versions")
    .select("weights_version")
    .eq("weights_version", version)
    .maybeSingle();
  return !error && !!data;
}

router.post("/override", async (req, res) => {
  try {
    const { override_weights_version } = req.body || {};

    if (override_weights_version && !(await assertWeightsVersionExists(override_weights_version))) {
      return res.status(400).json({ error: "UNKNOWN_WEIGHTS_VERSION" });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("god_runtime_config")
      .update({ override_weights_version })
      .eq("id", 1);

    if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
    return res.json({ ok: true, override_weights_version });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

router.post("/activate", async (req, res) => {
  try {
    const { active_weights_version } = req.body || {};
    if (!active_weights_version) return res.status(400).json({ error: "MISSING_ACTIVE_VERSION" });

    if (!(await assertWeightsVersionExists(active_weights_version))) {
      return res.status(400).json({ error: "UNKNOWN_WEIGHTS_VERSION" });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("god_runtime_config")
      .update({ active_weights_version })
      .eq("id", 1);

    if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
    return res.json({ ok: true, active_weights_version });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

router.post("/freeze", async (req, res) => {
  try {
    const { freeze } = req.body || {};
    if (typeof freeze !== "boolean") return res.status(400).json({ error: "INVALID_FREEZE" });

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("god_runtime_config").update({ freeze }).eq("id", 1);
    if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
    return res.json({ ok: true, freeze });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

module.exports = router;
