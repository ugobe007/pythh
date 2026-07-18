# Spec — `post_signup_activation_path`: Guard signed-in wizard UX end-to-end

> P0 — promoted after production regressions (dead "Go back to unlocks", wizard loop, stale Vercel builds).
> API smoke (`test:wizard-smoke`) stayed green while founders could not complete Act 2→3 handoff.

## Problem

Founders who **do** sign up hit a separate funnel that agents were not watching:

| Stage | What broke | What agents saw |
|-------|-----------|-----------------|
| Preview → signup | Looping wizard, competing CTAs | `founder_signup_started` (when wired) |
| Signup → activate | Missing imports, wrong match shape | Nothing (no E2E) |
| Activate → Round tab | Unlock intro blocking Start outreach | API 200 on `/gaps` |
| **Go back to unlocks** | Dead navigate / infinite spinner | **Nothing** |

Agents optimized **event counts** for anonymous preview traffic. Post-signup wizard is **client-side React state** — invisible to heartbeat until 2026-07-18.

## Target user

Founders with a saved startup who click **Start outreach** or land on wizard **Round** tab with locked outreach.

## Success metric

| Metric | Baseline | Target | Window |
|--------|----------|--------|--------|
| `test:wizard-e2e` CI pass rate | 0% (not run) | 100% on `main` | daily |
| `wizard_unlock_flow_started` in probe | not emitted | logged every heartbeat | 48h |
| Prod `pythh-build` SHA vs `main` | drift undetected | match within 15 min of deploy | every push |
| Human reports of dead unlock CTA | >0 | 0 | 14d |

## MVP scope (shipped 2026-07-18)

**In scope:**
1. **Playwright E2E** — `tests/wizard-unlock-funnel.spec.ts` + `scripts/lib/wizardUnlockProbe.mjs`
2. **Heartbeat extension** — wizard UI step + required `wizard_unlock_flow_started` verification
3. **Deploy SHA gate** — `scripts/verify-prod-build-sha.mjs` in Vercel deploy workflow
4. **Agent mandate** — product/growth loops run `test:wizard-e2e`; ship checks block on failure

**Out of scope:** Full email signup in E2E (use API-resolved startup + wizard deep link); mobile viewport matrix.

## Agent run checklist

When this opportunity is active, agents **must** before shipping wizard/funnel edits:

```bash
npm run test:wizard-smoke
npm run test:wizard-e2e
npm run check:deploy-sha   # when verifying prod
```

If E2E fails, fix the handoff in `site/pages/Wizard.tsx` / `RoundAutomation.tsx` — do not ship copy-only tweaks.

## Related

- `preview_to_signup_conversion` — upstream leak
- `match_engagement_instrumentation` — activate page intros
- Event: `wizard_unlock_flow_started` (ai_logs)
