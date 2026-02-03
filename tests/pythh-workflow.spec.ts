import { test, expect } from '@playwright/test';

/**
 * PYTHH CANONICAL WORKFLOW TEST
 * ==============================
 * This test ensures the "sacrament" workflow never breaks:
 * 
 * Submit URL → /signals redirect → /app/radar → results display
 * 
 * If this test fails, the core product value is broken.
 */

test.describe('Pythh URL Submission Workflow', () => {
  
  test('Homepage URL submission redirects to /app/radar', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');
    
    // 2. Verify input field exists
    const urlInput = page.locator('input[placeholder*="URL" i], input[placeholder*="startup" i], input[type="text"]').first();
    await expect(urlInput).toBeVisible();
    
    // 3. Submit URL
    await urlInput.fill('stripe.com');
    await page.click('button:has-text("Analyze"), button:has-text("Submit"), button:has-text("Get Signals")');
    
    // 4. CRITICAL: Verify redirect to /app/radar (not /signals or /signals-radar)
    await expect(page).toHaveURL(/\/app\/radar\?url=/);
    
    // 5. Verify loading state appears
    await expect(page.locator('text=/Resolving startup|Loading|Processing/i')).toBeVisible({ timeout: 3000 });
    
    // 6. Wait for results (either matches table or "not found" message)
    await Promise.race([
      page.locator('[data-testid="match-table"]').waitFor({ timeout: 20000 }),
      page.locator('text=/Live investor alignment|Matches|Signals/i').waitFor({ timeout: 20000 }),
      page.locator('text=/not found|no matches/i').waitFor({ timeout: 20000 }),
    ]);
    
    // 7. Verify NOT on wrong page (static signals feed)
    await expect(page.locator('h1:has-text("Market Signals")')).not.toBeVisible();
    await expect(page.locator('text=/agent_feed_signals/i')).not.toBeVisible();
  });
  
  test('Direct /signals access redirects to /app/radar', async ({ page }) => {
    // Navigate directly to /signals with URL param
    await page.goto('/signals?url=stripe.com');
    
    // Should immediately redirect to /app/radar
    await expect(page).toHaveURL(/\/app\/radar\?url=stripe\.com/);
    
    // Verify engine loads (not static page)
    await expect(page.locator('text=/Resolving startup|Loading|Processing/i')).toBeVisible({ timeout: 5000 });
  });
  
  test('Direct /signals-radar access redirects to /app/radar', async ({ page }) => {
    // Navigate directly to legacy /signals-radar route
    await page.goto('/signals-radar?url=openai.com');
    
    // Should redirect to canonical /app/radar
    await expect(page).toHaveURL(/\/app\/radar\?url=openai\.com/);
    
    // Verify engine loads
    await expect(page.locator('text=/Resolving|Loading/i')).toBeVisible({ timeout: 5000 });
  });
  
  test('/app/radar without params shows "missing context" screen', async ({ page }) => {
    // Navigate to /app/radar with no URL or ID params
    await page.goto('/app/radar');
    
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

test.describe('Route Conflict Prevention', () => {
  
  test('No duplicate /signals routes exist', async ({ page }) => {
    // This test catches the bug that broke pythh
    // If /signals renders static content instead of redirecting, this fails
    
    await page.goto('/signals?url=test.com');
    
    // Should redirect (URL changes)
    await page.waitForURL(/\/app\/radar/, { timeout: 3000 });
    
    // Verify NOT on static signals page
    await expect(page.locator('text=/agent_feed_signals|static signals/i')).not.toBeVisible();
  });
  
});
