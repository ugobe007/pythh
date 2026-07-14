/**
 * Agent ship policy — when agents may commit code vs report-only.
 */

export function parseAgentShipFlags(argv = process.argv) {
  const SHIP =
    argv.includes('--ship') ||
    process.env.AGENT_ALLOW_SHIP === '1' ||
    process.env.GITHUB_ACTIONS === 'true';
  const PUSH = (argv.includes('--push') || process.env.AGENT_ALLOW_PUSH === '1') && SHIP;
  return { SHIP, PUSH };
}

export function buildShipPolicyBlock({ SHIP, PUSH } = {}) {
  if (PUSH) {
    return `
## Ship policy (PUSH enabled — you MUST ship fixes)
You MUST implement at least one measurable funnel/instrumentation/UX fix when orchestrator weakest stage is clear.
Edit site/, server/, lib/, or scripts/. Run npm run test:wizard-smoke and npm run check:server after code changes.
Then: git add the changed files, git commit with a concise message, and git push to the current branch.
List every changed file in the report JSON under code_changes.files.
Do NOT end the run with "not committed" or "not pushed" if tests pass.
Do not deploy Fly/Vercel unless the prompt explicitly requests deploy.`;
  }
  if (SHIP) {
    return `
## Ship policy (COMMIT enabled — you MUST commit fixes)
You MUST implement at least one measurable funnel/instrumentation/UX fix when orchestrator weakest stage is clear.
Edit site/, server/, lib/, or scripts/. Run npm run test:wizard-smoke and npm run check:server after code changes.
Then: git add and git commit locally with a concise message. CI will open a PR for any uncommitted work.
List every changed file in the report JSON under code_changes.files.
Do NOT end the run with "not committed" if tests pass.
Do not git push unless invoked with --push.`;
  }
  return `
## Ship policy (report-only — local/dev only)
You MAY edit code in site/ and server/ for funnel instrumentation, hero→preview routing, and conversion fixes.
Run npm run test:wizard-smoke and npm run check:server after code changes.
Do not git commit or push unless invoked with --ship (or --push).
In CI autopilot, ship is always enabled — this block should not appear in production runs.`;
}

export function buildFunnelMandateBlock() {
  return `
## Funnel mandate (human-only metrics)
- Raw url_submitted is dominated by instant_submit API noise — NEVER optimize on raw totals.
- Use human_funnel from conversion-funnel snapshot: page_view, url_submitted (human), instant_matches_viewed (UI/matches_preview only).
- Weakest stage is usually Visit→preview: route hero + /find-investors to /matches?url=; ensure InstantMatchPreview fires instant_matches_viewed with source=matches_preview.
- Server preview API must NOT inflate instant_matches_viewed (preview_api_served is diagnostic only).`;
}
