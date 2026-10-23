import { describe, it, expect } from 'vitest';
import { calculateEasterSunday, getAnnualSpecialTimes } from './special-dates';

describe('Annual Moving Holidays & Special Dates', () => {
  it('calculates Easter Sunday accurately across multiple years using astronomical algorithm', () => {
    // 2026: April 5
    const easter2026 = calculateEasterSunday(2026);
    expect(easter2026.getUTCFullYear()).toBe(2026);
    expect(easter2026.getUTCMonth()).toBe(3); // April is index 3
    expect(easter2026.getUTCDate()).toBe(5);

    // 2027: March 28
    const easter2027 = calculateEasterSunday(2027);
    expect(easter2027.getUTCFullYear()).toBe(2027);
    expect(easter2027.getUTCMonth()).toBe(2); // March is index 2
    expect(easter2027.getUTCDate()).toBe(28);

    // 2028: April 16
    const easter2028 = calculateEasterSunday(2028);
    expect(easter2028.getUTCFullYear()).toBe(2028);
    expect(easter2028.getUTCMonth()).toBe(3);
    expect(easter2028.getUTCDate()).toBe(16);
  });

  it('computes annual moving holiday periods with accurate start and end dates', () => {
    const list2026 = getAnnualSpecialTimes(2026, 'de');
    expect(list2026.length).toBe(5);

    // Easter 2026: Good Friday (Apr 3) to Easter Monday (Apr 6)
    const easter = list2026.find((h) => h.id === 'easter');
    expect(easter).toBeDefined();
    expect(easter?.name).toBe('Ostern');
    expect(easter?.startDate).toBe('2026-04-03');
    expect(easter?.endDate).toBe('2026-04-06');
    expect(easter?.icon).toBe('🐣');

    // Ascension 2026: 39-42 days after Easter -> May 14 to May 17
    const ascension = list2026.find((h) => h.id === 'ascension');
    expect(ascension).toBeDefined();
    expect(ascension?.name).toBe('Christi Himmelfahrt');
    expect(ascension?.startDate).toBe('2026-05-14');
    expect(ascension?.endDate).toBe('2026-05-17');

    // Pentecost 2026: 48-50 days after Easter -> May 23 to May 25
    const pentecost = list2026.find((h) => h.id === 'pentecost');
    expect(pentecost).toBeDefined();
    expect(pentecost?.name).toBe('Pfingsten');
    expect(pentecost?.startDate).toBe('2026-05-23');
    expect(pentecost?.endDate).toBe('2026-05-25');

    // Corpus Christi 2026: 60-63 days after Easter -> June 4 to June 7
    const corpus = list2026.find((h) => h.id === 'corpus_christi');
    expect(corpus).toBeDefined();
    expect(corpus?.name).toBe('Fronleichnam');
    expect(corpus?.startDate).toBe('2026-06-04');
    expect(corpus?.endDate).toBe('2026-06-07');

    // Christmas & New Year 2026/2027: Dec 24 to Jan 1
    const christmas = list2026.find((h) => h.id === 'christmas_new_year');
    expect(christmas).toBeDefined();
    expect(christmas?.startDate).toBe('2026-12-24');
    expect(christmas?.endDate).toBe('2027-01-01');
  });

  it('supports localized names for holidays', () => {
    const listEn = getAnnualSpecialTimes(2026, 'en');
    const easterEn = listEn.find((h) => h.id === 'easter');
    expect(easterEn?.name).toBe('Easter');

    const pentecostEn = listEn.find((h) => h.id === 'pentecost');
    expect(pentecostEn?.name).toBe('Pentecost');

    const listFr = getAnnualSpecialTimes(2026, 'fr');
    expect(listFr.find((h) => h.id === 'easter')?.name).toBe('Pâques');
    expect(listFr.find((h) => h.id === 'pentecost')?.name).toBe('Pentecôte');

    const listEs = getAnnualSpecialTimes(2026, 'es');
    expect(listEs.find((h) => h.id === 'easter')?.name).toBe('Semana Santa');
    expect(listEs.find((h) => h.id === 'pentecost')?.name).toBe('Pentecostés');
  });
});


describe('Year-independent holiday blackouts', () => {
  it('resolves every occurrence inside the travel period', async () => {
    const { resolveSpecialHolidayPeriods } = await import('./special-dates');
    // Easter 2027: March 28, Easter 2028: April 16
    const periods = resolveSpecialHolidayPeriods(['easter'], '2027-01-01', '2028-12-31', 'de');
    expect(periods.map((p) => [p.startDate, p.endDate])).toEqual([
      ['2027-03-26', '2027-03-29'],
      ['2028-04-14', '2028-04-17'],
    ]);
    expect(periods[0].name).toBe('Ostern');
  });

  it('includes a Christmas break that started the year before and skips holidays outside the period', async () => {
    const { resolveSpecialHolidayPeriods } = await import('./special-dates');
    const periods = resolveSpecialHolidayPeriods(['christmas_new_year', 'pentecost'], '2027-01-01', '2027-03-31');
    expect(periods.map((p) => p.id)).toEqual(['christmas_new_year']);
    expect(periods[0].startDate).toBe('2026-12-24');
    expect(resolveSpecialHolidayPeriods([], '2027-01-01', '2027-12-31')).toEqual([]);
  });

  it('names every holiday in the interface language', async () => {
    const { getSpecialHolidayMeta } = await import('./special-dates');
    expect(getSpecialHolidayMeta('pentecost', 'fr').name).toBe('Pentecôte');
    expect(getSpecialHolidayMeta('corpus_christi', 'it').description).toBe('Ponte del Corpus Domini');
  });
});
