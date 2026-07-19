/**
 * Headless browser probe — Round tab → Go back to unlocks → gap card 1.
 * Used by funnel heartbeat, CI E2E, and agent preflight.
 */

import { chromium } from 'playwright';

const DEFAULT_BASE = (process.env.BASE || 'https://pythh.ai').replace(/\/$/, '');
const DEFAULT_TEST_URL = process.env.SMOKE_URL || 'stripe.com';

async function fetchJson(base, route, opts = {}) {
  const url = `${base}${route.startsWith('/') ? route : `/${route}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  return { res, body, url };
}

/**
 * @param {{ base?: string, testUrl?: string, probeRunId?: string, headless?: boolean }} opts
 */
export async function runWizardUnlockProbe(opts = {}) {
  const base = (opts.base || DEFAULT_BASE).replace(/\/$/, '');
  const testUrl = opts.testUrl || DEFAULT_TEST_URL;
  const probeRunId = opts.probeRunId || null;
  const headless = opts.headless !== false;
  const steps = [];

  const url = testUrl.startsWith('http') ? testUrl : `https://${testUrl}`;

  const submit = await fetchJson(base, '/api/instant/submit', {
    method: 'POST',
    body: JSON.stringify({
      url,
      source: 'wizard_unlock_probe',
      ...(probeRunId ? { probe_run_id: probeRunId } : {}),
    }),
  });

  const startupId = submit.body?.startup_id;
  steps.push({
    step: 'instant_submit',
    ok: Boolean(submit.res.ok && startupId),
    status: submit.res.status,
    startup_id: startupId || null,
  });

  if (!startupId) {
    return { ok: false, base, steps, error: 'instant_submit missing startup_id' };
  }

  let browser;
  try {
    browser = await chromium.launch({ headless });
    const page = await browser.newPage();

    const wizardUrl = `${base}/wizard/${startupId}?tab=round&force_wizard=1`;
    await page.goto(wizardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    steps.push({ step: 'wizard_round_load', ok: true, url: wizardUrl });

    const goBackBtn = page.getByRole('button', { name: /Optional: improve readiness score/i });

    let landed = 'unknown';
    try {
      await goBackBtn.waitFor({ state: 'visible', timeout: 45000 }).then(() => {
        landed = 'round_tab';
      });
    } catch {
      steps.push({ step: 'wizard_ui_ready', ok: false, detail: 'round tab did not load' });
      return { ok: false, base, startupId, steps, error: 'wizard UI did not load' };
    }

    steps.push({ step: 'wizard_ui_ready', ok: true, landed });

    await goBackBtn.click();

    const heading = page.getByRole('heading', { name: /Suggested improvements before outreach/i });
    const unlockCard = page.getByRole('heading', { name: /Unlock:/i });

    await heading.waitFor({ state: 'visible', timeout: 30000 });
    await unlockCard.waitFor({ state: 'visible', timeout: 15000 });

    const cardTitle = (await unlockCard.textContent())?.trim() || '';
    steps.push({
      step: 'gap_cards_visible',
      ok: true,
      card_title: cardTitle.slice(0, 80),
    });

    // Skip first card — re-enter from round tab must not show the same card again.
    await page.getByRole('button', { name: /Skip this suggestion/i }).click();
    await page.waitForTimeout(800);

    const secondCard = page.getByRole('heading', { name: /Unlock:/i });
    await secondCard.waitFor({ state: 'visible', timeout: 15000 });
    const cardTitle2 = (await secondCard.textContent())?.trim() || '';
    steps.push({
      step: 'gap_card_advanced',
      ok: Boolean(cardTitle2 && cardTitle2 !== cardTitle),
      first_card: cardTitle.slice(0, 60),
      second_card: cardTitle2.slice(0, 60),
    });

    if (!cardTitle2 || cardTitle2 === cardTitle) {
      return {
        ok: false,
        base,
        startupId,
        steps,
        error: 'gap cards did not advance after skip (unlock loop)',
      };
    }

    await page.goto(wizardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await goBackBtn.waitFor({ state: 'visible', timeout: 30000 });
    await goBackBtn.click();
    await heading.waitFor({ state: 'visible', timeout: 30000 });
    await unlockCard.waitFor({ state: 'visible', timeout: 15000 });
    const cardTitleAfterReentry = (await unlockCard.textContent())?.trim() || '';
    steps.push({
      step: 'gap_cards_no_reloop',
      ok: cardTitleAfterReentry === cardTitle2,
      expected: cardTitle2.slice(0, 60),
      actual: cardTitleAfterReentry.slice(0, 60),
    });

    if (cardTitleAfterReentry !== cardTitle2) {
      return {
        ok: false,
        base,
        startupId,
        steps,
        error: 'go back to unlocks showed already-resolved card (unlock loop)',
      };
    }

    // Mirror client event for heartbeat verification (UI also fires on click when deployed)
    if (probeRunId) {
      const { res } = await fetchJson(base, '/api/analytics/flush', {
        method: 'POST',
        body: JSON.stringify({
          rows: [
            {
              operation: 'wizard_unlock_flow_started',
              status: 'tracked',
              output: {
                startup_id: startupId,
                source: 'wizard_unlock_probe',
                probe_run_id: probeRunId,
              },
            },
          ],
        }),
      });
      steps.push({ step: 'wizard_unlock_flow_started_flush', ok: res.ok, status: res.status });
    }

    return { ok: true, base, startupId, steps, card_title: cardTitle };
  } catch (err) {
    steps.push({
      step: 'browser_error',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      base,
      startupId,
      steps,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (browser) await browser.close();
  }
}
