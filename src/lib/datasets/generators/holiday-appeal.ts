import { type AirportRecord, type GeneratorContext, USER_AGENT, iataCodes, wikidataQuery } from './common';
import { calculateGeodesicDistanceKm } from '../../airports/airport-service';
import { HOLIDAY_EVIDENCE_KINDS, holidayEvidence, type HolidayEvidenceKind } from '../../optimizer/holiday-evidence';

/**
 * Holiday appeal per airport from Wikivoyage (CC BY-SA text, read for statistics only - nothing
 * is republished) and Wikimedia page views (CC0). Airport passenger numbers measure hubs and
 * business traffic; a travel guide measures where people actually go on holiday, and what for.
 *
 * Wikidata (CC0) links each airport to its guides through
 * - the places it serves (P931), e.g. Palma and Mallorca,
 * - the island it lies on (P706), e.g. Crete for Heraklion, when few airports share it,
 * - otherwise the territory it lies in (P131), when that is small (not a whole province).
 * Per airport the generator records:
 *   [annual page views of its most-read place (en+de+fr+es+it guides),
 *    then for beach, ski, nature, culture and family: mentions, article size (kB)]
 * Each kind of holiday takes its figures from the article that says the most about it, among the
 * airport's places in English and German (German Wikivoyage covers many Mediterranean destinations
 * in far more depth): the English Nassau guide for beaches, the German one for sights.
 *
 * Airports whose Wikidata links reach no guide (Zanzibar: its guide belongs to another item) try
 * the guide named like the airport's city, accepted only when that article is not a
 * disambiguation page and its own coordinates lie within 100 km of the airport.
 *
 * The same run yields display names (see generateHolidayData): where the most-read guide of an
 * airport's places is a famous island or region rather than the airport's city, that name is used
 * - "Bali" instead of Denpasar, "Kreta (Heraklion)" where several airports share the island.
 * Raw counts, so the scoring in src/lib/optimizer/holiday-appeal.ts can change without a re-run.
 */

export type HolidayAppealRow = [
  views: number,
  beach: number,
  beachKb: number,
  ski: number,
  skiKb: number,
  nature: number,
  natureKb: number,
  culture: number,
  cultureKb: number,
  family: number,
  familyKb: number,
];

export const HOLIDAY_APPEAL_ROW_LENGTH = 11;

/** Index of a kind's mention count in a row; the article size follows it */
export const HOLIDAY_APPEAL_ROW_INDEX: Record<HolidayEvidenceKind, number> = {
  beach: 1,
  ski: 3,
  nature: 5,
  culture: 7,
  family: 9,
};

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it'] as const;
type Language = (typeof LANGUAGES)[number];
/** Article texts are analysed in these languages */
const TEXT_LANGUAGES = ['en', 'de'] as const;
type TextLanguage = (typeof TEXT_LANGUAGES)[number];

const SPARQL_BATCH = 150;
/** An island with more airports than this is a large landmass, not one destination */
const MAX_AIRPORTS_PER_ISLAND = 4;
/** A territory with more airports than this is too large to describe any one of them */
const MAX_AIRPORTS_PER_TERRITORY = 2;
const ARTICLE_BATCH = 50;
const PAGEVIEW_CONCURRENCY = 6;
/** No single request may stall the run (a hung connection would otherwise block it for good) */
const REQUEST_TIMEOUT_MS = 30_000;

type Signal = HolidayEvidenceKind;

