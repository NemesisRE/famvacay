import { type AirportRecord, type GeneratorContext, iataCodes, wikidataQuery } from './common';

/**
 * Annual passenger numbers (millions, one decimal) per IATA code from Wikidata (CC0)
 * "patronage" (P3872). A popularity signal so long-haul discovery prefers real gateways
 * (Bangkok, Sydney, Tashkent) over remote airstrips the airport dataset also flags as large.
 */
const BATCH_SIZE = 200;
const MIN_MILLIONS = 0.1;

export async function generateAirportTraffic(ctx: GeneratorContext, airports: AirportRecord[]): Promise<Record<string, number>> {
  const codes = iataCodes(airports);
  const result: Record<string, number> = {};
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    // Peak reported annual traffic: robust as an order-of-magnitude popularity signal, whereas
    // the latest statement is sometimes a partial year, one terminal or a domestic-only figure.
    const rows = await wikidataQuery(
      ctx,
      `
SELECT ?iata (MAX(?p) AS ?pax) WHERE {
  VALUES ?iata { ${batch.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  ?airport wdt:P3872 ?p .
} GROUP BY ?iata`
    );
    for (const r of rows) {
      const millions = Math.round((Number(r.pax.value) || 0) / 1e5) / 10;
      if (millions >= MIN_MILLIONS) result[r.iata.value] = millions;
    }
    await ctx.sleep(250); // be polite to the public endpoint
  }
  ctx.log(`Airport traffic: ${Object.keys(result).length} airports with passenger figures`);
  return result;
}
