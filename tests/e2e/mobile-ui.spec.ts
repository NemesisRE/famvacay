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

    await page.goto('/');

    // 1. Verify language dropdown displays ONLY short code when closed
    const langBtn = page.locator('button[aria-label="Select language"]');
    await expect(langBtn).toBeVisible();
    const closedText = (await langBtn.innerText()).trim();
    expect(closedText).toMatch(/^[A-Z]{2}$/); // e.g. "DE" or "EN"

    // 2. Open dropdown and verify full language names are displayed
    await langBtn.click();
    const dropdown = page.locator('div[role="listbox"]');
    await expect(dropdown).toBeVisible();

    const deOption = dropdown.locator('button:has-text("Deutsch")');
    const enOption = dropdown.locator('button:has-text("English")');
    await expect(deOption).toBeVisible();
    await expect(enOption).toBeVisible();

    // 3. Switch to English
    await enOption.click();
    await expect(dropdown).not.toBeVisible();
    await expect(langBtn).toHaveText('EN');

    // 4. Verify Annual Moving Holidays appear ONLY when Add Blackout Period is pressed
    const easterHolidayBtn = page.locator('button:has-text("Easter")');
    await expect(easterHolidayBtn).not.toBeVisible();

    const addBlackoutBtn = page.locator('button:has-text("+ Add Blackout Period")');
    await expect(addBlackoutBtn).toBeVisible();
    await addBlackoutBtn.click();
    await expect(easterHolidayBtn).toBeVisible();

    // 5. Test vacation style selection & options (Beach and Alpine)
    // Both styles are selected initially under "Flexible / All"
    // Beach Min Temp button
    const tempBtn = page.locator('button:has-text("Any")').first();
    await expect(tempBtn).toBeVisible();
    await tempBtn.click();

    const tempPopover = page.locator('div[role="dialog"]');
    await expect(tempPopover).toBeVisible();
    const box = await tempPopover.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(385);
    }

    // Select 24°C
    const temp24 = tempPopover.locator('button:has-text("24°C")');
    await temp24.click();
    await expect(tempPopover).not.toBeVisible();
    await expect(page.locator('button:has-text("≥ 24°C")')).toBeVisible();

    // Snow Guarantee toggle inside Alpine card
    const snowBtn = page.locator('button:has-text("No Guarantee")').first();
    await expect(snowBtn).toBeVisible();
    await snowBtn.click();
    await expect(page.locator('button:has-text("Snow Guarantee")')).toBeVisible();

    // 6. Test Travel Vehicle buttons
    const carBtn = page.locator('div:has-text("Car / Camper")').last();
    await expect(carBtn).toBeVisible();
    await carBtn.click();

    // 7. Test Add Child button
    const addChildBtn = page.locator('button:has-text("+ Add Child")');
    await expect(addChildBtn).toBeVisible();
    await addChildBtn.click();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Add Child")')).toBeVisible();

    // 8. Verify ZERO browser/hydration errors
    expect(consoleErrors).toEqual([]);
  });
});