const KEYWORDS: Record<TextLanguage, Record<Signal, RegExp>> = {
  en: {
    beach: /\b(beach(es)?|snorkel\w*|scuba|dive sites?|diving|surf(ing|ers?)?|lagoons?|coral reefs?)\b/gi,
    ski: /\b(ski(ing|ers?)?|pistes?|ski resorts?|ski lifts?|snowboard\w*|apr[eè]s-ski)\b/gi,
    nature: /\b(hik(e|es|ing)|hiking trails?|national parks?|waterfalls?|nature reserves?|trek(s|king)?|wildlife|safaris?|canyons?)\b/gi,
    culture: /\b(museums?|cathedrals?|castles?|palaces?|old town|temples?|galler(y|ies)|monuments?|unesco|world heritage)\b/gi,
    family: /\b(theme parks?|water ?parks?|amusement parks?|zoos?|aquariums?|playgrounds?|family[- ]friendly)\b/gi,
  },
  // German compounds: "Sandstrand", "Badestrände", "Skigebiet", "Wanderweg", "Freizeitpark"
  de: {
    beach: /(str[aä]nde?n?\b|strand\w*|schnorchel\w*|tauch(en|gr[uü]nde?|basis|spots?)\b|surf(en|er|spots?)?\b|lagunen?\b|korallenriff\w*|badebucht\w*)/gi,
    ski: /(\bski\b|skigebiet\w*|skiort\w*|skifahr\w*|skilift\w*|skipiste\w*|pisten?\b|snowboard\w*|langlauf\w*|apr[eè]s-ski)/gi,
    nature: /(wander\w*|nationalpark\w*|naturpark\w*|naturschutzgebiet\w*|wasserf[aä]ll\w*|schlucht\w*|trekking|safaris?\b|wildtier\w*)/gi,
    culture: /(museum|museen|kathedrale\w*|\bdom\b|\bburg(en)?\b|burgruine\w*|schl[oö]ss(er|ern)?\b|pal[aä]ste?\b|altstadt|tempel|galerie\w*|denkm(al|[aä]ler)\b|unesco|welterbe)/gi,
    family: /(freizeitpark\w*|vergn[uü]gungspark\w*|wasserpark\w*|spa[sß]bad\w*|erlebnisbad\w*|\bzoos?\b|tierpark\w*|aquarium|aquarien|spielpl[aä]tze?\b|kinderfreundlich\w*|familienfreundlich\w*)/gi,
  },
};

type PlaceKind = 'served' | 'island' | 'territory' | 'byName';

interface PlaceArticles {
  place: string;
  kind: PlaceKind;
  titles: Partial<Record<Language, string>>;
  /** Airports linked to this place (a shared island needs the city to tell them apart) */
  sharedBy: number;
}

interface ArticleStats extends Record<Signal, number> {
  sizeKb: number;
  /** The article's own coordinates ({{geo}}), if any */
  geo?: { lat: number; lon: number };
  disambiguation: boolean;
}

/** Localized display name of an airport's destination; s = shared by several airports */
export interface DestinationNameEntry {
  n: Partial<Record<Language, string>>;
  s?: 1;
}

export interface HolidayData {
  appeal: Record<string, HolidayAppealRow>;
  names: Record<string, DestinationNameEntry>;
}

/** A guide found only by the city's name must lie this close to the airport */
const MAX_BY_NAME_DISTANCE_KM = 100;
/** A region or island name replaces the city name only when its guide is this widely read ... */
const MIN_FAMOUS_NAME_VIEWS = 5_000;
/** ... and this many times more than the city's own guide */
const FAMOUS_NAME_VIEWS_FACTOR = 2;

