import { describe, expect, it } from 'vitest';
import { getHolidayAppeal, getHolidayAppealSignals } from '../holiday-appeal';
import { discoverDestinationTiers } from '../destinations';
import { getAirportByIata } from '../../airports/airport-service';

const appeal = (code: string, styles: Parameters<typeof getHolidayAppeal>[1] = []) => getHolidayAppeal(code, styles) ?? 0;

describe('holiday appeal from Wikivoyage', () => {
  it('rates beach islands above business hubs for beach holidays', () => {
    expect(appeal('USM', ['BEACH'])).toBeGreaterThan(appeal('HET', ['BEACH']) + 0.3); // Koh Samui vs Hohhot
    expect(appeal('HKT', ['BEACH'])).toBeGreaterThan(appeal('AMD', ['BEACH']) + 0.3); // Phuket vs Ahmedabad
  });

  it('recognises ski destinations for alpine holidays', () => {
    expect(appeal('INN', ['ALPINE'])).toBeGreaterThan(appeal('PMI', ['ALPINE']));
    expect(getHolidayAppealSignals('INN')!.evidence.ski).toBeGreaterThan(0.5);
  });

  it('returns null for airports without a travel guide', () => {
    expect(getHolidayAppeal('ZZZ', ['BEACH'])).toBeNull();
  });

  it('stays within 0-1', () => {
    for (const code of ['BKK', 'HKT', 'USM', 'PMI', 'CDG', 'INN', 'HET']) {
      const value = appeal(code);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('discovery with holiday appeal and soft country balance', () => {
  const stuttgart = { departureLat: 48.78, departureLon: 9.18, travelVehicles: ['PLANE' as const] };
  const country = (code: string) => getAirportByIata(code)?.country;

  it('offers several climatically different Thai destinations for long-haul trips', () => {
    const { primary, extended } = discoverDestinationTiers(['LONGRANGE'], stuttgart);
    const thai = [...primary, ...extended].filter((c) => country(c) === 'Thailand');
    expect(thai.length).toBeGreaterThanOrEqual(2);
  });

  it('prefers holiday places over business hubs', () => {
    const { primary } = discoverDestinationTiers(['LONGRANGE'], stuttgart);
    expect(primary).not.toContain('HET');
  });

  it('keeps one country from dominating the first results', () => {
    const { primary } = discoverDestinationTiers(['ALL'], stuttgart);
    const perCountry = new Map<string, number>();
    for (const code of primary) perCountry.set(country(code) ?? '?', (perCountry.get(country(code) ?? '?') ?? 0) + 1);
    expect(Math.max(...perCountry.values())).toBeLessThanOrEqual(Math.ceil(primary.length / 5));
  });

  it('returns a second tier of new destinations for the background search', () => {
    const { primary, extended } = discoverDestinationTiers(['ALL'], stuttgart);
    expect(extended.length).toBeGreaterThan(10);
    expect(extended.filter((c) => primary.includes(c))).toEqual([]);
  });
});
