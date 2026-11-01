import type { GeneratorContext } from './common';

/**
 * Price level per country (ISO 3166 alpha-2): what household consumption costs there relative to
 * the US at market exchange rates (USA = 1). The World Bank's PPP conversion factor for private
 * consumption (PA.NUS.PRVT.PP, International Comparison Program) divided by the official exchange
 * rate (PA.NUS.FCRF), most recent year of each. World Bank Open Data, CC BY 4.0.
 *
 * Scales the value of the meals included in a board type (a full board is worth much less in
 * Thailand than in Greece); see src/lib/pricing/meal-plan-value.ts.
 */
const API = 'https://api.worldbank.org/v2';
const PPP_PRIVATE_CONSUMPTION = 'PA.NUS.PRVT.PP';
const EXCHANGE_RATE = 'PA.NUS.FCRF';
const PER_PAGE = 400;

interface WorldBankPage<T> {
  page: number;
  pages: number;
}

async function fetchAllPages<T>(ctx: GeneratorContext, path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const url = `${API}/${path}${path.includes('?') ? '&' : '?'}format=json&per_page=${PER_PAGE}&page=${page}`;
    const res = await ctx.fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`World Bank API ${res.status} for ${path}`);
    const body = (await res.json()) as [WorldBankPage<T> | { message?: unknown }, T[] | null];
    const meta = body[0] as WorldBankPage<T>;
    if (!Array.isArray(body[1])) throw new Error(`World Bank API returned no data for ${path}`);
    rows.push(...body[1]);
    if (!meta.pages || page >= meta.pages) return rows;
    await ctx.sleep(200);
  }
}

interface CountryRow {
  iso2Code: string;
  region: { value: string };
}

interface IndicatorRow {
  country: { id: string };
  value: number | null;
}

async function latestValues(ctx: GeneratorContext, indicator: string): Promise<Map<string, number>> {
  // mrnev=1: the most recent non-empty value per country
  const rows = await fetchAllPages<IndicatorRow>(ctx, `country/all/indicator/${indicator}?mrnev=1`);
  const values = new Map<string, number>();
  for (const r of rows) {
    if (typeof r.value === 'number' && r.value > 0) values.set(r.country.id, r.value);
  }
  return values;
}

export async function generatePriceLevels(ctx: GeneratorContext): Promise<Record<string, number>> {
  const countries = await fetchAllPages<CountryRow>(ctx, 'country');
  // Aggregates (Euro area, World, income groups) are not places anyone travels to
  const realCountries = new Set(
    countries.filter((c) => c.region?.value !== 'Aggregates' && /^[A-Z]{2}$/.test(c.iso2Code)).map((c) => c.iso2Code)
  );
  const ppp = await latestValues(ctx, PPP_PRIVATE_CONSUMPTION);
  const exchange = await latestValues(ctx, EXCHANGE_RATE);

  const result: Record<string, number> = {};
  for (const code of [...realCountries].sort()) {
    const p = ppp.get(code);
    const fx = exchange.get(code);
    if (!p || !fx) continue;
    const level = Math.round((p / fx) * 100) / 100;
    // A value far outside any real economy is a unit mismatch upstream, not a price level
    if (level >= 0.05 && level <= 5) result[code] = level;
  }
  ctx.log(`Price levels: ${Object.keys(result).length} countries`);
  return result;
}
