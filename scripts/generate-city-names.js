/**
 * Localized City Name Generator
 *
 * Builds src/lib/airports/data/city-names.json - the display name of the place each airport
 * serves, in every UI language (en, de, fr, es, it) - from Wikidata (CC0):
 *   airport (P238 = IATA code) -> place served by transport hub (P931) -> rdfs:label per language
 * falling back to the airport's administrative location (P131) when P931 is missing.
 *
 * Only names that differ from the raw dataset city (src/lib/airports/data/airports.json) are
 * written, which keeps the client bundle small. Display-only: search and destination matching
 * keep using the raw dataset names.
 *
 * Usage: node scripts/generate-city-names.js
 */

const fs = require('fs');
const path = require('path');
const iso = require('iso-3166-2');

const LOCALES = ['en', 'de', 'fr', 'es', 'it'];
const LANG_FILTER = `FILTER(LANG(?label) IN (${LOCALES.map((l) => `"${l}"`).join(',')}))`;
const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'famvacay-city-names-generator/1.0 (https://famvacay.us)';
// Combining P931 and P131 (or population) in one query times out on the public endpoint,
// so each is its own small, fast pass.
const BATCH_SIZE = 150;

const airports = require('../src/lib/airports/data/airports.json');
const outFile = path.join(__dirname, '../src/lib/airports/data/city-names.json');

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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

async function inBatches(items, label, buildQuery, onRows) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    onRows(await query(buildQuery(batch)));
    process.stdout.write(`\r${label}: ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
    await sleep(250); // be polite to the public endpoint
  }
  process.stdout.write('\n');
}

const placeLabelsQuery = (property) => (codes) => `
SELECT ?iata ?place ?label WHERE {
  VALUES ?iata { ${codes.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  ?airport wdt:${property} ?place .
  ?place rdfs:label ?label .
  ${LANG_FILTER}
}`;

const populationQuery = (placeUris) => `
SELECT ?place ?pop WHERE {
  VALUES ?place { ${placeUris.map((u) => `<${u}>`).join(' ')} }
  ?place wdt:P1082 ?pop .
}`;

/** code -> placeUri -> { labels } */
function collect(rows, target) {
  for (const r of rows) {
    const code = r.iata.value;
    const places = target.get(code) || new Map();
    const place = places.get(r.place.value) || { uri: r.place.value, labels: {} };
    place.labels[r.label['xml:lang']] = r.label.value;
    places.set(r.place.value, place);
    target.set(code, places);
  }
}

/**
 * Chooses the place an airport is named after when it serves several: one whose name matches
 * the dataset city wins (keeps e.g. BSL = Mulhouse consistent with the rest of the app),
 * otherwise the most populous.
 */
function labelsMatch(place, datasetCity) {
  const target = normalize(datasetCity);
  return Object.values(place.labels).some((l) => normalize(l) === target);
}

// Wikidata labels of islands/regions are sometimes lowercase ('isola di Man', "île d'Elbe")
const capitalize = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

function pickPlace(places, datasetCity, population) {
  return [...places.values()].sort((a, b) => {
    const matchA = labelsMatch(a, datasetCity) ? 1 : 0;
    const matchB = labelsMatch(b, datasetCity) ? 1 : 0;
    if (matchA !== matchB) return matchB - matchA;
    return (population.get(b.uri) || 0) - (population.get(a.uri) || 0);
  })[0];
}

async function main() {
  const codes = [...new Set(airports.map((a) => a.code).filter((c) => /^[A-Z]{3}$/.test(c)))].sort();
  const cityByCode = Object.fromEntries(airports.map((a) => [a.code, a.city]));
  const stateByCode = Object.fromEntries(airports.map((a) => [a.code, a.state]));

  // 1. Place served by the airport (P931)
  const served = new Map();
  await inBatches(codes, 'served places', placeLabelsQuery('P931'), (rows) => collect(rows, served));

  // 2. Administrative location (P131) for airports without a served place
  const located = new Map();
  const missing = codes.filter((c) => !served.has(c));
  await inBatches(missing, 'admin locations', placeLabelsQuery('P131'), (rows) => collect(rows, located));

  // 3. Population, only where an airport has several candidate places
  const population = new Map();
  const ambiguous = new Set();
  for (const source of [served, located]) {
    for (const places of source.values()) {
      if (places.size > 1) for (const uri of places.keys()) ambiguous.add(uri);
    }
  }
  await inBatches([...ambiguous], 'populations', populationQuery, (rows) => {
    for (const r of rows) population.set(r.place.value, Math.max(population.get(r.place.value) || 0, Number(r.pop.value) || 0));
  });

  const result = {};
  for (const code of codes) {
    const datasetCity = cityByCode[code] || '';
    let place;
    if (served.has(code)) {
      place = pickPlace(served.get(code), datasetCity, population);
      // Some airports list their whole state as the place served (Hahn -> Rhineland-Palatinate);
      // a state/province name is not a destination name.
      const stateName = stateByCode[code] ? iso.subdivision(stateByCode[code])?.name : undefined;
      if (place && stateName && !labelsMatch(place, datasetCity) && labelsMatch(place, stateName)) place = undefined;
    } else if (located.has(code)) {
      // The administrative location is often a whole region or county (Hahn -> Rhineland-
      // Palatinate); only use it when it is the dataset city itself, i.e. as a translation.
      place = pickPlace(located.get(code), datasetCity, population);
      if (place && !labelsMatch(place, datasetCity)) place = undefined;
    }
    if (!place || !place.labels.en) continue;

    const entry = {};
    for (const loc of LOCALES) {
      const label = capitalize(place.labels[loc] || place.labels.en);
      // Store only what differs from the raw dataset name (the runtime falls back to it)
      if (label && label !== datasetCity) entry[loc] = label;
    }
    if (Object.keys(entry).length > 0) result[code] = entry;
  }

  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(
    `Wrote ${Object.keys(result).length} localized entries to ${path.relative(process.cwd(), outFile)} (${fs.statSync(outFile).size} bytes)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
