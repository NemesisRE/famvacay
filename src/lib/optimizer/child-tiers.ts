import { differenceInYears, parseISO } from 'date-fns';

export type AgeCategory = 'INFANT' | 'CHILD' | 'ADULT';

export interface ChildPassenger {
  age: number;
  tier: 'infant' | 'child' | 'teen';
}

/**
 * Derives the exact passenger age category for a specific travel date.
 * - INFANT: Under 2 years on the travel date.
 * - CHILD: 2 to 11 years (inclusive).
 * - ADULT: 12 years and older (standard airline fare rules).
 */
export function deriveAgeCategory(
  birthDate: string | Date,
  travelDate: string | Date
): AgeCategory {
  const bDate = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const tDate = typeof travelDate === 'string' ? parseISO(travelDate) : travelDate;

  const age = differenceInYears(tDate, bDate);
  if (age < 2) return 'INFANT';
  if (age <= 11) return 'CHILD';
  return 'ADULT';
}

/**
 * Derives segment-aware passenger age categories.
 * Crucial rule: If a child is an INFANT (<2) on outbound departure,
 * but turns 2 before or on the return segment date, the return segment MUST use CHILD.
 */
export function deriveSegmentAgeCategories(
  birthDate: string | Date,
  outboundDate: string | Date,
  returnDate: string | Date
): {
  outboundTier: AgeCategory;
  returnTier: AgeCategory;
  turnedTwoDuringTrip: boolean;
} {
  const outboundTier = deriveAgeCategory(birthDate, outboundDate);
  const returnTier = deriveAgeCategory(birthDate, returnDate);

  const turnedTwoDuringTrip = outboundTier === 'INFANT' && returnTier === 'CHILD';

  return {
    outboundTier,
    returnTier,
    turnedTwoDuringTrip,
  };
}

/**
 * Legacy backwards-compatible tier mapper for numeric age.
 */
export function getChildAgeTier(age: number): 'infant' | 'child' | 'teen' {
  if (age < 2) return 'infant';
  if (age <= 11) return 'child';
  return 'teen';
}

export function parseChildrenAges(ages: number[]): ChildPassenger[] {
  return ages.map((age) => ({
    age,
    tier: getChildAgeTier(age),
  }));
}

/**
 * Calculate age-adjusted passenger multiplier.
 * Infants usually fly with lap fee (~10%), children get child fare (~75%), teens/adults pay 100%.
 * Supports segment-aware child birthdays during travel.
 */
export function calculatePassengerCostMultiplier(
  adultsCount: number,
  childrenAges: number[],
  segmentOptions?: {
    birthDates?: (string | Date)[];
    outboundDate?: string;
    returnDate?: string;
  }
): number {
  let multiplier = adultsCount * 1.0;

  if (
    segmentOptions?.birthDates &&
    segmentOptions.outboundDate &&
    segmentOptions.returnDate
  ) {
    for (const bDate of segmentOptions.birthDates) {
      const { outboundTier, returnTier } = deriveSegmentAgeCategories(
        bDate,
        segmentOptions.outboundDate,
        segmentOptions.returnDate
      );

      // Average outbound and return fare multipliers for the round trip
      const outboundCost = outboundTier === 'INFANT' ? 0.10 : outboundTier === 'CHILD' ? 0.75 : 1.0;
      const returnCost = returnTier === 'INFANT' ? 0.10 : returnTier === 'CHILD' ? 0.75 : 1.0;
      multiplier += (outboundCost + returnCost) / 2;
    }
  } else {
    for (const age of childrenAges) {
      const tier = getChildAgeTier(age);
      if (tier === 'infant') {
        multiplier += 0.10;
      } else if (tier === 'child') {
        multiplier += 0.75;
      } else {
        multiplier += 1.0;
      }
    }
  }

  return multiplier;
}
