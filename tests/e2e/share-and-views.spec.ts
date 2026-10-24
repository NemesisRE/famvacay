import { test, expect } from '@playwright/test';

test.describe('Search State Sharing, Destination Filtering, and Dark Mode', () => {
  test('persists search state, hydating via share URL, filters destinations in views, and toggles dark theme', async ({
    request,
    page,
  }) => {
    // 1. Seed a shareable search state via POST /api/vacations/share
    const sampleWindows = [
      {
        startDate: '2026-07-15',
        endDate: '2026-07-25',
        durationDays: 10,
        originAirport: 'FRA',
        originName: 'Frankfurt Airport',
        originCity: 'Frankfurt',
        originCountry: 'Germany',
        destinationAirport: 'PMI',
        destinationName: 'Palma de Mallorca Airport',
        destinationCity: 'Palma de Mallorca',
        destinationCountry: 'Spain',
        flightDistanceKm: 1250,
        flightDurationMinutes: 130,
        estimatedTotalCost: 1400,
        pricePerPerson: 350,
        ptoDaysRequired: 7,
        ptoEfficiencyRatio: 1.43,
        finalScore: 88,
        matchScore: 88,
        requiresSchoolExemption: false,
        pricingDetails: {
          flight: { totalFlightCost: 600, baseAdultFare: 150 },
          lodging: { totalLodgingCost: 800, pricePerNight: 80 },
        },
      },
      {
        startDate: '2026-08-01',
        endDate: '2026-08-11',
        durationDays: 10,
        originAirport: 'FRA',
        originName: 'Frankfurt Airport',
        originCity: 'Frankfurt',
        originCountry: 'Germany',
        destinationAirport: 'HER',
        destinationName: 'Heraklion International Airport',
        destinationCity: 'Heraklion',
        destinationCountry: 'Greece',
        flightDistanceKm: 2100,
        flightDurationMinutes: 190,
        estimatedTotalCost: 1600,
        pricePerPerson: 400,
        ptoDaysRequired: 7,
        ptoEfficiencyRatio: 1.43,
        finalScore: 85,
        matchScore: 85,
        requiresSchoolExemption: false,
        pricingDetails: {
          flight: { totalFlightCost: 700, baseAdultFare: 175 },
          lodging: { totalLodgingCost: 900, pricePerNight: 90 },
        },
      },
    ];

    const shareRes = await request.post('/api/vacations/share', {
      data: {
        formState: {
          departureLocation: 'Frankfurt, Germany',
          targetDestinations: ['PMI', 'HER'],
          adultsCount: 2,
        },
        windows: sampleWindows,
      },
    });

    expect(shareRes.ok()).toBeTruthy();
    const shareData = await shareRes.json();
    expect(shareData.shareId).toBeDefined();

    // 2. Access directly via share URL /?s=<shareId>
    await page.goto(`/?s=${shareData.shareId}`);

    // Verify results are loaded and visible immediately
    await expect(page.locator('text=Palma de Mallorca').first()).toBeVisible();

    // 3. Switch to the list view and open the filter panel, where the destination filter lives
    await page.getByRole('button', { name: /^(List|Liste)$/ }).click();
    await page.getByRole('button', { name: /Show Filters|Filter einblenden/i }).click();

    const destDropdownBtn = page.getByTestId('destination-filter-trigger').first();
    await expect(destDropdownBtn).toBeVisible();

    // Pick Mallorca only; the options open in a floating dialog outside the results
    await destDropdownBtn.click();
    const destDialog = page.locator('[data-floating-ui-portal]').getByRole('dialog');
    await destDialog.getByRole('button', { name: /Palma de Mallorca/ }).click();
    await destDialog.getByRole('button', { name: /^(Done|Fertig)/ }).click();

    await expect(destDropdownBtn).toContainText('Palma de Mallorca');
    await expect(page.getByText('FRA ➔ PMI').first()).toBeVisible();
    await expect(page.getByText('FRA ➔ HER')).toHaveCount(0);

    // The period view keeps the same destination filter
    await page.getByRole('button', { name: /^(Period|Zeitraum)$/ }).click();
    await expect(page.getByTestId('destination-filter-trigger').first()).toBeVisible();

    // 4. Dark mode toggle in the settings menu
    await page.getByRole('button', { name: /^(Settings|Einstellungen)$/ }).click();
    await page.getByRole('menu').getByRole('button', { name: /light mode|dark mode|heller modus|dunkler modus/i }).click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBeTruthy();
  });
});
