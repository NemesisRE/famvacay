import { describe, it, expect, vi } from 'vitest';
import { mealPriceFactor, mealPricePercentOfHome, localMealPlanRates, MEAL_PLAN_DAILY_VALUE, MEAL_PRICE_REFERENCE_LEVEL } from '../meal-plan-value';
import { calculateMealPlanDailyValue, getSynchronousTripPricing } from '../pricing-service';
import { destinationCountryCode, getCountryPriceLevel } from '../price-levels';
import { generatePriceLevels } from '@/lib/datasets/generators/price-levels';
import { generateTourismSpend } from '@/lib/datasets/generators/tourism-spend';

describe('meal value at the destination price level', () => {
  it('is the base value at the Mediterranean reference and without data', () => {
    expect(mealPriceFactor(MEAL_PRICE_REFERENCE_LEVEL)).toBe(1);
    expect(mealPriceFactor(undefined)).toBe(1);
    expect(localMealPlanRates('ALL_INCLUSIVE', undefined)).toEqual({ ...MEAL_PLAN_DAILY_VALUE.ALL_INCLUSIVE, priceFactor: 1 });
  });

  it('is lower in cheap and higher in expensive countries, dampened and capped', () => {
    const thailand = mealPriceFactor(0.32);
    const greece = mealPriceFactor(0.66);
    const switzerland = mealPriceFactor(1.28);
    expect(thailand).toBeLessThan(greece);
    expect(greece).toBeLessThan(switzerland);
    // Resort meals in cheap countries cost more than the local average: not the plain ratio
    expect(thailand).toBeGreaterThan(0.32 / MEAL_PRICE_REFERENCE_LEVEL);
    expect(mealPriceFactor(0.05)).toBe(0.35);
    expect(mealPriceFactor(5)).toBe(1.8);
  });

  it('scales the daily value of the whole party', () => {
    const base = calculateMealPlanDailyValue('ALL_INCLUSIVE', 2, [5, 8]);
    const thailand = calculateMealPlanDailyValue('ALL_INCLUSIVE', 2, [5, 8], 0.32);
    expect(base.totalDaily).toBe(2 * 55 + 2 * 30);
    expect(thailand.totalDaily).toBe(2 * thailand.dailyAdult + 2 * thailand.dailyChild);
    expect(thailand.totalDaily).toBeLessThan(base.totalDaily * 0.7);
  });
});

describe('destination country and price-level data', () => {
  it('takes the country from the subdivision code or the name', () => {
    expect(destinationCountryCode({ state: 'TH-10', country: 'Thailand' })).toBe('TH');
    expect(destinationCountryCode({ country: 'Greece' })).toBe('GR');
    expect(destinationCountryCode(null)).toBeUndefined();
  });

  it('has price levels for the usual holiday countries', () => {
    for (const code of ['TH', 'GR', 'ES', 'TR', 'EG', 'IT', 'PT', 'HR', 'CH', 'US']) {
      expect(getCountryPriceLevel(code), code).toBeGreaterThan(0);
    }
    expect(getCountryPriceLevel('TH')!).toBeLessThan(getCountryPriceLevel('GR')!);
  });

  it('values an all-inclusive stay in Thailand below one in Greece', () => {
    const trip = (destinationAirport: string) =>
      getSynchronousTripPricing({
        originAirport: 'FRA',
        destinationAirport,
        startDate: '2026-11-02',
        endDate: '2026-11-12',
        durationDays: 10,
        party: { adults: 2, childrenAges: [6, 9] },
        preferredBoardType: 'ALL_INCLUSIVE',
      });
    const bangkok = trip('BKK');
    const heraklion = trip('HER');
    expect(bangkok.mealPlanRates!.adult).toBeLessThan(heraklion.mealPlanRates!.adult);
    expect(bangkok.mealPlanValue!).toBeLessThan(heraklion.mealPlanValue!);
  });
});

