import { test, expect } from '@playwright/test';

// The assertions use the English texts
test.use({ locale: 'en-US' });

test.describe('Browser Back closes overlays instead of leaving the page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Back closes an open dropdown and stays on the page; closing it in the UI leaves no extra step', async ({ page }) => {
    const url = page.url();
    await page.locator('#travel-flight-stops').click();
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(page.url()).toBe(url);

    // Opened and closed with Escape: its history entry is gone again
    const length = await page.evaluate(() => history.length);
    await page.locator('#travel-flight-stops').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => history.state?.famvacayEntry ?? null)).toBeNull();
    expect(await page.evaluate(() => history.length)).toBeGreaterThanOrEqual(length);
  });

  test('Back on a calendar with a changed month asks first, like any other close', async ({ page }) => {
    const trigger = page.locator('button:has(svg.lucide-calendar)').first();
    await trigger.click();
    await page.locator('.rdp-themed .rdp-button_next').first().click();

    await page.goBack();
    await expect(page.getByText('No day selected yet')).toBeVisible();
    await page.getByRole('button', { name: 'Close without change' }).click();
    await expect(page.locator('.rdp-themed')).toHaveCount(0);
  });

  test('typing umlauts keeps them and finds the destination', async ({ page }) => {
    await page.locator('#destination-search').click();
    await page.keyboard.type('Ägypten');
    await expect(page.locator('#destination-search')).toHaveValue('Ägypten');
    await expect(page.getByRole('option', { name: /Ägypten/ }).first()).toBeVisible();
  });
});
