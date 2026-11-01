import { test, expect } from '@playwright/test';

// Production builds register the service worker, whose requests bypass page.route stubs
test.use({ locale: 'en-US', serviceWorkers: 'block' });

// The calendar data comes from a stub, so the test does not depend on OpenHolidays
const days = (from: string, count: number, make: (date: string, i: number) => object) =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    return { date, ...make(date, i) };
  });

test('the calendar tab shows the holiday density of the country and the family view', async ({ page, request }) => {
  await page.route('**/api/holidays/calendar?**', async (route) => {
    const view = new URL(route.request().url()).searchParams.get('view');
    const body =
      view === 'personal'
        ? // No school children in this search: every day counts, rated by all regions on holiday
          { homeRegion: 'DE-BW', schoolRegions: [], regionsWithoutData: [], otherRegionsTotal: 16, days: days('2027-07-01', 62, (_d, i) => ({ onHoliday: [], unknown: [], otherRegionsOnHoliday: i < 10 ? 0 : 12 })) }
        : { country: 'DE', totalRegions: 16, days: days('2027-07-01', 62, (_d, i) => ({ regionsOnHoliday: i % 17, ...(i === 0 ? { publicHoliday: 'Test Day' } : {}) })) };
    await route.fulfill({ json: body });
  });

  const share = await request.post('/api/vacations/share', {
    data: {
      formState: { departureLocation: 'Stuttgart, Germany', country: 'DE', federalState: 'DE-BW', earliestDate: '2027-07-01', latestDate: '2027-08-31' },
      windows: [
        {
          startDate: '2027-08-01', endDate: '2027-08-10', durationDays: 10, originAirport: 'STR', destinationAirport: 'PMI',
          destinationName: 'Palma de Mallorca Airport', destinationCity: 'Palma de Mallorca', destinationCountry: 'Spain',
          estimatedTotalCost: 1400, pricePerPerson: 350, ptoEfficiencyRatio: 1.4, finalScore: 80, requiresSchoolExemption: false,
          pricingDetails: { flight: { totalFlightCost: 600 }, lodging: { totalLodgingCost: 800 } },
        },
      ],
    },
  });
  const { shareId } = await share.json();
  await page.goto(`/?s=${shareId}`);

  await page.getByRole('button', { name: 'Calendar' }).click();
  const calendar = page.locator('section[aria-labelledby="holiday-calendar-title"]');
  await expect(calendar.getByRole('heading', { name: /School holidays – Germany/ })).toBeVisible();
  await expect(calendar.getByRole('heading', { name: /July 2027/ })).toBeVisible();
  await expect(calendar.getByRole('listitem', { name: /July 1, 2027 · 0 of 16 regions on school holiday · Public holiday: Test Day/ })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('calendar');

  await calendar.getByRole('button', { name: 'Your location' }).click();
  await expect(calendar.getByRole('heading', { name: 'Your best travel times' })).toBeVisible();
  await expect(calendar.getByRole('listitem', { name: /July 20, 2027 · 12 of 16 regions on school holiday/ })).toBeVisible();
  await expect(calendar.getByRole('heading', { name: 'Quietest periods' })).toBeVisible();
  await expect(calendar.getByText(/Jul 1 – 10, 2027/)).toBeVisible();

  // Back returns to the previous view
  await page.goBack();
  await expect(calendar).toHaveCount(0);
});
