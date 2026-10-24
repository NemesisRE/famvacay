/**
 * Localized City Name Generator (manual run) - see src/lib/datasets/generators/city-names.ts.
 * Writes src/lib/airports/data/city-names.json. Usage: npm run generate:city-names
 */
import fs from 'node:fs';
import path from 'node:path';
import airports from '../src/lib/airports/data/airports.json';
import { generateCityNames } from '../src/lib/datasets/generators/city-names';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/airports/data/city-names.json');

generateCityNames(defaultGeneratorContext(console.log), airports as any)
  .then((names) => {
    fs.writeFileSync(outFile, JSON.stringify(names));
    console.log(`Wrote ${Object.keys(names).length} localized entries to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
