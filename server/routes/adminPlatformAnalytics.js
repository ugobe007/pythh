/**
 * GET /api/admin/platform-analytics — site activity for admin analytics page
 */

const express = require("express");
const router = express.Router();
const { getSupabaseClient } = require("../lib/supabaseClient");

router.get("/platform-analytics", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString();

    const { data: eventRows, error: evErr } = await supabase
      .from("events")
      .select("event_name, page, created_at")
      .gte("created_at", cutoffISO);
    if (evErr) throw evErr;

    const eventCounts = new Map();
    const pageCounts = new Map();
    for (const row of eventRows ?? []) {
      eventCounts.set(row.event_name, (eventCounts.get(row.event_name) ?? 0) + 1);
      if (row.event_name === "page_viewed" && row.page) {
        pageCounts.set(row.page, (pageCounts.get(row.page) ?? 0) + 1);
      }
    }

    const eventBreakdown = [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([event_name, cnt]) => ({ event_name, cnt: String(cnt) }));

    const pageViews = [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([page, cnt]) => ({ page, cnt: String(cnt) }));

    const [{ data: recentProfiles, error: recentErr }, { data: allProfiles, error: allErr }] =
      await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", cutoffISO),
        supabase.from("profiles").select("created_at, updated_at, analysis_count"),
      ]);
    if (recentErr) throw recentErr;
    if (allErr) throw allErr;

    const dailyMap = new Map();
    for (const p of recentProfiles ?? []) {
      const day = String(p.created_at).slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailySignups = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cnt]) => ({ day, cnt: String(cnt) }));

    const totalUsers = allProfiles?.length ?? 0;
    let analysisSum = 0;
    let active30d = 0;
    const activeCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const p of allProfiles ?? []) {
      analysisSum += Number(p.analysis_count) || 0;
      if (new Date(p.updated_at).getTime() >= activeCutoff) active30d++;
    }

    res.json({
      eventBreakdown,
      dailySignups,
      pageViews,
      usageStats: {
        total_users: String(totalUsers),
        avg_analysis_count: totalUsers
          ? String(Math.round((analysisSum / totalUsers) * 10) / 10)
          : "0",
        active_30d: String(active30d),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
