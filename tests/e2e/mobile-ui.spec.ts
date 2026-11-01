import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport & UI Responsiveness', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE / Mobile Viewport
    isMobile: true,
    hasTouch: true,
  });

  test('hydrates correctly, switches language via compact dropdown, and handles mobile buttons without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');

    // 1. Language switch lives in the settings menu
    const settingsBtn = page.getByRole('button', { name: /^(Settings|Einstellungen)$/ });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.tap();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio', { name: 'Deutsch' })).toBeVisible();
    await menu.getByRole('menuitemradio', { name: 'English' }).tap();
    await expect(menu).not.toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // 2. The holidays of the home region appear only once a blackout period is being added
    const holidaysTitle = page.getByText('Holidays in your home region');
    await expect(holidaysTitle).not.toBeVisible();
    await page.getByRole('button', { name: '+ Add Blackout Period' }).tap();
    await expect(holidaysTitle).toBeVisible();
    await expect(holidaysTitle.locator('xpath=..').locator('button[aria-pressed]').first()).toBeVisible();

    // 3. Beach temperature picker stays inside the mobile viewport
    const tempSelect = page.getByRole('combobox', { name: 'Minimum Temperature (Beach)' });
    await tempSelect.tap();
    const tempList = page.getByRole('listbox');
    await expect(tempList).toBeVisible();
    const box = await tempList.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(385);
    }
    await tempList.getByRole('option', { name: '≥ 24°C' }).tap();
    await expect(tempList).not.toBeVisible();
    await expect(tempSelect).toHaveText(/≥ 24°C/);

    // 4. Snow guarantee
    const snowSelect = page.getByRole('combobox', { name: 'Snow & Winter Sports' });
    await snowSelect.tap();
    await page.getByRole('listbox').getByRole('option').filter({ hasNotText: 'No Guarantee' }).first().tap();
    await expect(snowSelect).not.toHaveText(/No Guarantee/);

    // 5. Flight stops: a select below the travel tiles (no dropdown inside the plane tile); its list
    //    stays inside the viewport
    const flightStopsSelect = page.locator('#travel-flight-stops');
    await flightStopsSelect.tap();
    const stopsList = page.getByRole('listbox');
    await expect(stopsList).toBeVisible();
    const stopsBox = await stopsList.boundingBox();
    if (stopsBox) {
      expect(stopsBox.x).toBeGreaterThanOrEqual(0);
      expect(stopsBox.x + stopsBox.width).toBeLessThanOrEqual(385);
    }
    await stopsList.getByRole('option', { name: 'Direct Flights Only (0 Stops)' }).tap();
    await expect(stopsList).not.toBeVisible();
    await expect(flightStopsSelect).toHaveText(/Direct Flights Only/);

    // 6. Travel modes behave like the vacation styles: with all selected, a tap picks only that one;
    //    tapping it again (the last one) selects all again
    const carCard = page.getByRole('button', { name: /^Car \/ Camper/ });
    const planeCard = page.getByRole('button', { name: /^Plane/ });
    await expect(carCard).toHaveAttribute('aria-pressed', 'true');
    await carCard.tap();
    await expect(carCard).toHaveAttribute('aria-pressed', 'true');
    await expect(planeCard).toHaveAttribute('aria-pressed', 'false');
    await carCard.tap();
    await expect(planeCard).toHaveAttribute('aria-pressed', 'true');

    // 7. Add a child: a birth date field and the "Add Child" button for the next one
    await page.getByRole('button', { name: '+ Add Child' }).tap();
    await expect(page.getByRole('button', { name: /^06\/01\/\d{4}$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Child', exact: true })).toBeVisible();

    // 8. Location search input on mobile
    const locationInput = page.getByRole('textbox', { name: /Karlsruhe/ });
    await expect(locationInput).toBeVisible();
    await locationInput.fill('Berlin');
    await page.waitForTimeout(400);

    // 9. Verify ZERO browser/hydration errors
    expect(consoleErrors).toEqual([]);
  });
});
