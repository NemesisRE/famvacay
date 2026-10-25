/**
 * Holiday Appeal Generator (manual run) - see src/lib/datasets/generators/holiday-appeal.ts.
 * Writes src/lib/optimizer/data/holiday-appeal.json. Usage: npm run generate:holiday-appeal
 */
import fs from 'node:fs';
import path from 'node:path';
import airports from '../src/lib/airports/data/airports.json';
import { generateHolidayAppeal } from '../src/lib/datasets/generators/holiday-appeal';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/optimizer/data/holiday-appeal.json');

generateHolidayAppeal(defaultGeneratorContext(console.log), airports as any)
  .then((data) => {
    fs.writeFileSync(outFile, JSON.stringify(data));
    console.log(`Wrote ${Object.keys(data).length} airports to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
