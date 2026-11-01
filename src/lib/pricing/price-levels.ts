import priceLevels from './data/price-levels.json';
import { getDataset } from '@/lib/datasets/store';
import { resolveIsoCountryCode } from '@/lib/safety/advisory-store';

/**
 * Country price levels from the price-levels dataset (World Bank, USA = 1), see
 * src/lib/datasets/generators/price-levels.ts.
 */
export function getCountryPriceLevel(countryCode: string | undefined): number | undefined {
  if (!countryCode) return undefined;
  return getDataset('price-levels', priceLevels as Record<string, number>)[countryCode.toUpperCase()];
}

/** ISO country of a destination: from its subdivision code (TH-10), else from the country name. */
export function destinationCountryCode(point: { state?: string; country?: string } | null | undefined): string | undefined {
  const fromState = point?.state?.split('-')[0];
  if (fromState && /^[A-Z]{2}$/.test(fromState)) return fromState;
  const resolved = point?.country ? resolveIsoCountryCode(point.country) : '';
  return /^[A-Z]{2}$/.test(resolved) ? resolved : undefined;
}
