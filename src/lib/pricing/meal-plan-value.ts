import type { BoardType } from '../optimizer/types';

// Plain values without the pricing engine, so the catering advantage popover can explain them

/**
 * What the meals included in a board type are worth per person and night, in euros: the food a
 * family would otherwise buy at the destination (shown as the catering advantage).
 */
export const MEAL_PLAN_DAILY_VALUE: Record<BoardType, { adult: number; child: number }> = {
  ALL_INCLUSIVE: { adult: 55, child: 30 },
  HALF_BOARD: { adult: 32, child: 18 },
  BREAKFAST: { adult: 14, child: 8 },
  ROOM_ONLY: { adult: 0, child: 0 },
};

/**
 * Share of the meal value credited against the trip price for ranking and price comparison:
 * part of what the meals are worth would be spent on food at home anyway.
 */
export const MEAL_VALUE_CREDIT_SHARE = 0.75;

/**
 * Price level (World Bank, USA = 1) the values above stand for: Mediterranean holiday countries
 * (Spain, Greece, Italy, Portugal are at about 0.65-0.75).
 */
export const MEAL_PRICE_REFERENCE_LEVEL = 0.7;

/**
 * Holiday meals follow the local price level only in part: hotels and tourist restaurants charge
 * closer to international prices than the local average, so a day of meals in an Egyptian resort
 * costs more than the 23 % of a Spanish one the plain price levels would suggest.
 */
const LOCAL_PRICE_EXPONENT = 0.6;
const MIN_PRICE_FACTOR = 0.35;
const MAX_PRICE_FACTOR = 1.8;

/** How much meals cost at the destination relative to the reference (1 = Mediterranean). */
export function mealPriceFactor(priceLevel: number | undefined): number {
  if (!priceLevel || priceLevel <= 0) return 1;
  const factor = Math.pow(priceLevel / MEAL_PRICE_REFERENCE_LEVEL, LOCAL_PRICE_EXPONENT);
  return Math.round(Math.min(MAX_PRICE_FACTOR, Math.max(MIN_PRICE_FACTOR, factor)) * 100) / 100;
}

export interface MealPlanRates {
  /** Euros per adult and night at the destination */
  adult: number;
  /** Euros per child and night at the destination */
  child: number;
  /** Destination meal prices relative to the Mediterranean reference */
  priceFactor: number;
}

/** What the meals of a board type are worth at a destination with the given price level. */
export function localMealPlanRates(boardType: BoardType, priceLevel: number | undefined): MealPlanRates {
  const base = MEAL_PLAN_DAILY_VALUE[boardType] ?? MEAL_PLAN_DAILY_VALUE.ROOM_ONLY;
  const priceFactor = mealPriceFactor(priceLevel);
  return { adult: Math.round(base.adult * priceFactor), child: Math.round(base.child * priceFactor), priceFactor };
}
