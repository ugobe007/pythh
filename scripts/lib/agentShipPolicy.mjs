/**
 * Agent ship policy — when agents may commit code vs report-only.
 */

export function parseAgentShipFlags(argv = process.argv) {
  const SHIP = argv.includes('--ship') || process.env.AGENT_ALLOW_SHIP === '1';
  const PUSH = argv.includes('--push') && SHIP;
  return { SHIP, PUSH };
}

export function buildShipPolicyBlock({ SHIP, PUSH } = {}) {
  if (PUSH) {
    return `
## Ship policy (PUSH enabled)
You MAY implement funnel/instrumentation/UX fixes in site/ and server/.
After npm run test:wizard-smoke and npm run conversion:funnel pass, git commit AND git push to main with a concise message.
Do not deploy to Fly/Vercel unless explicitly asked.`;
  }
  if (SHIP) {
    return `
## Ship policy (COMMIT enabled)
You MAY implement funnel/instrumentation/UX fixes in site/ and server/.
After npm run test:wizard-smoke and npm run conversion:funnel pass, git commit locally with a concise message.
Do not git push or deploy unless invoked with --push.`;
  }
  return `
## Ship policy (implement + test)
You MAY edit code in site/ and server/ for funnel instrumentation, hero→preview routing, and conversion fixes.
Run npm run test:wizard-smoke and npm run conversion:funnel after code changes.
Do not git commit or push unless invoked with --ship (or --push).`;
}

export function buildFunnelMandateBlock() {
  return `
## Funnel mandate (human-only metrics)
- Raw url_submitted is dominated by instant_submit API noise — NEVER optimize on raw totals.
- Use human_funnel from conversion-funnel snapshot: page_view, url_submitted (human), instant_matches_viewed (UI/matches_preview only).
- Weakest stage is usually Visit→preview: route hero + /find-investors to /matches?url=; ensure InstantMatchPreview fires instant_matches_viewed with source=matches_preview.
- Server preview API must NOT inflate instant_matches_viewed (preview_api_served is diagnostic only).`;
}
