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
