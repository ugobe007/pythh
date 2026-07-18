import { test, expect } from '@playwright/test';

/**
 * Pythh founder funnel — signed-in wizard path (Act 3 → Act 2 handoff).
 * Runs against PLAYWRIGHT_BASE_URL (default prod in CI: https://pythh.ai).
 */

const TEST_URL = process.env.SMOKE_URL || 'stripe.com';

test.describe('Wizard unlock funnel', () => {
  test('Round tab → continue unlocks opens gap card 1', async ({ page, request, baseURL }) => {
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

    const pipelineBtn = page.getByRole('button', { name: /View my investor pipeline/i });
    const goBackBtn = page.getByRole('button', { name: /Go back to unlocks/i });

    await Promise.race([
      pipelineBtn.waitFor({ state: 'visible', timeout: 35000 }),
      goBackBtn.waitFor({ state: 'visible', timeout: 35000 }),
    ]);

    if (await pipelineBtn.isVisible()) {
      await pipelineBtn.click();
      await expect(goBackBtn).toBeVisible({ timeout: 20000 });
    }

    await goBackBtn.click();

    await expect(page.getByRole('heading', { name: /What will you unlock/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('heading', { name: /Unlock:/i })).toBeVisible({ timeout: 10000 });
  });
});
