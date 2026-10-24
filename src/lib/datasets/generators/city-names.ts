import iso from 'iso-3166-2';
import { type AirportRecord, type GeneratorContext, iataCodes, wikidataQuery } from './common';

/**
 * Display name of the place each airport serves, in every UI language, from Wikidata (CC0):
 *   airport (P238 = IATA code) -> place served by transport hub (P931) -> rdfs:label per language
 * falling back to the airport's administrative location (P131) when P931 is missing.
 * Only names that differ from the raw dataset city are kept (keeps the client bundle small).
 */
const LOCALES = ['en', 'de', 'fr', 'es', 'it'] as const;
type Locale = (typeof LOCALES)[number];
const LANG_FILTER = `FILTER(LANG(?label) IN (${LOCALES.map((l) => `"${l}"`).join(',')}))`;
// Combining P931 and P131 (or population) in one query times out on the public endpoint,
// so each is its own small, fast pass.
const BATCH_SIZE = 150;

interface Place {
  uri: string;
  labels: Partial<Record<string, string>>;
}

const normalize = (s: string | undefined) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Wikidata labels of islands/regions are sometimes lowercase ('isola di Man', "île d'Elbe")
const capitalize = (s: string | undefined) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

const placeLabelsQuery = (property: string) => (codes: string[]) => `
SELECT ?iata ?place ?label WHERE {
  VALUES ?iata { ${codes.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  ?airport wdt:${property} ?place .
  ?place rdfs:label ?label .
  ${LANG_FILTER}
}`;

const populationQuery = (placeUris: string[]) => `
SELECT ?place ?pop WHERE {
  VALUES ?place { ${placeUris.map((u) => `<${u}>`).join(' ')} }
  ?place wdt:P1082 ?pop .
}`;

async function inBatches(ctx: GeneratorContext, items: string[], buildQuery: (batch: string[]) => string, onRows: (rows: any[]) => void) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    onRows(await wikidataQuery(ctx, buildQuery(items.slice(i, i + BATCH_SIZE))));
    await ctx.sleep(250); // be polite to the public endpoint
  }
}

/** code -> placeUri -> place with labels */
function collect(rows: any[], target: Map<string, Map<string, Place>>) {
  for (const r of rows) {
    const code = r.iata.value;
    const places = target.get(code) || new Map<string, Place>();
    const place: Place = places.get(r.place.value) || { uri: r.place.value, labels: {} };
    place.labels[r.label['xml:lang'] as string] = r.label.value;
    places.set(r.place.value, place);
    target.set(code, places);
  }
}

function labelsMatch(place: Place, name: string): boolean {
  const target = normalize(name);
  return Object.values(place.labels).some((l) => normalize(l) === target);
}

/**
 * The place an airport is named after when it serves several: one whose name matches the
 * dataset city wins (keeps e.g. BSL = Mulhouse consistent with the app), else the most populous.
 */
function pickPlace(places: Map<string, Place>, datasetCity: string, population: Map<string, number>): Place | undefined {
  return [...places.values()].sort((a, b) => {
    const matchA = labelsMatch(a, datasetCity) ? 1 : 0;
    const matchB = labelsMatch(b, datasetCity) ? 1 : 0;
    if (matchA !== matchB) return matchB - matchA;
    return (population.get(b.uri) || 0) - (population.get(a.uri) || 0);
  })[0];
}

export async function generateCityNames(
  ctx: GeneratorContext,
  airports: AirportRecord[]
): Promise<Record<string, Partial<Record<Locale, string>>>> {
  const codes = iataCodes(airports);
  const cityByCode = Object.fromEntries(airports.map((a) => [a.code, a.city]));
  const stateByCode = Object.fromEntries(airports.map((a) => [a.code, a.state]));

  ctx.log('City names: served places...');
  const served = new Map<string, Map<string, Place>>();
  await inBatches(ctx, codes, placeLabelsQuery('P931'), (rows) => collect(rows, served));

  ctx.log('City names: administrative locations...');
  const located = new Map<string, Map<string, Place>>();
  await inBatches(ctx, codes.filter((c) => !served.has(c)), placeLabelsQuery('P131'), (rows) => collect(rows, located));

  // Population, only where an airport has several candidate places
  const ambiguous = new Set<string>();
  for (const source of [served, located]) {
    for (const places of source.values()) if (places.size > 1) for (const uri of places.keys()) ambiguous.add(uri);
  }
  const population = new Map<string, number>();
  await inBatches(ctx, [...ambiguous], populationQuery, (rows) => {
    for (const r of rows) population.set(r.place.value, Math.max(population.get(r.place.value) || 0, Number(r.pop.value) || 0));
  });

  const result: Record<string, Partial<Record<Locale, string>>> = {};
  for (const code of codes) {
    const datasetCity = cityByCode[code] || '';
    let place: Place | undefined;
    if (served.has(code)) {
      place = pickPlace(served.get(code)!, datasetCity, population);
      // Some airports list their whole state as the place served (Hahn -> Rhineland-Palatinate);
      // a state/province name is not a destination name.
      const stateName = stateByCode[code] ? iso.subdivision(stateByCode[code])?.name : undefined;
      if (place && stateName && !labelsMatch(place, datasetCity) && labelsMatch(place, stateName)) place = undefined;
    } else if (located.has(code)) {
      // The administrative location is often a whole region or county; only use it when it is
      // the dataset city itself, i.e. as a translation.
      place = pickPlace(located.get(code)!, datasetCity, population);
      if (place && !labelsMatch(place, datasetCity)) place = undefined;
    }
    if (!place || !place.labels.en) continue;

    const entry: Partial<Record<Locale, string>> = {};
    for (const loc of LOCALES) {
      const label = capitalize(place.labels[loc] || place.labels.en);
      // Store only what differs from the raw dataset name (the runtime falls back to it)
      if (label && label !== datasetCity) entry[loc] = label;
    }
    if (Object.keys(entry).length > 0) result[code] = entry;
  }
  ctx.log(`City names: ${Object.keys(result).length} localized entries`);
  return result;
}
