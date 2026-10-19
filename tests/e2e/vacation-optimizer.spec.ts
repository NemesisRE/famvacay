import { test, expect } from '@playwright/test';

test.describe('FamVacay E2E User Journey', () => {
  test('landing page loads and system health status responds', async ({ page }) => {
    test.setTimeout(120000);

    // Check health endpoint directly
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.status()).toBe(200);
    const healthJson = await healthResponse.json();
    expect(healthJson.version).toBe('1.0.0');

    // Visit home page
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('h1, header, nav').filter({ hasText: /Family Vacation Optimizer|Urlaubs- & Reise-Optimierer/ }).first()).toBeVisible();

    // Trigger optimization
    const optimizeBtn = page.locator('button[type="submit"]').first();
    await expect(optimizeBtn).toBeVisible();
    await optimizeBtn.click();

    // Verify results show up
    await expect(page.locator('text=/Optimal Vacation Windows|Optimale Urlaubsfenster/').first()).toBeVisible();
    await expect(page.locator('text=/Windows Found|Reisefenster gefunden/').first()).toBeVisible({ timeout: 90000 });
  });
});

