/**
 * Airports Generator (manual run) - see src/lib/datasets/generators/airports.ts.
 * Writes src/lib/airports/data/airports.json. Usage: npm run generate:airports-db
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateAirports } from '../src/lib/datasets/generators/airports';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/airports/data/airports.json');

generateAirports(defaultGeneratorContext(console.log))
  .then((airports) => {
    fs.writeFileSync(outFile, JSON.stringify(airports, null, 2), 'utf8');
    console.log(`Wrote ${airports.length} commercial airports to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
