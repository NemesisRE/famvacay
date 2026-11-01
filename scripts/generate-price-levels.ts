/**
 * Price Level Generator (manual run) - see src/lib/datasets/generators/price-levels.ts.
 * Writes src/lib/pricing/data/price-levels.json. Usage: npm run generate:price-levels
 */
import fs from 'node:fs';
import path from 'node:path';
import { generatePriceLevels } from '../src/lib/datasets/generators/price-levels';
import { defaultGeneratorContext } from '../src/lib/datasets/generators/common';

const outFile = path.join(__dirname, '../src/lib/pricing/data/price-levels.json');

generatePriceLevels(defaultGeneratorContext(console.log))
  .then((levels) => {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(levels));
    console.log(`Wrote ${Object.keys(levels).length} countries to ${path.relative(process.cwd(), outFile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
