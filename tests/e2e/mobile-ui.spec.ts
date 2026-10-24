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

    // 2. Moving holidays appear only once a blackout period is being added
    const easterHolidayBtn = page.getByRole('button', { name: 'Easter', exact: true });
    await expect(easterHolidayBtn).not.toBeVisible();
    await page.getByRole('button', { name: '+ Add Blackout Period' }).tap();
    await expect(easterHolidayBtn).toBeVisible();

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

    // 5. Flight stops popover stays inside the viewport and updates the plane card
    const flightStopsBtn = page.getByRole('button', { name: 'Any (Direct or Connecting)', exact: true });
    await flightStopsBtn.tap();
    const flightStopsPopover = page.getByRole('dialog', { name: 'Flight Transit Tolerance' });
    await expect(flightStopsPopover).toBeVisible();
    const flightBox = await flightStopsPopover.boundingBox();
    if (flightBox) {
      expect(flightBox.x).toBeGreaterThanOrEqual(0);
      expect(flightBox.x + flightBox.width).toBeLessThanOrEqual(385);
    }
    await flightStopsPopover.getByRole('button', { name: 'Direct Flights Only (0 Stops)' }).tap();
    await expect(flightStopsPopover).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Plane .*Non-Stop/ })).toBeVisible();

    // 6. Car / Camper toggles off
    const carCard = page.getByRole('button', { name: /^Car \/ Camper/ });
    await expect(carCard).toHaveAttribute('aria-pressed', 'true');
    await carCard.tap();
    await expect(carCard).toHaveAttribute('aria-pressed', 'false');

    // 7. Add a child: a birth date field and the "Add Child" button for the next one
    await page.getByRole('button', { name: '+ Add Child' }).tap();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
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
