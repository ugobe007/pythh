import { test, expect } from '@playwright/test';

/**
 * Pythh founder funnel — signed-in wizard path (Act 3 → Act 2 handoff).
 * Runs against PLAYWRIGHT_BASE_URL (default prod in CI: https://pythh.ai).
 */

const TEST_URL = process.env.SMOKE_URL || 'stripe.com';

test.describe('Wizard improvement funnel', () => {
  test('Round tab → optional improvement opens the current evidence flow', async ({ page, request, baseURL }) => {
    const origin = (baseURL || 'https://pythh.ai').replace(/\/$/, '');
    const url = TEST_URL.startsWith('http') ? TEST_URL : `https://${TEST_URL}`;

    const submit = await request.post(`${origin}/api/instant/submit`, {
      data: { url, source: 'playwright_wizard_e2e' },
    });
    expect(submit.ok()).toBeTruthy();
    const body = (await submit.json()) as { startup_id?: string };
    const startupId = body.startup_id;
    expect(startupId).toBeTruthy();

    await page.goto(`/wizard/${startupId}?tab=round&force_wizard=1`);

    const goBackBtn = page.getByRole('button', {
      name: /Improve my outreach plan|Improve matches|Optional: improve readiness score/i,
    }).first();

    await expect(goBackBtn).toBeVisible({ timeout: 35000 });

    await goBackBtn.click();

    const evidencePanel = page.getByRole('heading', { name: /Add what Pythh could not find/i });
    const signupGate = page.getByRole('heading', {
      name: /Your investor shortlist is ready|Continue to investor outreach/i,
    });
    const legacyGapFlow = page.getByRole('heading', { name: /Suggested improvements before outreach/i });
    await expect(evidencePanel.or(signupGate).or(legacyGapFlow)).toBeVisible({ timeout: 30000 });

    if (await signupGate.isVisible()) {
      await expect(page.getByPlaceholder('you@yourstartup.com')).toBeVisible();
      await expect(page.getByRole('button', { name: /Continue with email/i })).toBeVisible();
    } else if (await evidencePanel.isVisible()) {
      await expect(page.getByRole('button', { name: /Save data & rerun match engine/i })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /Unlock:/i })).toBeVisible({ timeout: 10000 });
    }
  });
});
