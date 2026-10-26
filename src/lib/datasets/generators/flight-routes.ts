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

/** Passenger part of an article's "Airlines and destinations" section (cargo, notes and refs removed) */
export function passengerDestinationsText(wikitext: string): string {
  const start = wikitext.search(/\n==\s*Airlines and destinations\s*==/i);
  if (start < 0) return '';
  const rest = wikitext.slice(start + 1);
  const end = rest.slice(2).search(/\n==[^=]/);
  let section = end < 0 ? rest : rest.slice(0, end + 2);
  const cargo = section.search(/\n===+\s*Cargo/i);
  if (cargo >= 0) section = section.slice(0, cargo);
  return section
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
}

/** Targets of the wiki links in a text: "[[Frankfurt Airport|Frankfurt]]" -> "Frankfurt Airport" */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => normalizeTitle(m[1]));
}

function normalizeTitle(title: string): string {
  const t = title.replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function fetchWikipediaRoutes(ctx: GeneratorContext, codes: string[]): Promise<{ adjacency: Adjacency; covered: Set<string> }> {
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

  // Links to redirects ("Frankfurt am Main Airport") resolve to the article title
  const unresolved = [...new Set([...linksByAirport.values()].flat())].filter((t) => !iataByTitle.has(t));
  for (let i = 0; i < unresolved.length; i += PAGE_BATCH) {
    const json = await wikipediaQuery(ctx, { action: 'query', redirects: '1', titles: unresolved.slice(i, i + PAGE_BATCH).join('|') });
    for (const r of json.query?.redirects ?? []) {
      const iata = iataByTitle.get(normalizeTitle(r.to));
      if (iata) iataByTitle.set(normalizeTitle(r.from), iata);
    }
    await ctx.sleep(200);
  }

  // Airline links and anything else that is not an airport article simply do not resolve
  const adjacency: Adjacency = new Map();
  const covered = new Set<string>();
  for (const [airport, links] of linksByAirport) {
    const from = SUCCESSOR_AIRPORTS[airport] || airport;
    for (const title of links) {
      const iata = iataByTitle.get(title);
      if (!iata) continue;
      covered.add(from);
      addRoute(adjacency, from, SUCCESSOR_AIRPORTS[iata] || iata);
    }
  }
  return { adjacency, covered };
}

export async function generateFlightRoutes(ctx: GeneratorContext, airports: AirportRecord[]): Promise<Record<string, string>> {
  const known = new Set(airports.map((a) => a.code));
  const openFlights = await fetchOpenFlightsRoutes(ctx, known);

  let adjacency: Adjacency = openFlights;
  try {
    const wikipedia = await fetchWikipediaRoutes(ctx, [...known].sort());
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
