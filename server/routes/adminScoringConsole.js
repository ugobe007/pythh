/**
 * Admin scoring console — GOD manager + signal summary (REST for main app).
 * Mirrors NEW_pythh_site tRPC admin procedures.
 */

const express = require("express");
const router = express.Router();
const { getSupabaseClient, paginateStartupUploads } = require("../lib/supabaseClient");
const {
  getDefaultSignalWeightConfig,
  loadSignalWeightConfig,
  saveSignalWeightConfig,
  validateSignalWeightConfig,
  setCachedSignalWeightConfig,
  DIMENSION_KEYS,
} = require("../../lib/signalWeightConfig");
const { FOUNDER_CULTURE_CLASSES, CLASS_LABELS } = require("../../lib/founderVoiceAnalysis");

async function safeQuery(run) {
  try {
    return await run();
  } catch {
    return { data: null, error: { message: "query failed" } };
  }
}

router.get("/god-score-summary", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();

    const startups = await paginateStartupUploads(
      supabase,
      "total_god_score, status",
      (q) => q
    );

    const buckets = {
      unscored: 0,
      "0–20": 0,
      "20–40": 0,
      "40–60": 0,
      "60–80": 0,
      "80–100": 0,
    };
    let sum = 0;
    let count = 0;
    let max = 0;
    let min = 100;
    let approvedSum = 0;
    let approvedCount = 0;

    const roundAvg = (total, n) => (n ? Math.round((total / n) * 100) / 100 : null);

    for (const row of startups ?? []) {
      const s = row.total_god_score;
      if (s == null) {
        buckets.unscored++;
        continue;
      }
      count++;
      sum += s;
      if (s > max) max = s;
      if (s < min) min = s;
      if (row.status === "approved") {
        approvedCount++;
        approvedSum += s;
      }
      if (s < 20) buckets["0–20"]++;
      else if (s < 40) buckets["20–40"]++;
      else if (s < 60) buckets["40–60"]++;
      else if (s < 80) buckets["60–80"]++;
      else buckets["80–100"]++;
    }

    const distribution = Object.entries(buckets).map(([bucket, cnt]) => ({ bucket, cnt: String(cnt) }));

    const runtimeRes = await safeQuery(() =>
      supabase.from("god_runtime_config").select("*").limit(1).maybeSingle()
    );

    const weightHistoryRes = await safeQuery(() =>
      supabase
        .from("god_weight_versions")
        .select("weights_version, status, weights, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(10)
    );

    res.json({
      distribution,
      runtime: runtimeRes?.data ?? null,
      weightHistory: weightHistoryRes?.data ?? [],
      stats: {
        avg: count ? String(roundAvg(sum, count)) : null,
        approved_avg: approvedCount ? String(roundAvg(approvedSum, approvedCount)) : null,
        max: count ? String(max) : null,
        min: count ? String(min) : null,
        total: String(count),
        approved_total: String(approvedCount),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/god-freeze", express.json(), async (req, res) => {
  try {
    const freeze = Boolean(req.body?.freeze);
    const supabase = getSupabaseClient();
    const { data: row } = await supabase.from("god_runtime_config").select("id").limit(1).maybeSingle();
    if (!row?.id) {
      return res.status(404).json({ error: "god_runtime_config row not found" });
    }
    const { error } = await supabase
      .from("god_runtime_config")
      .update({ freeze, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw error;
    res.json({ ok: true, freeze });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/signal-summary", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data: scores, error: scErr } = await supabase
      .from("startup_signal_scores")
      .select(
        "startup_id, signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity, as_of"
      );
    if (scErr) throw scErr;

    const rows = scores ?? [];
    let sum = 0;
    for (const r of rows) sum += Number(r.signals_total) || 0;
    const summary = {
      avg_total: rows.length ? String(Math.round((sum / rows.length) * 100) / 100) : null,
      count: String(rows.length),
    };

    const startupIds = [...new Set(rows.map((r) => r.startup_id).filter(Boolean))];
    let nameById = {};
    if (startupIds.length) {
      const { data: startups } = await supabase
        .from("startup_uploads")
        .select("id, name, company_name")
        .in("id", startupIds.slice(0, 500));
      nameById = Object.fromEntries(
        (startups ?? []).map((s) => [s.id, s.name ?? s.company_name ?? s.id])
      );
    }

    const enriched = rows.map((r) => ({
      ...r,
      company_name: nameById[r.startup_id] ?? r.startup_id,
    }));

    enriched.sort((a, b) => (Number(b.signals_total) || 0) - (Number(a.signals_total) || 0));

    const recentHistoryRes = await safeQuery(() =>
      supabase
        .from("signal_history")
        .select("startup_id, dimension, old_value, new_value, applied, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    );

    const cultureClassTotals = Object.fromEntries(FOUNDER_CULTURE_CLASSES.map((c) => [c, 0]));
    const cultureEventsRes = await safeQuery(() =>
      supabase.from("pythh_signal_events").select("primary_signal").in("primary_signal", FOUNDER_CULTURE_CLASSES)
    );
    for (const ev of cultureEventsRes?.data ?? []) {
      if (cultureClassTotals[ev.primary_signal] != null) cultureClassTotals[ev.primary_signal]++;
    }

    const { data: debugScores } = await supabase.from("startup_signal_scores").select("startup_id, debug").limit(5000);
    let teamCreditSum = 0;
    let teamCreditN = 0;
    let cultureSum = 0;
    let cultureN = 0;
    const cultureLeaders = [];
    for (const r of debugScores ?? []) {
      const fv = r.debug?.founder_voice;
      if (!fv) continue;
      if (typeof fv.teamCreditRatio === "number") {
        teamCreditSum += fv.teamCreditRatio;
        teamCreditN++;
      }
      if (typeof fv.cultureScore === "number") {
        cultureSum += fv.cultureScore;
        cultureN++;
        cultureLeaders.push({ startup_id: r.startup_id, cultureScore: fv.cultureScore, teamCreditRatio: fv.teamCreditRatio ?? null });
      }
    }
    cultureLeaders.sort((a, b) => b.cultureScore - a.cultureScore);

    const founderVoice = {
      classTotals: cultureClassTotals,
      classLabels: CLASS_LABELS,
      avgTeamCreditRatio: teamCreditN ? Math.round((teamCreditSum / teamCreditN) * 100) / 100 : null,
      avgCultureScore: cultureN ? Math.round((cultureSum / cultureN) * 100) / 100 : null,
      startupsWithVoiceMetrics: cultureN,
    };

    res.json({
      summary,
      topStartups: enriched.slice(0, 15),
      bottomStartups: [...enriched].sort((a, b) => (Number(a.signals_total) || 0) - (Number(b.signals_total) || 0)).slice(0, 10),
      recentHistory: recentHistoryRes?.data ?? [],
      founderVoice,
      topCultureStartups: cultureLeaders.slice(0, 10),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/signal-weights", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    const defaults = getDefaultSignalWeightConfig();
    const active = await loadSignalWeightConfig(supabase);

    const rowRes = await safeQuery(() =>
      supabase.from("signal_weight_config").select("updated_at, updated_by, version").eq("id", 1).maybeSingle()
    );

    const historyRes = await safeQuery(() =>
      supabase
        .from("signal_weight_history")
        .select("id, version, comment, created_at, created_by")
        .order("created_at", { ascending: false })
        .limit(15)
    );

    res.json({
      defaults,
      active,
      meta: rowRes?.data ?? null,
      history: historyRes?.data ?? [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/signal-weights", express.json(), async (req, res) => {
  try {
    const config = req.body?.config;
    if (!config) return res.status(400).json({ error: "config required" });

    const validation = validateSignalWeightConfig(config);
    if (!validation.ok) {
      return res.status(400).json({ error: "Validation failed", errors: validation.errors });
    }

    const supabase = getSupabaseClient();
    const result = await saveSignalWeightConfig(supabase, config, {
      comment: req.body?.comment || "Admin save via signal-weight editor",
      updatedBy: req.body?.updatedBy || "admin",
    });

    if (!result.ok) {
      return res.status(400).json({ error: "Save failed", errors: result.errors });
    }

    res.json({ ok: true, active: result.config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/signal-weights/reset", express.json(), async (_req, res) => {
  try {
    const defaults = getDefaultSignalWeightConfig();
    const supabase = getSupabaseClient();
    const result = await saveSignalWeightConfig(supabase, defaults, {
      comment: "Reset to factory defaults",
      updatedBy: "admin",
    });
    if (!result.ok) {
      return res.status(400).json({ error: "Reset failed", errors: result.errors });
    }
    res.json({ ok: true, active: result.config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Dimension keys for clients */
router.get("/signal-weights/schema", (_req, res) => {
  res.json({ dimensionKeys: DIMENSION_KEYS });
});

module.exports = router;
