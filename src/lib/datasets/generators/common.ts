/**
 * Shared plumbing for the reference-data generators, which run both as manual scripts
 * (scripts/generate-*.ts) and inside the app's background refresh (refresh-service.ts).
 */

export interface GeneratorContext {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

export function defaultGeneratorContext(log: (message: string) => void = () => {}): GeneratorContext {
  return { fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log };
}

/** Raw airport record as stored in the airports dataset. */
export interface AirportRecord {
  code: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
  altitude: number;
  type: string;
  isMajorHub: boolean;
  isHighSpeedRailConnected: boolean;
  keywords?: string;
}

export const USER_AGENT = 'famvacay-data-generator/1.0 (https://famvacay.us)';

export async function fetchText(ctx: GeneratorContext, url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await ctx.fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 4) throw err;
      await ctx.sleep(2_000 * attempt);
    }
  }
}

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export async function wikidataQuery(ctx: GeneratorContext, sparql: string): Promise<any[]> {
  for (let attempt = 1; ; attempt++) {
    // Wikidata stops queries after 60 s; a connection still open after 2 minutes has stalled
    const res = await ctx
      .fetch(WIKIDATA_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ query: sparql }).toString(),
        signal: AbortSignal.timeout(120_000),
      })
      .catch(() => null);
    if (!res || res.status === 429 || res.status >= 500) {
      if (attempt > 4) throw new Error(`Wikidata HTTP ${res?.status ?? 'timeout'}`);
      await ctx.sleep(3_000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    return (await res.json()).results.bindings;
  }
}

/** RFC 4180-ish CSV line parser (quoted fields, doubled quotes). */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function iataCodes(airports: AirportRecord[]): string[] {
  return [...new Set(airports.map((a) => a.code).filter((c) => /^[A-Z]{3}$/.test(c)))].sort();
}
