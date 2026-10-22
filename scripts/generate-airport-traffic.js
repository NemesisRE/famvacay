/**
 * Airport Traffic Generator
 *
 * Builds src/lib/airports/data/airport-traffic.json - annual passenger numbers (millions,
 * one decimal) per IATA code - from Wikidata (CC0) "patronage" (P3872). Used as a popularity
 * signal so long-haul discovery prefers real gateways (Bangkok, Sydney, Tashkent) over remote
 * airstrips that the airport dataset also flags as large/major.
 *
 * Usage: node scripts/generate-airport-traffic.js
 */

const fs = require('fs');
const path = require('path');

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'famvacay-airport-traffic-generator/1.0 (https://famvacay.us)';
const BATCH_SIZE = 200;
const MIN_MILLIONS = 0.1;

const airports = require('../src/lib/airports/data/airports.json');
const outFile = path.join(__dirname, '../src/lib/airports/data/airport-traffic.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(sparql, attempt = 1) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ query: sparql }).toString(),
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`Wikidata HTTP ${res.status}`);
    await sleep(3000 * attempt);
    return query(sparql, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  return (await res.json()).results.bindings;
}

async function main() {
  const codes = [...new Set(airports.map((a) => a.code).filter((c) => /^[A-Z]{3}$/.test(c)))].sort();
  const result = {};

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    // Peak reported annual traffic: robust as an order-of-magnitude popularity signal, whereas
    // the latest statement is sometimes a partial year, one terminal or a domestic-only figure.
    const rows = await query(`
SELECT ?iata (MAX(?p) AS ?pax) WHERE {
  VALUES ?iata { ${batch.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  ?airport wdt:P3872 ?p .
} GROUP BY ?iata`);
    for (const r of rows) {
      const code = r.iata.value;
      const millions = Math.round((Number(r.pax.value) || 0) / 1e5) / 10;
      if (millions >= MIN_MILLIONS) result[code] = millions;
    }
    process.stdout.write(`\r${Math.min(i + BATCH_SIZE, codes.length)}/${codes.length} airports queried`);
    await sleep(250);
  }
  process.stdout.write('\n');

  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(
    `Wrote ${Object.keys(result).length} airports to ${path.relative(process.cwd(), outFile)} (${fs.statSync(outFile).size} bytes)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
