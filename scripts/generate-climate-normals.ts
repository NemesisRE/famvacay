/**
 * Climate Normals Generator (manual run) - see src/lib/datasets/generators/climate-normals.ts.
 *
 * Writes src/lib/optimizer/data/climate-normals.json. Progress is cached in the OS temp directory,
 * so an interrupted run - or one that stopped at the Open-Meteo free-tier daily budget - simply
 * continues where it left off when started again.
 *
 * Usage:
 *   npm run generate:climate-normals
 *   npm run generate:climate-normals -- --max-minutes=15        (cap the rain-duration phase, e.g. in CI)
 *   npm run generate:climate-normals -- --only=BKK,DPS,MRU --out=/tmp/climate-sample.json
 *
 * Rain-duration columns already present in the published dataset are kept rather than re-fetched,
 * so each run (local or CI) extends coverage instead of starting over.
 *
 * Open-Meteo access follows LEGAL_OPERATION_MODE / OPEN_METEO_API_KEY (see open-meteo-access.ts).
 */
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateClimateNormals, type ClimateGeneratorState } from '../src/lib/datasets/generators/climate-normals';
import airports from '../src/lib/airports/data/airports.json';
import flightRoutes from '../src/lib/airports/data/flight-routes.json';
import { resolveOpenMeteoAccess } from '../src/lib/integrations/open-meteo-access';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const onlyCodes = arg('only')?.split(',').filter(Boolean);
const maxMinutes = arg('max-minutes');
const publishedFile = path.join(__dirname, '../src/lib/optimizer/data/climate-normals.json');
const outFile = arg('out') || publishedFile;
const cacheFile = path.join(os.tmpdir(), 'famvacay-climate-normals-cache.json');

function loadPublished(): Record<string, number[]> | undefined {
  try {
    return JSON.parse(fs.readFileSync(publishedFile, 'utf8'));
  } catch {
    return undefined;
  }
}

function loadState(): ClimateGeneratorState {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    // Older caches were a flat { cell: nasaData } map
    return raw.nasa ? raw : { nasa: raw, rain: {} };
  } catch {
    return { nasa: {}, rain: {} };
  }
}

async function main() {
  const result = await generateClimateNormals({
    airports,
    flightRoutes,
    state: loadState(),
    saveState: async (state) => fs.writeFileSync(cacheFile, JSON.stringify(state)),
    openMeteo: resolveOpenMeteoAccess(),
    previousData: loadPublished(),
    maxRainRuntimeMs: maxMinutes ? Number(maxMinutes) * 60_000 : undefined,
    onlyCodes,
    log: (m) => console.log(m),
  });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result.data));
  console.log(
    `${result.destinations} destinations (${result.withRainDuration} with rain duration) -> ${path.relative(process.cwd(), outFile)}` +
      (result.complete ? '' : ' - rain duration incomplete, run again later to continue')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
