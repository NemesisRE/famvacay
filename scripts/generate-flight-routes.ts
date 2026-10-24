/**
 * Flight Route Graph Generator (manual run) - see src/lib/datasets/generators/flight-routes.ts.
 * Writes src/lib/airports/data/flight-routes.json. Usage: npm run generate:flight-routes
 */
import fs from 'node:fs';
import path from 'node:path';
import airports from '../src/lib/airports/data/airports.json';
import { generateFlightRoutes } from '../src/lib/datasets/generators/flight-routes';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/airports/data/flight-routes.json');

generateFlightRoutes(defaultGeneratorContext(console.log), airports as any)
  .then((routes) => {
    fs.writeFileSync(outFile, JSON.stringify(routes));
    console.log(`Wrote ${Object.keys(routes).length} airports to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
