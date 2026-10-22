/**
 * Flight Route Graph Generator
 *
 * Builds src/lib/airports/data/flight-routes.json - the non-stop airline route network between
 * the airports of src/lib/airports/data/airports.json - from the OpenFlights route database
 * (https://openflights.org/data, Open Database License). Format: { "FRA": "FNC JFK ...", ... },
 * an undirected adjacency list (a route flown in one direction is assumed to be flown back).
 *
 * The optimizer uses it to decide which flights are non-stop and where connections happen over
 * routes that actually exist, instead of inferring both from distances and hub lists.
 * Note: OpenFlights' route data was last updated in 2014; airports without route data fall back
 * to the distance-based model in src/lib/airports/flight-routes.ts.
 *
 * Usage: node scripts/generate-flight-routes.js
 */

const fs = require('fs');
const path = require('path');

const ROUTES_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';
const airports = require('../src/lib/airports/data/airports.json');
const outFile = path.join(__dirname, '../src/lib/airports/data/flight-routes.json');

// Airports closed since 2014 whose traffic moved to a successor (Berlin Tegel/Schoenefeld -> BER)
const SUCCESSOR_AIRPORTS = { TXL: 'BER', SXF: 'BER' };

async function main() {
  const res = await fetch(ROUTES_URL, { headers: { 'User-Agent': 'famvacay-route-generator/1.0 (https://famvacay.us)' } });
  if (!res.ok) throw new Error(`OpenFlights HTTP ${res.status}`);
  const lines = (await res.text()).trim().split('\n');

  const known = new Set(airports.map((a) => a.code));
  const adjacency = new Map();
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };

  let used = 0;
  for (const line of lines) {
    // airline, airline_id, source, source_id, destination, destination_id, codeshare, stops, equipment
    const f = line.split(',');
    const src = SUCCESSOR_AIRPORTS[f[2]] || f[2];
    const dst = SUCCESSOR_AIRPORTS[f[4]] || f[4];
    const stops = f[7];
    if (stops !== '0' || !/^[A-Z]{3}$/.test(src) || !/^[A-Z]{3}$/.test(dst) || src === dst) continue;
    if (!known.has(src) || !known.has(dst)) continue;
    link(src, dst);
    link(dst, src);
    used++;
  }

  const result = {};
  for (const code of Array.from(adjacency.keys()).sort()) {
    result[code] = Array.from(adjacency.get(code)).sort().join(' ');
  }

  fs.writeFileSync(outFile, JSON.stringify(result));
  const edges = Object.values(result).reduce((n, s) => n + s.split(' ').length, 0) / 2;
  console.log(
    `${used} non-stop routes -> ${Object.keys(result).length} airports, ${edges} airport pairs -> ${path.relative(process.cwd(), outFile)} (${fs.statSync(outFile).size} bytes)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
