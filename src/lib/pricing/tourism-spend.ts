import tourismSpend from './data/tourism-spend.json';
import { getDataset } from '@/lib/datasets/store';
import { resortPremium, resortPremiumFor } from './hotel-rates';

/** Median tourist spend per arrival over all countries: what a typical destination earns. */
function typicalSpend(data: Record<string, number>): number | undefined {
  const values = Object.values(data).sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : undefined;
}

/** Hotel resort premium for a country (1 = none, or no tourism data). */
export function getResortPremium(countryCode: string | undefined): number {
  if (!countryCode) return 1;
  const data = getDataset('tourism-spend', tourismSpend as Record<string, number>);
  const code = countryCode.toUpperCase();
  return resortPremiumFor(code, resortPremium(data[code], typicalSpend(data)));
}
