import type { GeneratorContext } from './common';
import { fetchAllPages, latestValues, type CountryRow } from './price-levels';

/**
 * Tourist spending per international arrival in US dollars, per country (ISO 3166 alpha-2): the
 * World Bank's international tourism receipts (ST.INT.RCPT.CD) divided by international arrivals
 * (ST.INT.ARVL), most recent year of each. World Bank Open Data, CC BY 4.0.
 *
 * Shows where holidays cost more than the national price level suggests (island resorts, luxury
 * destinations); lifts the hotel rates there, see src/lib/pricing/hotel-rates.ts.
 */
const RECEIPTS = 'ST.INT.RCPT.CD';
const ARRIVALS = 'ST.INT.ARVL';
// Fewer arrivals than this make the ratio noise rather than a price signal
const MIN_ARRIVALS = 50_000;

export async function generateTourismSpend(ctx: GeneratorContext): Promise<Record<string, number>> {
  const countries = await fetchAllPages<CountryRow>(ctx, 'country');
  const realCountries = new Set(
    countries.filter((c) => c.region?.value !== 'Aggregates' && /^[A-Z]{2}$/.test(c.iso2Code)).map((c) => c.iso2Code)
  );
  const receipts = await latestValues(ctx, RECEIPTS);
  const arrivals = await latestValues(ctx, ARRIVALS);

  const result: Record<string, number> = {};
  for (const code of [...realCountries].sort()) {
    const r = receipts.get(code);
    const a = arrivals.get(code);
    if (!r || !a || a < MIN_ARRIVALS) continue;
    const perArrival = Math.round(r / a);
    if (perArrival >= 50 && perArrival <= 20000) result[code] = perArrival;
  }
  ctx.log(`Tourism spend: ${Object.keys(result).length} countries`);
  return result;
}