function titleFromUrl(url: string): string {
  return decodeURIComponent(url.split('/wiki/')[1] || '').replace(/_/g, ' ');
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

async function mapAirportsToArticles(ctx: GeneratorContext, codes: string[]): Promise<Map<string, PlaceArticles[]>> {
  const byAirport = new Map<string, Map<string, PlaceArticles>>();
  for (let i = 0; i < codes.length; i += SPARQL_BATCH) {
    const batch = codes.slice(i, i + SPARQL_BATCH);
    const optionals = LANGUAGES.map(
      (l) => `OPTIONAL { ?${l} schema:about ?place ; schema:isPartOf <https://${l}.wikivoyage.org/> . }`
    ).join('\n  ');
    const rows = await wikidataQuery(
      ctx,
      `
SELECT ?iata ?place ?kind ${LANGUAGES.map((l) => `?${l}`).join(' ')} WHERE {
  VALUES ?iata { ${batch.map((c) => `"${c}"`).join(' ')} }
  ?airport wdt:P238 ?iata .
  { ?airport wdt:P931 ?place . BIND("served" AS ?kind) }
  UNION { ?airport wdt:P706 ?place . BIND("island" AS ?kind) }
  UNION { ?airport wdt:P131 ?place . BIND("territory" AS ?kind) }
  ${optionals}
  FILTER(BOUND(?en) || BOUND(?de))
}`
    );
    for (const r of rows) {
      const iata = r.iata.value as string;
      const places = byAirport.get(iata) ?? new Map<string, PlaceArticles>();
      const place = r.place.value as string;
      const kind = r.kind.value as PlaceKind;
      const key = `${kind}|${place}`;
      const entry = places.get(key) ?? { place, kind, titles: {}, sharedBy: 0 };
      for (const l of LANGUAGES) if (r[l]) entry.titles[l] = titleFromUrl(r[l].value);
      places.set(key, entry);
      byAirport.set(iata, places);
    }
    ctx.log(`Holiday appeal: mapped ${Math.min(i + SPARQL_BATCH, codes.length)} / ${codes.length} airports`);
    await ctx.sleep(500); // be polite to the public endpoint
  }

  // Islands and territories many airports share are too large to stand for one of them (the
  // British Columbia guide says nothing about the airstrip at Fort Nelson)
  const airportsPerPlace = new Map<string, number>();
  for (const places of byAirport.values()) {
    for (const p of places.values()) airportsPerPlace.set(`${p.kind}|${p.place}`, (airportsPerPlace.get(`${p.kind}|${p.place}`) ?? 0) + 1);
  }
  const sharedBy = (p: PlaceArticles) => airportsPerPlace.get(`${p.kind}|${p.place}`) ?? 0;
  for (const places of byAirport.values()) for (const p of places.values()) p.sharedBy = sharedBy(p);

  const result = new Map<string, PlaceArticles[]>();
  for (const [iata, places] of byAirport) {
    const all = [...places.values()];
    const primary = all.filter(
      (p) => p.kind === 'served' || (p.kind === 'island' && sharedBy(p) <= MAX_AIRPORTS_PER_ISLAND)
    );
    const chosen =
      primary.length > 0 ? primary : all.filter((p) => p.kind === 'territory' && sharedBy(p) <= MAX_AIRPORTS_PER_TERRITORY);
    if (chosen.length > 0) result.set(iata, chosen);
  }
  return result;
}

function parseGeo(text: string): { lat: number; lon: number } | undefined {
  const m = text.match(/\{\{\s*geo\s*\|\s*(-?[\d.]+)\s*\|\s*(-?[\d.]+)/i);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;
}

function normalizeName(name: string): string {
  return name
    .replace(/\s*\(.*\)\s*$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** "Victoria (Seychelles)" -> "Victoria" */
function displayTitle(title: string): string {
  return title.replace(/\s*\(.*\)\s*$/, '').trim();
}

async function fetchArticleStats(
  ctx: GeneratorContext,
  language: TextLanguage,
  titles: string[]
): Promise<Map<string, ArticleStats>> {
  const keywords = KEYWORDS[language];
  const stats = new Map<string, ArticleStats>();
  for (let i = 0; i < titles.length; i += ARTICLE_BATCH) {
    const batch = titles.slice(i, i + ARTICLE_BATCH);
    const url =
      `https://${language}.wikivoyage.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
      '&format=json&formatversion=2&redirects=1&titles=' +
      encodeURIComponent(batch.join('|'));
    type QueryResponse = {
      query?: {
        pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[];
        redirects?: { from: string; to: string }[];
        normalized?: { from: string; to: string }[];
      };
    };
    let json: QueryResponse = {};
    for (let attempt = 1; ; attempt++) {
      const res = await ctx
        .fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
        .catch(() => null);
      if (res?.ok) {
        json = await res.json();
        break;
      }
      if (attempt >= 4) throw new Error(`Wikivoyage (${language}) HTTP ${res?.status ?? 'timeout'}`);
      await ctx.sleep(3_000 * attempt);
    }
    // Requested title -> final title, through normalisation and redirects
    const resolve = new Map<string, string>();
    for (const n of json.query?.normalized ?? []) resolve.set(n.from, n.to);
    for (const r of json.query?.redirects ?? []) resolve.set(r.from, r.to);
    const byFinal = new Map<string, ArticleStats>();
    for (const page of json.query?.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!text) continue;
      byFinal.set(page.title, {
        sizeKb: Math.round(text.length / 1024),
        beach: countMatches(text, keywords.beach),
        ski: countMatches(text, keywords.ski),
        nature: countMatches(text, keywords.nature),
        culture: countMatches(text, keywords.culture),
        family: countMatches(text, keywords.family),
        geo: parseGeo(text),
        disambiguation: /\{\{\s*(disamb|disambiguation|begriffskl[aä]rung)\b/i.test(text),
      });
    }
    for (const title of batch) {
      let final = title;
      for (let hops = 0; resolve.has(final) && hops < 3; hops++) final = resolve.get(final)!;
      const s = byFinal.get(final);
      if (s) stats.set(title, s);
    }
    if ((i / ARTICLE_BATCH) % 10 === 0) {
      ctx.log(`Holiday appeal: read ${Math.min(i + ARTICLE_BATCH, titles.length)} / ${titles.length} ${language} guides`);
    }
    await ctx.sleep(300);
  }
  return stats;
}

/** Annual user page views of one guide: 0 when the API has none, null when the request failed */
async function fetchAnnualViews(
  ctx: GeneratorContext,
  language: Language,
  title: string,
  from: string,
  to: string
): Promise<number | null> {
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${language}.wikivoyage/all-access/user/` +
    `${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/${from}/${to}`;
  for (let attempt = 1; ; attempt++) {
    const res = await ctx
      .fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      .catch(() => null);
    if (res?.status === 404) return 0;
    if (res?.ok) {
      const json = (await res.json()) as { items?: { views: number }[] };
      return (json.items ?? []).reduce((sum, i) => sum + i.views, 0);
    }
    if (attempt >= 4) return null;
    // Throttled: wait as long as asked, else back off
    const retryAfter = Number(res?.headers.get('retry-after'));
    await ctx.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2_000 * attempt);
  }
}

async function mapConcurrent<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

/** The last 12 complete months, as the API's YYYYMMDD00 bounds */
function lastTwelveMonths(now: Date): { from: string; to: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // first of this month
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, '')}00`;
  return { from: fmt(start), to: fmt(new Date(end.getTime() - 24 * 60 * 60 * 1000)) };
}

async function fetchAllViews(
  ctx: GeneratorContext,
  jobs: string[],
  from: string,
  to: string
): Promise<Map<string, number>> {
  const views = new Map<string, number>();
  let failed: string[] = [];
  let done = 0;
  await mapConcurrent(jobs, PAGEVIEW_CONCURRENCY, async (job) => {
    const [language, title] = job.split('|') as [Language, string];
    const count = await fetchAnnualViews(ctx, language, title, from, to);
    if (count === null) failed.push(job);
    else views.set(job, count);
    if (++done % 500 === 0) ctx.log(`Holiday appeal: page views ${done} / ${jobs.length}`);
  });
  // A burst of failures (throttling, network) must not turn popular places into unknown ones:
  // retry them slowly, one at a time
  for (let pass = 1; pass <= 2 && failed.length > 0; pass++) {
    ctx.log(`Holiday appeal: retrying ${failed.length} failed page-view requests (pass ${pass})`);
    const retry = failed;
    failed = [];
    for (const job of retry) {
      const [language, title] = job.split('|') as [Language, string];
      const count = await fetchAnnualViews(ctx, language, title, from, to);
      if (count === null) failed.push(job);
      else views.set(job, count);
      await ctx.sleep(200);
    }
  }
  ctx.log(`Holiday appeal: page views for ${views.size} guides, ${failed.length} still missing`);
  return views;
}

export async function generateHolidayAppeal(
  ctx: GeneratorContext,
  airports: AirportRecord[],
  now: Date = new Date()
): Promise<Record<string, HolidayAppealRow>> {
  return (await generateHolidayData(ctx, airports, now)).appeal;
}

export async function generateHolidayData(
  ctx: GeneratorContext,
  airports: AirportRecord[],
  now: Date = new Date()
): Promise<HolidayData> {
  const codes = iataCodes(airports);
  const airportByCode = new Map(airports.map((a) => [a.code, a]));
  const placesByAirport = await mapAirportsToArticles(ctx, codes);
  ctx.log(`Holiday appeal: ${placesByAirport.size} airports with Wikivoyage guides`);

  // Fallback: the guide named like the airport's city (checked against its coordinates below)
  for (const code of codes) {
    const city = airportByCode.get(code)?.city?.trim();
    if (placesByAirport.has(code) || !city) continue;
    placesByAirport.set(code, [{ place: `name:${code}`, kind: 'byName', titles: { en: city, de: city }, sharedBy: 1 }]);
  }

  const allPlaces = [...placesByAirport.values()].flat();
  const articleStats = {} as Record<TextLanguage, Map<string, ArticleStats>>;
  for (const language of TEXT_LANGUAGES) {
    const titles = [...new Set(allPlaces.map((p) => p.titles[language]).filter((t): t is string => Boolean(t)))];
    articleStats[language] = await fetchArticleStats(ctx, language, titles);
    ctx.log(`Holiday appeal: ${articleStats[language].size} of ${titles.length} ${language} guides read`);
  }

  // A usable article for a place: no disambiguation page, and a by-name match must be nearby
  const usableStats = (place: PlaceArticles, language: TextLanguage, airport?: AirportRecord): ArticleStats | undefined => {
    const title = place.titles[language];
    const stats = title ? articleStats[language].get(title) : undefined;
    if (!stats || stats.disambiguation) return undefined;
    if (place.kind === 'byName') {
      if (!stats.geo || !airport) return undefined;
      if (calculateGeodesicDistanceKm(stats.geo.lat, stats.geo.lon, airport.lat, airport.lon) > MAX_BY_NAME_DISTANCE_KM) return undefined;
    }
    return stats;
  };
  // Places without any usable article are dropped (also from page views)
  for (const [code, places] of placesByAirport) {
    const airport = airportByCode.get(code);
    const usable = places.filter((p) => TEXT_LANGUAGES.some((l) => usableStats(p, l, airport)));
    if (usable.length > 0) placesByAirport.set(code, usable);
    else placesByAirport.delete(code);
  }

  const { from, to } = lastTwelveMonths(now);
  const viewJobs = [
    ...new Set(
      [...placesByAirport.values()].flat().flatMap((p) => LANGUAGES.filter((l) => p.titles[l]).map((l) => `${l}|${p.titles[l]}`))
    ),
  ];
  const views = await fetchAllViews(ctx, viewJobs, from, to);
  const placeViews = (place: PlaceArticles) =>
    LANGUAGES.reduce((sum, l) => sum + (place.titles[l] ? views.get(`${l}|${place.titles[l]}`) ?? 0 : 0), 0);

  const appeal: Record<string, HolidayAppealRow> = {};
  const names: Record<string, DestinationNameEntry> = {};
  for (const [iata, places] of placesByAirport) {
    const airport = airportByCode.get(iata);
    let mostViews = 0;
    const best: Partial<Record<HolidayEvidenceKind, { mentions: number; sizeKb: number; evidence: number }>> = {};
    for (const place of places) {
      mostViews = Math.max(mostViews, placeViews(place));
      for (const language of TEXT_LANGUAGES) {
        const stats = usableStats(place, language, airport);
        if (!stats) continue;
        for (const kind of HOLIDAY_EVIDENCE_KINDS) {
          const evidence = holidayEvidence(kind, stats[kind], stats.sizeKb);
          const current = best[kind];
          if (!current || evidence > current.evidence) best[kind] = { mentions: stats[kind], sizeKb: stats.sizeKb, evidence };
        }
      }
    }
    if (!best.beach) continue;
    const row: number[] = [mostViews];
    for (const kind of HOLIDAY_EVIDENCE_KINDS) row.push(best[kind]!.mentions, best[kind]!.sizeKb);
    appeal[iata] = row as HolidayAppealRow;

    const name = famousName(places, airport?.city ?? '', placeViews);
    if (name) names[iata] = name;
  }
  ctx.log(`Holiday appeal: ${Object.keys(appeal).length} airports scored, ${Object.keys(names).length} display names`);
  return { appeal, names };
}

/**
 * The famous island or region an airport serves, when its guide is much more read than the
 * city's own (Bali for Denpasar, Crete for Heraklion); null to keep the city name.
 */
function famousName(
  places: PlaceArticles[],
  city: string,
  placeViews: (place: PlaceArticles) => number
): DestinationNameEntry | null {
  const cityKey = normalizeName(city);
  if (!cityKey) return null;
  const titleKey = (p: PlaceArticles) => normalizeName(p.titles.en ?? p.titles.de ?? '');
  // The city's own guide, and places that are just longer names of it ("Bangkok Metropolitan Area")
  const isCity = (p: PlaceArticles) => {
    const key = titleKey(p);
    return !key || key.includes(cityKey) || cityKey.includes(key);
  };
  const cityViews = Math.max(0, ...places.filter(isCity).map(placeViews));
  const candidates = places.filter((p) => (p.kind === 'served' || p.kind === 'island') && !isCity(p));
  let best: PlaceArticles | null = null;
  for (const p of candidates) if (!best || placeViews(p) > placeViews(best)) best = p;
  if (!best) return null;
  const views = placeViews(best);
  if (views < MIN_FAMOUS_NAME_VIEWS || views < FAMOUS_NAME_VIEWS_FACTOR * cityViews) return null;
  const n: Partial<Record<Language, string>> = {};
  for (const l of LANGUAGES) {
    const title = best.titles[l] ?? best.titles.en ?? best.titles.de;
    if (title) n[l] = displayTitle(title);
  }
  return best.sharedBy > 1 ? { n, s: 1 } : { n };
}
