import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getSchoolHolidays = vi.fn(async (_state: string, _year?: number) => [] as any[]);
const getPublicHolidays = vi.fn(async (_state: string, _year?: number) => [] as any[]);

vi.mock('@/lib/integrations/open-holidays', () => ({
  getSchoolHolidays: (state: string, year: number) => getSchoolHolidays(state, year),
  getPublicHolidays: (state: string, year: number) => getPublicHolidays(state, year),
}));
vi.mock('@/lib/safety/safety-service', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, ensureTravelAdvisoriesLoaded: async () => {} };
});

const { POST } = await import('@/app/api/vacations/optimize/route');

const request = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/vacations/optimize', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const body = (extra: Record<string, unknown> = {}) => ({
  targetDestinations: ['PMI'],
  durationDays: 7,
  earliestDate: '2027-07-01',
  latestDate: '2027-07-20',
  travelVehicles: ['PLANE'],
  userProfile: {
    homeLocation: 'Stuttgart',
    federalState: 'DE-BW',
    originAirports: ['STR'],
    childrenAges: [9, 11],
    childrenBirthDates: ['2018-01-01', '2016-01-01'],
    childrenSchoolRegions: [null, 'DE-BY'],
    blackoutRanges: [],
  },
  ...extra,
});

describe('POST /api/vacations/optimize - regional holiday fetching', () => {
  beforeEach(() => {
    getSchoolHolidays.mockClear();
    getPublicHolidays.mockClear();
  });

  it('fetches school calendars for every child region but public holidays only for home', async () => {
    const res = await POST(request(body({ latestDate: '2027-07-21' })));
    expect(res.status).toBe(200);

    const schoolStates = new Set(getSchoolHolidays.mock.calls.map((c) => c[0]));
    expect(schoolStates).toContain('DE-BW');
    expect(schoolStates).toContain('DE-BY');

    const publicStates = new Set(getPublicHolidays.mock.calls.map((c) => c[0]));
    expect([...publicStates]).toEqual(['DE-BW']);
  });

  it('coalesces identical concurrent requests into a single computation', async () => {
    const b = body({ latestDate: '2027-07-22' });
    const [r1, r2] = await Promise.all([POST(request(b)), POST(request(b))]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const headers = [r1.headers.get('X-Famvac-Cache'), r2.headers.get('X-Famvac-Cache')].sort();
    expect(headers).toEqual(['COALESCED', 'MISS']);
    // one computation -> one set of fetches (2 school regions + 1 public region, single year)
    expect(getSchoolHolidays).toHaveBeenCalledTimes(2);
    expect(getPublicHolidays).toHaveBeenCalledTimes(1);
  });
});
