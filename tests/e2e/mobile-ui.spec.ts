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

    // 1. Verify language dropdown displays ONLY short code when closed
    const langBtn = page.locator('button[aria-label="Select language"]');
    await expect(langBtn).toBeVisible();
    const closedText = (await langBtn.innerText()).trim();
    expect(closedText).toMatch(/^[A-Z]{2}$/); // e.g. "DE" or "EN"

    // 2. Open dropdown and verify full language names are displayed
    await langBtn.tap();
    const dropdown = page.locator('div[role="listbox"]');
    await expect(dropdown).toBeVisible();

    const deOption = dropdown.locator('button:has-text("Deutsch")');
    const enOption = dropdown.locator('button:has-text("English")');
    await expect(deOption).toBeVisible();
    await expect(enOption).toBeVisible();

    // 3. Switch to English
    await enOption.tap();
    await expect(dropdown).not.toBeVisible();
    await expect(langBtn).toHaveText('EN');

    // 4. Verify Annual Moving Holidays appear ONLY when Add Blackout Period is pressed
    const easterHolidayBtn = page.locator('button:has-text("Easter")');
    await expect(easterHolidayBtn).not.toBeVisible();

    const addBlackoutBtn = page.locator('button:has-text("+ Add Blackout Period")');
    await expect(addBlackoutBtn).toBeVisible();
    await addBlackoutBtn.tap();
    await expect(easterHolidayBtn).toBeVisible();

    // 5. Test vacation style selection & options (Beach and Alpine)
    // Both styles are selected initially under "Flexible / All"
    // Beach Min Temp button
    const tempBtn = page.locator('button:has-text("Any")').first();
    await expect(tempBtn).toBeVisible();
    await tempBtn.tap();

    const tempPopover = page.locator('div[role="dialog"]');
    await expect(tempPopover).toBeVisible();
    const box = await tempPopover.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(385);
    }

    // Select 24°C
    const temp24 = tempPopover.locator('button:has-text("24°C")');
    await temp24.tap();
    await expect(tempPopover).not.toBeVisible();
    await expect(page.locator('button:has-text("≥ 24°C")')).toBeVisible();

    // Snow Guarantee toggle inside Alpine card
    const snowBtn = page.locator('button:has-text("No Guarantee")').first();
    await expect(snowBtn).toBeVisible();
    await snowBtn.tap();
    await expect(page.locator('button:has-text("Snow Guarantee")')).toBeVisible();

    // 6. Test Travel Vehicle buttons & FlightStopsPopover
    // Airplane is selected by default; open flight transit preference popover
    const flightStopsBtn = page.locator('button[aria-haspopup="dialog"]').filter({ hasText: /Any|Beliebig|Non-Stop|Direkt/ }).first();
    await expect(flightStopsBtn).toBeVisible();
    await flightStopsBtn.tap();

    // Verify popover dialog is visible and stays strictly within mobile viewport boundaries
    const flightStopsPopover = page.locator('div[role="dialog"]').last();
    await expect(flightStopsPopover).toBeVisible();
    const flightBox = await flightStopsPopover.boundingBox();
    if (flightBox) {
      expect(flightBox.x).toBeGreaterThanOrEqual(0);
      expect(flightBox.x + flightBox.width).toBeLessThanOrEqual(385);
    }

    // Select "Direct Flights Only (0 Stops)"
    const directOnlyBtn = flightStopsPopover.locator('button:has-text("Direct Flights Only"), button:has-text("Direktflüge")').first();
    await expect(directOnlyBtn).toBeVisible();
    await directOnlyBtn.tap();
    await expect(flightStopsPopover).not.toBeVisible();

    // Verify button label updated
    await expect(page.locator('button:has-text("Non-Stop")').first()).toBeVisible();

    // Toggle Car / Camper
    const carBtn = page.locator('div:has-text("Car / Camper"), div:has-text("Auto / Camper")').last();
    await expect(carBtn).toBeVisible();
    await carBtn.tap();

    // 7. Test Add Child button
    const addChildBtn = page.locator('button:has-text("+ Add Child"), button:has-text("+ Kind hinzufügen")');
    await expect(addChildBtn).toBeVisible();
    await addChildBtn.tap();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Add Child"), button:has-text("Kind hinzufügen")').first()).toBeVisible();

    // 8. Test Location Input search on mobile
    const locationInput = page.locator('input[placeholder*="Karlsruhe"], input[placeholder*="Munich"]').first();
    await expect(locationInput).toBeVisible();
    await locationInput.fill('Berlin');
    await page.waitForTimeout(400);

    // 9. Verify ZERO browser/hydration errors
    expect(consoleErrors).toEqual([]);
  });
});
