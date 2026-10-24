import { type AirportRecord, type GeneratorContext, fetchText } from './common';

/**
 * Non-stop airline route network between the dataset's airports, from the OpenFlights route
 * database (Open Database License). Format: { "FRA": "FNC JFK ...", ... } - an undirected
 * adjacency list (a route flown in one direction is assumed to be flown back).
 * OpenFlights' route data was last updated in 2014; airports without route data fall back to the
 * distance-based model in src/lib/airports/flight-routes.ts.
 */
const ROUTES_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';

// Airports closed since 2014 whose traffic moved to a successor (Berlin Tegel/Schoenefeld -> BER)
const SUCCESSOR_AIRPORTS: Record<string, string> = { TXL: 'BER', SXF: 'BER' };

export async function generateFlightRoutes(ctx: GeneratorContext, airports: AirportRecord[]): Promise<Record<string, string>> {
  ctx.log('Flight routes: fetching OpenFlights routes...');
  const lines = (await fetchText(ctx, ROUTES_URL)).trim().split('\n');
  const known = new Set(airports.map((a) => a.code));
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };

  for (const line of lines) {
    // airline, airline_id, source, source_id, destination, destination_id, codeshare, stops, equipment
    const f = line.split(',');
    const src = SUCCESSOR_AIRPORTS[f[2]] || f[2];
    const dst = SUCCESSOR_AIRPORTS[f[4]] || f[4];
    if (f[7] !== '0' || !/^[A-Z]{3}$/.test(src) || !/^[A-Z]{3}$/.test(dst) || src === dst) continue;
    if (!known.has(src) || !known.has(dst)) continue;
    link(src, dst);
    link(dst, src);
  }

  const result: Record<string, string> = {};
  for (const code of [...adjacency.keys()].sort()) {
    result[code] = [...adjacency.get(code)!].sort().join(' ');
  }
  ctx.log(`Flight routes: ${Object.keys(result).length} airports with non-stop routes`);
  return result;
}
