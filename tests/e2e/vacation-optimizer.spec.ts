import { test, expect } from '@playwright/test';

test.describe('FamVacay E2E User Journey', () => {
  test('landing page loads and system health status responds', async ({ page }) => {
    // Check health endpoint directly
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.status()).toBe(200);
    const healthJson = await healthResponse.json();
    expect(healthJson.version).toBe('1.0.0');

    // Visit home page
    await page.goto('/');
    await expect(page.locator('text=Family Vacation Optimizer (FamVacay)')).toBeVisible();

    // Fill form and trigger optimization
    const optimizeBtn = page.locator('button:has-text("Run Multi-Objective Optimization")');
    await expect(optimizeBtn).toBeVisible();
    await optimizeBtn.click();

    // Verify results show up
    await expect(page.locator('text=Optimal Vacation Windows')).toBeVisible();
    await expect(page.locator('text=Windows Found')).toBeVisible({ timeout: 10000 });
  });
});