describe('comparison with the home country (never a fixed region)', () => {
  const thailandFrom = (homeCountry?: string) =>
    getSynchronousTripPricing({
      originAirport: 'SYD',
      destinationAirport: 'BKK',
      startDate: '2026-11-02',
      endDate: '2026-11-12',
      durationDays: 10,
      party: { adults: 2, childrenAges: [6] },
      preferredBoardType: 'ALL_INCLUSIVE',
      homeCountry,
    }).mealPlanRates!;

  it('compares with the travellers own country, with the valuation dampening', () => {
    const fromAustralia = thailandFrom('AU').homeComparison!;
    const fromGermany = thailandFrom('DE').homeComparison!;
    expect(fromAustralia.country).toBe('AU');
    expect(fromAustralia.percent).toBe(mealPricePercentOfHome(getCountryPriceLevel('TH'), getCountryPriceLevel('AU')));
    expect(fromAustralia.percent).toBeLessThan(100);
    expect(fromGermany.percent).toBeLessThan(100);
  });

  it('gives no comparison without a known home country', () => {
    expect(thailandFrom(undefined).homeComparison).toBeUndefined();
    expect(thailandFrom('ZZ').homeComparison).toBeUndefined();
  });
});

describe('price-level generator (World Bank API)', () => {
  it('divides the consumption PPP by the exchange rate and skips aggregates', async () => {
    const pages: Record<string, unknown[]> = {
      country: [
        { iso2Code: 'TH', region: { value: 'East Asia & Pacific' } },
        { iso2Code: 'GR', region: { value: 'Europe & Central Asia' } },
        { iso2Code: 'XC', region: { value: 'Aggregates' } },
      ],
      'PA.NUS.PRVT.PP': [
        { country: { id: 'TH' }, value: 10.6 },
        { country: { id: 'GR' }, value: 0.58 },
        { country: { id: 'XC' }, value: 0.7 },
      ],
      'PA.NUS.FCRF': [
        { country: { id: 'TH' }, value: 32.9 },
        { country: { id: 'GR' }, value: 0.885 },
        { country: { id: 'XC' }, value: 0.885 },
      ],
    };
    const fetchMock = vi.fn(async (url: string) => {
      const key = Object.keys(pages).find((k) => url.includes(k === 'country' ? '/country?' : k))!;
      return new Response(JSON.stringify([{ page: 1, pages: 1 }, pages[key]]), { status: 200 });
    });
    const levels = await generatePriceLevels({ fetch: fetchMock as unknown as typeof fetch, sleep: async () => {}, log: () => {} });
    expect(levels).toEqual({ GR: 0.66, TH: 0.32 });
  });

  it('derives tourist spend per arrival and skips tiny arrival counts', async () => {
    const pages: Record<string, unknown[]> = {
      country: [
        { iso2Code: 'MV', region: { value: 'South Asia' } },
        { iso2Code: 'ES', region: { value: 'Europe & Central Asia' } },
        { iso2Code: 'TV', region: { value: 'East Asia & Pacific' } },
      ],
      'ST.INT.RCPT.CD': [
        { country: { id: 'MV' }, value: 4_000_000_000 },
        { country: { id: 'ES' }, value: 90_000_000_000 },
        { country: { id: 'TV' }, value: 1_000_000 },
      ],
      'ST.INT.ARVL': [
        { country: { id: 'MV' }, value: 1_900_000 },
        { country: { id: 'ES' }, value: 85_000_000 },
        { country: { id: 'TV' }, value: 2_000 },
      ],
    };
    const fetchMock = vi.fn(async (url: string) => {
      const key = Object.keys(pages).find((k) => url.includes(k === 'country' ? '/country?' : k))!;
      return new Response(JSON.stringify([{ page: 1, pages: 1 }, pages[key]]), { status: 200 });
    });
    const spend = await generateTourismSpend({ fetch: fetchMock as unknown as typeof fetch, sleep: async () => {}, log: () => {} });
    expect(spend).toEqual({ ES: 1059, MV: 2105 });
  });
});
