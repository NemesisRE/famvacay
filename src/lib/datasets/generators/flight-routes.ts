import { type AirportRecord, type GeneratorContext, USER_AGENT, fetchText, wikidataQuery } from './common';

/**
 * Non-stop airline route network between the dataset's airports. Format: { "FRA": "FNC JFK ...",
 * ... } - an undirected adjacency list (a route flown in one direction is assumed to be flown back).
 *
 * Primary source: the "Airlines and destinations" tables of English Wikipedia's airport articles
 * (route facts only; airport articles are matched to IATA codes through Wikidata, CC0). They are
 * kept current with sources and include the seasonal and charter routes holiday airports live on
 * (Air Cairo Frankfurt/Stuttgart - Marsa Alam).
 * Fallback: the OpenFlights route database (Open Database License, last updated in 2014), only for
 * routes between airports that both have no Wikipedia table - otherwise a route dropped since
 * 2014 would survive. Airports without any route data use the distance-based model in
 * src/lib/airports/flight-routes.ts.
 */
const ROUTES_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';

// Airports closed since 2014 whose traffic moved to a successor (Berlin Tegel/Schoenefeld -> BER)
const SUCCESSOR_AIRPORTS: Record<string, string> = { TXL: 'BER', SXF: 'BER' };

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const SPARQL_BATCH = 200;
const PAGE_BATCH = 50;
const REQUEST_TIMEOUT_MS = 30_000;

type Adjacency = Map<string, Set<string>>;

function addRoute(adjacency: Adjacency, a: string, b: string): void {
  if (a === b) return;
  for (const [from, to] of [[a, b], [b, a]]) {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from)!.add(to);
  }
}

async function fetchOpenFlightsRoutes(ctx: GeneratorContext, known: Set<string>): Promise<Adjacency> {
  ctx.log('Flight routes: fetching OpenFlights routes...');
  const lines = (await fetchText(ctx, ROUTES_URL)).trim().split('\n');
  const adjacency: Adjacency = new Map();
  for (const line of lines) {
    // airline, airline_id, source, source_id, destination, destination_id, codeshare, stops, equipment
    const f = line.split(',');
    const src = SUCCESSOR_AIRPORTS[f[2]] || f[2];
    const dst = SUCCESSOR_AIRPORTS[f[4]] || f[4];
    if (f[7] !== '0' || !/^[A-Z]{3}$/.test(src) || !/^[A-Z]{3}$/.test(dst)) continue;
    if (!known.has(src) || !known.has(dst)) continue;
    addRoute(adjacency, src, dst);
  }
  return adjacency;
}

