/**
 * Airport Traffic Generator (manual run) - see src/lib/datasets/generators/airport-traffic.ts.
 * Writes src/lib/airports/data/airport-traffic.json. Usage: npm run generate:airport-traffic
 */
import fs from 'node:fs';
import path from 'node:path';
import airports from '../src/lib/airports/data/airports.json';
import { generateAirportTraffic } from '../src/lib/datasets/generators/airport-traffic';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/airports/data/airport-traffic.json');

generateAirportTraffic(defaultGeneratorContext(console.log), airports as any)
  .then((traffic) => {
    fs.writeFileSync(outFile, JSON.stringify(traffic));
    console.log(`Wrote ${Object.keys(traffic).length} airports to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
