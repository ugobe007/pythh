/**
 * Shared context for LLM agent loops — orchestrator brief + conversion priorities.
 */

import fs from 'node:fs';
import path from 'node:path';

export function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function latestReportIn(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((f) => {
      const full = path.join(dir, f);
      const data = readJson(full);
      return { file: f, data, mtime: fs.statSync(full).mtimeMs };
    })
    .filter((x) => x.data)
    .sort((a, b) => {
      const ta = a.data.generated_at || a.data.date || '';
      const tb = b.data.generated_at || b.data.date || '';
      if (ta && tb) return tb.localeCompare(ta);
      return b.mtime - a.mtime;
    });
  return files[0]?.data ?? null;
}

export function buildAgentPrioritiesBlock(repoRoot) {
  const reportsDir = path.join(repoRoot, 'reports');
  const brief = latestReportIn(reportsDir, 'orchestrator-brief-');
  const funnel = latestReportIn(reportsDir, 'conversion-funnel-');
  const northStar = readJson(path.join(repoRoot, 'agents/north-star.json'));

  const lines = [];
  if (brief?.weakest_stage) {
    lines.push(
      `- Weakest funnel stage: ${brief.weakest_stage.label} (${brief.weakest_stage.score ?? '?'}%) — ${brief.weakest_stage.problem}`,
    );
  }
  if (brief?.todays_focus?.loops_to_consider?.length) {
    lines.push(`- Loops to consider: ${brief.todays_focus.loops_to_consider.join(', ')}`);
  }
  const priorities = funnel?.agent_priorities?.length
    ? funnel.agent_priorities
    : northStar?.agent_priorities || [];
  if (priorities.length) {
    lines.push('- Agent priorities (from live funnel):');
    for (const p of priorities) lines.push(`  · ${p}`);
  }
  if (funnel?.stages) {
    const s = funnel.stages;
    lines.push(
      `- 7d snapshot: page_view=${s.page_view ?? 0}, url_submitted=${s.url_submitted ?? 0}, instant_matches_viewed=${s.instant_matches_viewed ?? 0}, match_intro=${s.match_intro_requested ?? 0}, return_7d=${s.return_visit_7d ?? 0}, pricing_viewed=${s.pricing_viewed ?? 0}`,
    );
  }
  return lines.length ? `\n\n## Live agent context (auto-injected)\n${lines.join('\n')}\n` : '';
}
