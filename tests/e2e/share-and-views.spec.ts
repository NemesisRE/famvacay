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

    // 3. Switch to List View
    const listViewBtn = page.locator('button').filter({ hasText: /List View|Listenansicht/i }).first();
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Verify uniform DestinationFilterDropdown is present (since we have PMI and HER)
    const destDropdownBtn = page.locator('button[data-testid="destination-filter-trigger"]').first();
    await expect(destDropdownBtn).toBeVisible();

    // Open dropdown and select Mallorca only
    await destDropdownBtn.click();
    const pmiOption = page.locator('button').filter({ hasText: '(PMI)' }).first();
    await expect(pmiOption).toBeVisible();
    await pmiOption.click();

    // Close dropdown
    await destDropdownBtn.click();

    await expect(page.locator('text=Palma de Mallorca').first()).toBeVisible();
    await expect(page.locator('button[title="Show on Map"]').filter({ hasText: /Heraklion/i })).not.toBeVisible();

    // Switch to Timeline / Period View
    const timeframeViewBtn = page.locator('button').filter({ hasText: /By Timeframe|Nach Zeitraum/i }).first();
    if (await timeframeViewBtn.isVisible()) {
      await timeframeViewBtn.click();
      // Verify Destination dropdown is also visible in Timeline view
      const timeframeDestBtn = page.locator('button[data-testid="destination-filter-trigger"]').first();
      await expect(timeframeDestBtn).toBeVisible();
    }

    // 4. Verify Dark Mode toggle
    const themeBtn = page.locator('button[aria-label="Toggle color theme"]');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDark).toBeTruthy();
    }
  });
});
