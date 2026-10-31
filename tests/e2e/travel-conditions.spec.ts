import { test, expect } from '@playwright/test';

// The form follows the browser language; the assertions use the English texts
test.use({ locale: 'en-US' });

test.describe('Travel conditions form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('destination and airport fields are search fields: a click anywhere starts typing', async ({ page }) => {
    // Click on the flexible chip inside the field, not on the input itself
    await page.getByText('All Destinations (Flexible Discovery)').first().click();
    await expect(page.locator('#destination-search')).toBeFocused();
    await expect(page.locator('#destination-search')).toHaveAttribute('role', 'combobox');

    const airportField = page.locator('#airport-search');
    await airportField.scrollIntoViewIfNeeded();
    await page.locator('#airport-search').locator('xpath=ancestor::div[contains(@class,"cursor-text")]').click({ position: { x: 8, y: 8 } });
    await expect(airportField).toBeFocused();
  });

  test('travel modes behave like vacation styles; their settings sit below the tiles', async ({ page }) => {
    const tile = (name: RegExp) => page.getByRole('button', { name });
    await expect(tile(/^Plane/)).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(/^Train/)).toHaveAttribute('aria-pressed', 'true');

    // All selected: a click picks only that mode
    await tile(/^Train/).click();
    await expect(tile(/^Train/)).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(/^Plane/)).toHaveAttribute('aria-pressed', 'false');
    await expect(tile(/^Car/)).toHaveAttribute('aria-pressed', 'false');
    // Flight stops and drivetrain only show for their mode, as separate controls
    await expect(page.locator('#travel-flight-stops')).toHaveCount(0);
    await expect(page.locator('#travel-car-fuel')).toHaveCount(0);

    await tile(/^Plane/).click();
    await expect(page.locator('#travel-flight-stops')).toBeVisible();

    // Deselecting the remaining modes falls back to all
    await tile(/^Plane/).click();
    await tile(/^Train/).click();
    await expect(tile(/^Bus/)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#travel-car-fuel')).toBeVisible();
  });

  test('long-haul kinds start all selected and toggle like the travel modes', async ({ page }) => {
    await page.getByRole('button', { name: /^Long-Range & Exotic/ }).click();
    const kinds = page.getByRole('group', { name: 'Kind of long-haul trip' });
    const kind = (name: string) => kinds.getByRole('button', { name, exact: true });
    for (const name of ['Beach', 'Cities', 'Nature', 'Mountains']) {
      await expect(kind(name)).toHaveAttribute('aria-pressed', 'true');
    }

    // All selected: a click picks only that kind
    await kind('Cities').click();
    await expect(kind('Cities')).toHaveAttribute('aria-pressed', 'true');
    await expect(kind('Beach')).toHaveAttribute('aria-pressed', 'false');

    // Deselecting the last one falls back to all
    await kind('Cities').click();
    await expect(kind('Mountains')).toHaveAttribute('aria-pressed', 'true');
  });

  test('calendar asks before dropping a month change without a day', async ({ page }) => {
    const trigger = page.locator('button:has(svg.lucide-calendar)').first();
    const prompt = page.getByTestId('calendar-unselected-prompt');
    const nextMonth = page.getByRole('button', { name: /next month/i });

    // Untouched: an outside click just closes
    await trigger.click();
    await expect(nextMonth).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(nextMonth).toHaveCount(0);

    // Month changed without a day: the prompt instead of closing
    await trigger.click();
    await nextMonth.click();
    await page.mouse.click(5, 5);
    await expect(prompt).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep choosing' })).toBeFocused();

    await page.getByRole('button', { name: 'Keep choosing' }).click();
    await expect(prompt).toHaveCount(0);
    await expect(nextMonth).toBeVisible();

    // Escape is a close request too; discarding closes without a change
    const before = await trigger.innerText();
    await page.keyboard.press('Escape');
    await expect(prompt).toBeVisible();
    await page.getByRole('button', { name: 'Close without change' }).click();
    await expect(nextMonth).toHaveCount(0);
    await expect(trigger).toHaveText(before);
  });
});
