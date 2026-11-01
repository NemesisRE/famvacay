// Plain values without the pricing engine, like meal-plan-value.ts

export type HotelSeason = 'PEAK' | 'SHOULDER' | 'OFF';

/**
 * Nightly rate in euros for a standard family room at a destination with the reference price
 * level (see HOTEL_PRICE_REFERENCE_LEVEL), per season.
 */
export const BASE_NIGHTLY_RATE: Record<HotelSeason, number> = { PEAK: 165, SHOULDER: 122, OFF: 100 };

/**
 * Price level (World Bank, USA = 1) the base rates were calibrated on: Mediterranean coastal
 * resorts (Spain, Greece, Italy, Portugal are at about 0.65-0.75). Internal only.
 */
export const HOTEL_PRICE_REFERENCE_LEVEL = 0.7;

/**
 * Hotels follow the national price level only in part: resorts charge closer to international
 * prices than the local average (a bit more than meals do, see LOCAL_PRICE_EXPONENT there).
 */
const HOTEL_PRICE_EXPONENT = 0.55;
const MIN_HOTEL_FACTOR = 0.6;
const MAX_HOTEL_FACTOR = 1.9;

/** How much rooms cost at the destination relative to the reference (1 = reference level). */
export function hotelPriceFactor(priceLevel: number | undefined): number {
  // No data for the country: stay neutral instead of guessing a tier
  if (!priceLevel || priceLevel <= 0) return 1;
  const factor = Math.pow(priceLevel / HOTEL_PRICE_REFERENCE_LEVEL, HOTEL_PRICE_EXPONENT);
  return Math.min(MAX_HOTEL_FACTOR, Math.max(MIN_HOTEL_FACTOR, factor));
}

const RESORT_PREMIUM_EXPONENT = 0.3;
const MAX_RESORT_PREMIUM = 1.4;

/**
 * Extra for destinations where holidays cost more than the national price level suggests (island
 * resorts, luxury destinations): tourist spend per arrival relative to the typical country.
 * Never below 1, because the price level already covers cheap countries.
 */
export function resortPremium(spendPerArrival: number | undefined, typicalSpend: number | undefined): number {
  if (!spendPerArrival || !typicalSpend || spendPerArrival <= typicalSpend) return 1;
  const premium = Math.pow(spendPerArrival / typicalSpend, RESORT_PREMIUM_EXPONENT);
  return Math.round(Math.min(MAX_RESORT_PREMIUM, premium) * 100) / 100;
}

/** Nightly rate in euros for a destination country price level, season and resort premium. */
export function hotelNightlyRate(priceLevel: number | undefined, season: HotelSeason, premium = 1): number {
  return Math.round(BASE_NIGHTLY_RATE[season] * hotelPriceFactor(priceLevel) * premium);
}
