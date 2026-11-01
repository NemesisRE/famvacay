import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getHolidayPeriods, getHolidayBlackoutOptions, resolveHolidayBlackouts } from '../holiday-periods';
import { migrateHolidayBlackoutIds, holidayIdsForCountry } from '../holiday-blackout-ids';
import { GET } from '@/app/api/holidays/blackout-options/route';

describe('holiday periods of the home region (date-holidays, no fixed calendar)', () => {
  it('Germany: Good Friday to Easter Monday is one period with a year-independent id', () => {
    const easter2026 = getHolidayPeriods('DE-BW', 2026, 'de').find((p) => p.id === 'DE:easter -2')!;
    const easter2027 = getHolidayPeriods('DE-BW', 2027, 'de').find((p) => p.id === 'DE:easter -2')!;
    expect(easter2026).toMatchObject({ startDate: '2026-04-03', endDate: '2026-04-06' });
    expect(easter2027).toMatchObject({ startDate: '2027-03-26', endDate: '2027-03-29' });
    expect(easter2026.names).toEqual(expect.arrayContaining(['Karfreitag', 'Ostermontag']));
  });

  it('Saudi Arabia: the two Eids, multi-day, no Easter or Christmas', () => {
    const options = getHolidayBlackoutOptions('SA-01', '2026-11-01', '2027-10-31', 'en');
    const multiDay = options.filter((o) => o.multiDay).map((o) => o.name);
    expect(multiDay.join(' ')).toMatch(/Eid al-Fitr/);
    expect(multiDay.join(' ')).toMatch(/Eid al-Adha/);
    expect(options.some((o) => /Easter|Christmas/.test(o.names.join(' ')))).toBe(false);
  });

  it('Israel: Rosh Hashanah; US: Thanksgiving multi-day, Christmas a single day', () => {
    const israel = getHolidayBlackoutOptions('IL', '2026-11-01', '2027-10-31', 'en');
    expect(israel.find((o) => o.multiDay)?.names.join(' ')).toMatch(/Rosh Hashanah/);
    const us = getHolidayBlackoutOptions('US-CA', '2026-11-01', '2027-10-31', 'en');
    expect(us.find((o) => /Thanksgiving/.test(o.name))?.multiDay).toBe(true);
    expect(us.find((o) => /Christmas/.test(o.name))?.multiDay).toBe(false);
  });

  it('names come in the user language where available, otherwise in English', () => {
    expect(getHolidayBlackoutOptions('SA', '2027-01-01', '2027-12-31', 'de').map((o) => o.name)).toContain('Zuckerfest');
    // No German name for the Saudi National Day: English instead of Arabic script
    expect(getHolidayBlackoutOptions('SA', '2027-01-01', '2027-12-31', 'de').map((o) => o.name)).toContain('National Day');
  });

  it('only offers holidays inside the travel period, plus the selected ones', () => {
    const autumn = getHolidayBlackoutOptions('DE-BW', '2026-09-01', '2026-11-30', 'en').map((o) => o.id);
    expect(autumn).not.toContain('DE:easter -2');
    expect(getHolidayBlackoutOptions('DE-BW', '2026-09-01', '2026-11-30', 'en', ['DE:easter -2']).map((o) => o.id)).toContain('DE:easter -2');
  });
});

describe('selections and their dates', () => {
  it('converts old fixed-feast ids to the holidays of the home country', () => {
    expect(migrateHolidayBlackoutIds(['easter', 'christmas_new_year', 'DE:12-25'], 'DE-BW')).toEqual(['DE:easter -2', 'DE:12-25']);
    expect(migrateHolidayBlackoutIds(['easter'], 'SA-01')).toEqual(['SA:easter -2']);
    expect(holidayIdsForCountry(['DE:12-25', 'SA:30 Ramadan P4D'], 'SA-01')).toEqual(['SA:30 Ramadan P4D']);
  });

  it('resolves dates by rule, also where the stored rule is only the start of the country rule', () => {
    // US Christmas: "12-25 and if sunday then next monday ..." matches the converted "12-25"
    const us = resolveHolidayBlackouts(migrateHolidayBlackoutIds(['christmas_new_year'], 'US-CA'), 'US-CA', '2026-12-01', '2027-01-31', 'en');
    expect(us.map((b) => b.startDate)).toEqual(['2026-12-25']);
    // A converted Easter means nothing in Saudi Arabia
    expect(resolveHolidayBlackouts(['SA:easter -2'], 'SA-01', '2026-01-01', '2026-12-31', 'en')).toEqual([]);
    const eid = resolveHolidayBlackouts(['SA:30 Ramadan P4D'], 'SA-01', '2027-01-01', '2027-12-31', 'en');
    expect(eid).toHaveLength(1);
  });

  it('serves the options and the selected dates over the API', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/holidays/blackout-options?region=SA-01&from=2027-01-01&to=2027-12-31&locale=en&selected=SA:30%20Ramadan%20P4D')
    );
    const body = await res.json();
    expect(body.options.length).toBeGreaterThan(0);
    expect(body.blackouts).toHaveLength(1);
    const bad = await GET(new NextRequest('http://localhost/api/holidays/blackout-options?region=<script>'));
    expect(bad.status).toBe(400);
  });
});
