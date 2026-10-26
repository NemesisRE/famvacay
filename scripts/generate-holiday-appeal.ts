/**
 * Holiday Appeal Generator (manual run) - see src/lib/datasets/generators/holiday-appeal.ts.
 * Writes src/lib/optimizer/data/holiday-appeal.json and src/lib/geo/data/destination-names.json.
 * Usage: npm run generate:holiday-appeal
 */
import fs from 'node:fs';
import path from 'node:path';
import airports from '../src/lib/airports/data/airports.json';
import traffic from '../src/lib/airports/data/airport-traffic.json';
import routes from '../src/lib/airports/data/flight-routes.json';
import { generateHolidayData } from '../src/lib/datasets/generators/holiday-appeal';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const appealFile = path.join(__dirname, '../src/lib/optimizer/data/holiday-appeal.json');
const namesFile = path.join(__dirname, '../src/lib/geo/data/destination-names.json');

generateHolidayData(defaultGeneratorContext(console.log), airports as any, {
  traffic: traffic as Record<string, number>,
  routes: routes as Record<string, string>,
})
  .then(({ appeal, names }) => {
    fs.writeFileSync(appealFile, JSON.stringify(appeal));
    fs.writeFileSync(namesFile, JSON.stringify(names));
    console.log(`Wrote ${Object.keys(appeal).length} airports to ${path.relative(process.cwd(), appealFile)}`);
    console.log(`Wrote ${Object.keys(names).length} display names to ${path.relative(process.cwd(), namesFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
