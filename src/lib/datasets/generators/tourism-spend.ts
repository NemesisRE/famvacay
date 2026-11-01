import type { GeneratorContext } from './common';
import { fetchAllPages, type CountryRow } from './price-levels';

/**
 * Tourist spending per international arrival in US dollars, per country (ISO 3166 alpha-2): the
 * World Bank's international tourism receipts (ST.INT.RCPT.CD) divided by international arrivals
 * (ST.INT.ARVL) of the same year, 2019 or the closest earlier one. World Bank Open Data, CC BY 4.0.
 *
 * Shows where holidays cost more than the national price level suggests (island resorts, luxury
 * destinations); lifts the hotel rates there, see src/lib/pricing/hotel-rates.ts.
 */
const RECEIPTS = 'ST.INT.RCPT.CD';
const ARRIVALS = 'ST.INT.ARVL';
// The latest data is 2020 or later, when arrivals collapsed while receipts kept transport and
// long stays: the ratio then says nothing about prices. 2019 is the last normal year.
const YEARS = [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012];
// Fewer arrivals than this make the ratio noise rather than a price signal
const MIN_ARRIVALS = 50_000;

async function valuesOfYear(ctx: GeneratorContext, indicator: string, year: number): Promise<Map<string, number>> {
  const rows = await fetchAllPages<{ country: { id: string }; value: number | null }>(
    ctx,
    `country/all/indicator/${indicator}?date=${year}`
  );
  const values = new Map<string, number>();
  for (const r of rows) {
    if (typeof r.value === 'number' && r.value > 0) values.set(r.country.id, r.value);
  }
  return values;
}

export async function generateTourismSpend(ctx: GeneratorContext): Promise<Record<string, number>> {
  const countries = await fetchAllPages<CountryRow>(ctx, 'country');
  const realCountries = new Set(
    countries.filter((c) => c.region?.value !== 'Aggregates' && /^[A-Z]{2}$/.test(c.iso2Code)).map((c) => c.iso2Code)
  );

  const result: Record<string, number> = {};
  // A country takes the first year where both numbers exist, never receipts and arrivals of different years
  for (const year of YEARS) {
    const receipts = await valuesOfYear(ctx, RECEIPTS, year);
    const arrivals = await valuesOfYear(ctx, ARRIVALS, year);
    for (const code of [...realCountries].sort()) {
      if (result[code]) continue;
      const r = receipts.get(code);
      const a = arrivals.get(code);
      if (!r || !a || a < MIN_ARRIVALS) continue;
      const perArrival = Math.round(r / a);
      if (perArrival >= 50 && perArrival <= 20000) result[code] = perArrival;
    }
  }
  ctx.log(`Tourism spend: ${Object.keys(result).length} countries`);
  return result;
}
