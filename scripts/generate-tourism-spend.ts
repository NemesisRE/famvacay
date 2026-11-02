/**
 * Tourism Spend Generator (manual run) - see src/lib/datasets/generators/tourism-spend.ts.
 * Writes src/lib/pricing/data/tourism-spend.json. Usage: npm run generate:tourism-spend
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateTourismSpend } from '../src/lib/datasets/generators/tourism-spend';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/pricing/data/tourism-spend.json');

generateTourismSpend(defaultGeneratorContext(console.log))
  .then((spend) => {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(spend));
    console.log(`Wrote ${Object.keys(spend).length} countries to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