async function wikipediaQuery(ctx: GeneratorContext, params: Record<string, string>): Promise<any> {
  const url = `${WIKIPEDIA_API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 1; ; attempt++) {
    const res = await ctx
      .fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      .catch(() => null);
    if (res?.ok) return res.json();
    if (attempt >= 4) throw new Error(`Wikipedia HTTP ${res?.status ?? 'timeout'}`);
    await ctx.sleep(3_000 * attempt);
  }
}

/** Footnote templates: their links ("operates via Santo Domingo") are not destinations */
const FOOTNOTE_TEMPLATE = /^\{\{\s*(efn|refn|notetag|note label|ref label|sfn|cref)\b/i;

/** Removes every template matching `pattern` at its opening, with balanced (nested) braces */
function stripTemplates(text: string, pattern: RegExp): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('{{', i) && pattern.test(text.slice(i, i + 40))) {
      let depth = 0;
      let j = i;
      while (j < text.length) {
        if (text.startsWith('{{', j)) {
          depth++;
          j += 2;
        } else if (text.startsWith('}}', j)) {
          depth--;
          j += 2;
          if (depth === 0) break;
        } else j++;
      }
      i = j;
    } else out += text[i++];
  }
  return out;
}

/** Passenger part of an article's "Airlines and destinations" section (cargo, notes and refs removed) */
export function passengerDestinationsText(wikitext: string): string {
  const start = wikitext.search(/\n==\s*Airlines and destinations\s*==/i);
  if (start < 0) return '';
  const rest = wikitext.slice(start + 1);
  const end = rest.slice(2).search(/\n==[^=]/);
  let section = end < 0 ? rest : rest.slice(0, end + 2);
  const cargo = section.search(/\n===+\s*Cargo/i);
  if (cargo >= 0) section = section.slice(0, cargo);
  return stripTemplates(
    section
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ref[^>]*\/>/gi, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ''),
    FOOTNOTE_TEMPLATE
  );
}

const AIRPORT_LIKE_TITLE = /\b(airport|aerodrome|airfield|air base|airstrip|heliport|aeroporto|aeropuerto|a[ée]roport|flughafen|lufthavn|havalimanı)\b/i;

/**
 * Destinations per airline, in the order of the table: every link that is not an airport (the
 * airline column) starts a new group, the airport links after it are its destinations.
 */
export function groupByAirline(
  links: string[],
  airportOf: (title: string) => string | undefined,
  canonical: (title: string) => string = (t) => t
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  let airline = '';
  for (const title of links) {
    const iata = airportOf(title);
    if (!iata) {
      // An airport outside the dataset is a destination we cannot use, not the next airline
      if (!AIRPORT_LIKE_TITLE.test(title)) airline = canonical(title);
      continue;
    }
    if (!groups.has(airline)) groups.set(airline, new Set());
    groups.get(airline)!.add(iata);
  }
  return groups;
}

/** Longer than any airliner flies non-stop (the longest scheduled flights are ~15,300 km) */
const MAX_NONSTOP_KM = 16_000;
/** A stop this close to the straight line is "on the way": the flight continues through it */
const EN_ROUTE_DETOUR = 1.05;
/** ...and not merely next to either end */
const EN_ROUTE_MIN_SHARE = 0.1;
/**
 * A through flight ends at an outpost of the airline: there it serves only that line (Condor at
 * Denpasar: Bangkok and Frankfurt). Where it serves more (airBaltic at Tallinn), the airline has
 * a base, and a stop on the way is just another of its non-stop flights.
 */
const MAX_OUTPOST_DESTINATIONS = 3;
/**
 * Through flights are a long-haul pattern (Frankfurt - Bangkok - Denpasar). Below this, airlines
 * with several bases fly the same holiday airport from each of them (Norwegian Oslo and
 * Copenhagen - Pula), which looks alike but is all non-stop.
 */
const MIN_THROUGH_FLIGHT_KM = 3000;

type Coordinates = (code: string) => { lat: number; lon: number } | undefined;

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Non-stop network from the per-airline destination lists. Wikipedia lists every destination a
 * flight number serves, so a through flight A -> B -> C (Condor Frankfurt - Bangkok - Denpasar)
 * appears as if A - C were non-stop. Such a leg is left out when the same airline lists both the
 * stop B and the far end C at A, serves only that line at C (A and B, see MAX_OUTPOST_DESTINATIONS)
 * and B lies on the way. Real non-stop flights do not match: Singapore does not list Bangkok for
 * Lufthansa, and airBaltic serves far more than Athens and Riga from Tallinn.
 */
export function buildRouteNetwork(
  listings: Map<string, Map<string, Set<string>>>,
  coordsOf: Coordinates
): { adjacency: Adjacency; throughFlights: string[] } {
  /** The stop of `airline`'s through flight from its station `origin` to its outpost, if it is one */
  const throughStop = (airline: string, origin: string, outpost: string, direct: number): string | undefined => {
    const fromOrigin = listings.get(origin)?.get(airline);
    const atOutpost = listings.get(outpost)?.get(airline);
    if (!fromOrigin || !atOutpost?.has(origin) || atOutpost.size > MAX_OUTPOST_DESTINATIONS) return undefined;
    const po = coordsOf(origin)!;
    const pt = coordsOf(outpost)!;
    for (const b of fromOrigin) {
      if (b === outpost || !atOutpost.has(b)) continue;
      // The stop is an outpost too (Condor at Bangkok), not one of the airline's bases
      // (Norwegian at Copenhagen, with its own non-stop flights to the same places)
      const atStop = listings.get(b)?.get(airline);
      if (!atStop || atStop.size > MAX_OUTPOST_DESTINATIONS + 1) continue;
      const pb = coordsOf(b);
      if (!pb) continue;
      const ob = distanceKm(po, pb);
      const bt = distanceKm(pb, pt);
      if (ob + bt <= direct * EN_ROUTE_DETOUR && Math.min(ob, bt) >= direct * EN_ROUTE_MIN_SHARE) return b;
    }
    return undefined;
  };

  const adjacency: Adjacency = new Map();
  const throughFlights: string[] = [];
  for (const [a, airlines] of listings) {
    const pa = coordsOf(a);
    for (const [airline, destinations] of airlines) {
      for (const c of destinations) {
        const pc = coordsOf(c);
        if (!pa || !pc) {
          addRoute(adjacency, a, c);
          continue;
        }
        const direct = distanceKm(pa, pc);
        if (direct > MAX_NONSTOP_KM) {
          throughFlights.push(`${airline}: ${a}-${c} (${Math.round(direct)} km)`);
          continue;
        }
        // Either end may be the outpost: Denpasar lists Frankfurt as much as Frankfurt lists Denpasar
        const via =
          airline && direct >= MIN_THROUGH_FLIGHT_KM
            ? throughStop(airline, a, c, direct) ?? throughStop(airline, c, a, direct)
            : undefined;
        if (via) throughFlights.push(`${airline}: ${a}-${via}-${c}`);
        else addRoute(adjacency, a, c);
      }
    }
  }
  return { adjacency, throughFlights };
}

/**
 * Targets of the wiki links in a text: "[[Frankfurt Airport|Frankfurt]]" -> "Frankfurt Airport".
 * A destination marked as ended before `now` ("[[Hahn Airport|Hahn]] (ends 25 October 2025)") is
 * left out: editors do not always remove a route right after its last flight.
 */
export function linkTargets(text: string, now: Date = new Date()): string[] {
  const matches = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)];
  const targets: string[] = [];
  matches.forEach((m, i) => {
    const after = text.slice(m.index! + m[0].length, i + 1 < matches.length ? matches[i + 1].index : undefined);
    const ends = after.match(/^[^\n[]{0,12}\(\s*ends?\s+([^)]+?)\s*\)/i);
    const endDate = ends ? Date.parse(ends[1]) : NaN;
    if (!Number.isNaN(endDate) && endDate < now.getTime()) return;
    targets.push(normalizeTitle(m[1]));
  });
  return targets;
}

function normalizeTitle(title: string): string {
  const t = title.replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function fetchWikipediaRoutes(
  ctx: GeneratorContext,
  codes: string[],
  coordsOf: Coordinates
): Promise<{ adjacency: Adjacency; covered: Set<string> }> {
  // Wikipedia article title of every airport (several Wikidata items can share an IATA code)
  const iataByTitle = new Map<string, string>();
  for (let i = 0; i < codes.length; i += SPARQL_BATCH) {
    const batch = codes.slice(i, i + SPARQL_BATCH);
    const rows = await wikidataQuery(
      ctx,
      `
SELECT ?iata ?title WHERE {
  VALUES ?iata { ${batch.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  ?article schema:about ?airport ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`
    );
    for (const r of rows) iataByTitle.set(normalizeTitle(r.title.value), r.iata.value);
    await ctx.sleep(250);
  }
  ctx.log(`Flight routes: ${iataByTitle.size} Wikipedia airport articles`);

  // Destination links per airport article
  const linksByAirport = new Map<string, string[]>();
  const titles = [...iataByTitle.keys()];
  for (let i = 0; i < titles.length; i += PAGE_BATCH) {
    const json = await wikipediaQuery(ctx, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: titles.slice(i, i + PAGE_BATCH).join('|'),
    });
    for (const page of json.query?.pages ?? []) {
      const iata = iataByTitle.get(normalizeTitle(page.title));
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!iata || !text) continue;
      const links = linkTargets(passengerDestinationsText(text));
      if (links.length > 0) linksByAirport.set(iata, [...(linksByAirport.get(iata) ?? []), ...links]);
    }
    if ((i / PAGE_BATCH) % 10 === 0) ctx.log(`Flight routes: read ${Math.min(i + PAGE_BATCH, titles.length)} / ${titles.length} articles`);
    await ctx.sleep(200);
  }

  // Links to redirects ("Frankfurt am Main Airport", "Condor Flugdienst") resolve to the article
  // title: airports to their IATA code, airlines to one name across all articles
  const canonicalTitle = new Map<string, string>();
  const unresolved = [...new Set([...linksByAirport.values()].flat())].filter((t) => !iataByTitle.has(t));
  for (let i = 0; i < unresolved.length; i += PAGE_BATCH) {
    const json = await wikipediaQuery(ctx, { action: 'query', redirects: '1', titles: unresolved.slice(i, i + PAGE_BATCH).join('|') });
    for (const r of json.query?.redirects ?? []) {
      const from = normalizeTitle(r.from);
      const to = normalizeTitle(r.to);
      canonicalTitle.set(from, to);
      const iata = iataByTitle.get(to);
      if (iata) iataByTitle.set(from, iata);
    }
    await ctx.sleep(200);
  }

  const airportOf = (title: string) => {
    const iata = iataByTitle.get(title);
    return iata ? SUCCESSOR_AIRPORTS[iata] || iata : undefined;
  };
  const listings = new Map<string, Map<string, Set<string>>>();
  for (const [airport, links] of linksByAirport) {
    const groups = groupByAirline(links, airportOf, (t) => canonicalTitle.get(t) ?? t);
    if (groups.size > 0) listings.set(SUCCESSOR_AIRPORTS[airport] || airport, groups);
  }
  const { adjacency, throughFlights } = buildRouteNetwork(listings, coordsOf);
  ctx.log(`Flight routes: ${throughFlights.length} through-flight or out-of-range legs left out, e.g. ${throughFlights.slice(0, 5).join('; ')}`);
  return { adjacency, covered: new Set(listings.keys()) };
}

export async function generateFlightRoutes(ctx: GeneratorContext, airports: AirportRecord[]): Promise<Record<string, string>> {
  const known = new Set(airports.map((a) => a.code));
  const openFlights = await fetchOpenFlightsRoutes(ctx, known);

  let adjacency: Adjacency = openFlights;
  try {
    const byCode = new Map(airports.map((a) => [a.code, a]));
    const wikipedia = await fetchWikipediaRoutes(ctx, [...known].sort(), (code) => byCode.get(code));
    adjacency = new Map();
    for (const [a, targets] of wikipedia.adjacency) for (const b of targets) if (known.has(a) && known.has(b)) addRoute(adjacency, a, b);
    let kept = 0;
    for (const [a, targets] of openFlights) {
      for (const b of targets) {
        if (wikipedia.covered.has(a) || wikipedia.covered.has(b)) continue;
        addRoute(adjacency, a, b);
        kept++;
      }
    }
    ctx.log(`Flight routes: ${wikipedia.covered.size} airports from Wikipedia, ${kept / 2} OpenFlights routes kept for the rest`);
  } catch (err) {
    // A failed Wikipedia run must not wipe the network: OpenFlights alone is stale but complete
    ctx.log(`Flight routes: Wikipedia unavailable (${(err as Error).message}), using OpenFlights only`);
  }

  const result: Record<string, string> = {};
  for (const code of [...adjacency.keys()].sort()) {
    result[code] = [...adjacency.get(code)!].sort().join(' ');
  }
  ctx.log(`Flight routes: ${Object.keys(result).length} airports with non-stop routes`);
  return result;
}
