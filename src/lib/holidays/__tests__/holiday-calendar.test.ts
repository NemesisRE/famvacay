import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Fixed school calendars instead of OpenHolidays: two regions with a complete 2027, a third
// whose 2027 summer break is not published yet
const summer = (start: string, end: string, subdivisions: string[]) => ({ startDate: start, endDate: end, subdivisions });
const countryPeriods: Record<string, ReturnType<typeof summer>[]> = {
  'XA-2027': [
    summer('2027-07-01', '2027-08-15', ['XA-1']),
    summer('2027-07-20', '2027-09-01', ['XA-2']),
    summer('2027-07-10', '2027-08-20', ['XA-3']),
    summer('2027-10-25', '2027-10-29', []),
  ],
  'XB-2027': [summer('2027-07-01', '2027-08-31', ['XB-1']), summer('2027-07-03', '2027-07-03', ['XB-2', 'XB-3'])],
};
const regionHolidays: Record<string, { startDate: string; endDate: string; name: string; state: string }[]> = {
  'XA-1-2027': [{ startDate: '2027-07-01', endDate: '2027-08-15', name: 'Summer', state: 'XA-1' }],
  'XA-2-2027': [{ startDate: '2027-07-20', endDate: '2027-09-01', name: 'Summer', state: 'XA-2' }],
};

vi.mock('@/lib/integrations/open-holidays', () => ({
  getCountrySchoolHolidays: vi.fn(async (country: string, year: number) => countryPeriods[`${country}-${year}`] ?? []),
  getSchoolHolidays: vi.fn(async (region: string, year: number) => regionHolidays[`${region}-${year}`] ?? []),
}));

const { getCountryHolidayCalendar, getPersonalHolidayCalendar } = await import('../holiday-calendar');
const { GET } = await import('@/app/api/holidays/calendar/route');

const day = <T extends { date: string }>(days: T[], date: string) => days.find((d) => d.date === date)!;

describe('country holiday density (like the ADAC chart)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts the school regions on holiday each day; nationwide breaks count every region', async () => {
    const cal = await getCountryHolidayCalendar('XA', '2027-06-30', '2027-10-31', 'en');
    expect(cal.totalRegions).toBe(3);
    expect(day(cal.days, '2027-06-30').regionsOnHoliday).toBe(0);
    expect(day(cal.days, '2027-07-05').regionsOnHoliday).toBe(1);
    expect(day(cal.days, '2027-08-01').regionsOnHoliday).toBe(3);
    expect(day(cal.days, '2027-10-26').regionsOnHoliday).toBe(3);
  });

  it('reports a year as unknown while most regions have no published summer break', async () => {
    const cal = await getCountryHolidayCalendar('XB', '2027-07-01', '2027-07-31', 'en');
    expect(cal.days.every((d) => d.regionsOnHoliday === null)).toBe(true);
  });

  it('a country without any school data has no regions', async () => {
    const cal = await getCountryHolidayCalendar('XC', '2027-01-01', '2027-01-31', 'en');
    expect(cal.totalRegions).toBe(0);
  });
});

describe('personal holiday calendar (children school regions, home public holidays)', () => {
  it('shows which of the children school regions are on holiday', async () => {
    const cal = await getPersonalHolidayCalendar('XA-1', ['XA-1', 'XA-2'], '2027-07-01', '2027-09-01', 'en');
    expect(day(cal.days, '2027-07-05').onHoliday).toEqual(['XA-1']);
    expect(day(cal.days, '2027-08-01').onHoliday).toEqual(['XA-1', 'XA-2']);
    expect(day(cal.days, '2027-08-20').onHoliday).toEqual(['XA-2']);
    expect(cal.regionsWithoutData).toEqual([]);
  });

  it('uses the home region without school children and flags regions without data', async () => {
    const cal = await getPersonalHolidayCalendar('XZ-9', [], '2027-07-01', '2027-07-02', 'en');
    expect(cal.schoolRegions).toEqual(['XZ-9']);
    expect(cal.regionsWithoutData).toEqual(['XZ-9']);
    expect(day(cal.days, '2027-07-01').unknown).toEqual(['XZ-9']);
  });

  it('names public holidays of the home region in the user language', async () => {
    const cal = await getPersonalHolidayCalendar('DE-BW', ['XA-1'], '2027-12-24', '2027-12-26', 'de');
    expect(day(cal.days, '2027-12-25').publicHoliday).toBe('1. Weihnachtstag');
  });
});

describe('calendar API', () => {
  it('validates region and range', async () => {
    const ok = await GET(new NextRequest('http://localhost/api/holidays/calendar?view=country&region=XA&from=2027-07-01&to=2027-07-31'));
    expect(ok.status).toBe(200);
    expect((await ok.json()).days).toHaveLength(31);
    expect((await GET(new NextRequest('http://localhost/api/holidays/calendar?region=bad&from=2027-01-01&to=2027-01-02'))).status).toBe(400);
    expect((await GET(new NextRequest('http://localhost/api/holidays/calendar?region=DE&from=2027-01-01&to=2031-01-01'))).status).toBe(400);
  });
});
