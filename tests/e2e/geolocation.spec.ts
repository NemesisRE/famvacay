import { test, expect } from '@playwright/test';

// The location permission prompt must only follow a click on "My location", never a page load
test.describe('Browser location', () => {
  test.use({ locale: 'en-US', permissions: ['geolocation'], geolocation: { latitude: 49.0069, longitude: 8.4037 } });

  test('is requested only when the user presses "My location"', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __geoCalls: number }).__geoCalls = 0;
      const geo = navigator.geolocation;
      const original = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = (...args: Parameters<Geolocation['getCurrentPosition']>) => {
        (window as unknown as { __geoCalls: number }).__geoCalls++;
        return original(...args);
      };
    });
    const geoCalls = () => page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

    // First visit: nothing saved yet - previously the case that asked for the location on load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(await geoCalls()).toBe(0);

    await page.getByRole('button', { name: /My location/i }).first().click();
    await expect.poll(geoCalls).toBe(1);
  });
});
