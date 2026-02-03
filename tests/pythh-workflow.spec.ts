import { test, expect } from '@playwright/test';

/**
 * PYTHH CANONICAL WORKFLOW TEST
 * ==============================
 * Sacrament:
 * Submit URL → /signals alias redirect → /app/radar → engine UI appears
 *
 * If this fails, the core conversion machine is broken.
 */

test.describe('Pythh URL Submission Workflow', () => {
  
  test('Homepage URL submission redirects to /app/radar', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');
    
    // 2. Fill URL input (using stable test ID)
    const urlInput = page.getByTestId('home-url-input');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('stripe.com');
    
    // 3. Click submit and wait for navigation
    await page.getByTestId('home-analyze-button').click();
    
    // 4. CRITICAL: Verify redirect to /app/radar (canonical route)
    await expect(page).toHaveURL(/\/app\/radar\?url=/, { timeout: 5000 });
    
    // 5. Verify canonical radar page loads (stable anchor)
    await expect(page.getByTestId('radar-page')).toBeVisible();
    
    // 6. Wait for results (either match table or not found)
    await Promise.race([
      page.getByTestId('match-table').waitFor({ timeout: 25000 }),
      page.getByTestId('radar-not-found').waitFor({ timeout: 25000 }),
    ]);
    
    // 7. Verify NOT on wrong page (static signals feed)
    await expect(page.locator('h1:has-text("Market Signals")')).toHaveCount(0);
    await expect(page.locator('text=/agent_feed_signals/i')).toHaveCount(0);
  });
  
  test('Direct /signals access redirects to /app/radar', async ({ page }) => {
    // Navigate directly to /signals with URL param
    await page.goto('/signals?url=stripe.com');
    
    // Should immediately redirect to /app/radar
    await expect(page).toHaveURL(/\/app\/radar\?url=stripe\.com/, { timeout: 5000 });
    
    // Verify canonical radar page (not static page)
    await expect(page.getByTestId('radar-page')).toBeVisible();
  });
  
  test('Direct /signals-radar access redirects to /app/radar', async ({ page }) => {
    // Navigate directly to legacy /signals-radar route
    await page.goto('/signals-radar?url=openai.com');
    
    // Should redirect to canonical /app/radar
    await expect(page).toHaveURL(/\/app\/radar\?url=openai\.com/, { timeout: 5000 });
    
    // Verify engine loads
    await expect(page.getByTestId('radar-page')).toBeVisible();
  });
  
  test('/app/radar without params shows "missing context" screen', async ({ page }) => {
    // Navigate to /app/radar with no URL or ID params
    await page.goto('/app/radar');
    
    // Should load radar page structure
    await expect(page.getByTestId('radar-page')).toBeVisible();
    
    // Should show clear empty state (runtime invariant check)
    await expect(page.locator('text=/No Startup Selected|Analyze a startup/i')).toBeVisible();
    
    // Should offer CTA back to homepage
    const analyzeButton = page.locator('button:has-text("Analyze"), a:has-text("Analyze")');
    await expect(analyzeButton).toBeVisible();
    
    // Click CTA should go to homepage
    await analyzeButton.click();
    await expect(page).toHaveURL('/');
  });
  
});

test.describe('Route Conflict Prevention (Tripwire)', () => {
  
  test('Signals route is redirect-only (catches IA drift)', async ({ page }) => {
    // This test catches the exact bug that broke pythh:
    // Someone accidentally adds content at /signals instead of alias redirect
    
    await page.goto('/signals?url=test.com');
    
    // Must land on canonical engine route
    await page.waitForURL(/\/app\/radar\?url=/, { timeout: 3000 });
    
    // Must show canonical radar anchor
    await expect(page.getByTestId('radar-page')).toBeVisible();
    
    // Must never show "static signals" artifacts
    await expect(page.locator('text=/Market Signals/i')).toHaveCount(0);
    await expect(page.locator('text=/agent_feed_signals/i')).toHaveCount(0);
  });
  
});
