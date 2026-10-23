import { differenceInYears } from 'date-fns';

/**
 * Shared trip boards (`/api/vacations/share`) are read by anyone holding the short link, with no
 * authentication. These helpers strip the raw search payload down to an allowlist of derived,
 * non-identifying fields before anything is written to Postgres or the Redis read-through cache,
 * so exact home address, home GPS coordinates, children's exact birthdates, and free-text
 * blackout reasons never leave the owner's own browser (Art. 5 & 8 GDPR data minimisation).
 */

interface RawBlackoutRange {
  startDate?: string;
  endDate?: string;
  reason?: string;
  type?: string;
  coverageFactor?: number;
}

interface SanitizedBlackoutRange {
  startDate: string;
  endDate: string;
}

function sanitizeBlackoutRanges(ranges: unknown): SanitizedBlackoutRange[] | undefined {
  if (!Array.isArray(ranges)) return undefined;
  return (ranges as RawBlackoutRange[])
    .filter((b) => b && b.startDate && b.endDate)
    .map((b) => ({ startDate: b.startDate as string, endDate: b.endDate as string }));
}

function computeChildAgesAtDeparture(childrenList: unknown, referenceDate?: string | null): number[] | undefined {
  if (!Array.isArray(childrenList)) return undefined;
  const tripDate = referenceDate ? new Date(referenceDate) : new Date();
  return (childrenList as Array<{ birthDate?: string }>)
    .map((c) => {
      const b = new Date(c?.birthDate || '');
      return isNaN(b.getTime()) ? null : Math.max(0, differenceInYears(tripDate, b));
    })
    .filter((age): age is number => age !== null)
    .sort((a, b) => a - b);
}

/** Strips `userProfile` down to derived fields only: no address, GPS, birthdates, or school region. */
function buildShareableUserProfile(userProfile: unknown, referenceDate?: string | null): Record<string, unknown> | null {
  if (!userProfile || typeof userProfile !== 'object') return null;
  const p = userProfile as Record<string, unknown>;
  const childAgesAtDeparture = Array.isArray(p.childrenAges) && (p.childrenAges as unknown[]).length > 0
    ? (p.childrenAges as number[])
    : computeChildAgesAtDeparture(p.childrenBirthDates, referenceDate);

  return {
    federalState: p.federalState ?? null,
    originAirports: Array.isArray(p.originAirports) ? p.originAirports : [],
    adults: p.adults ?? null,
    childAgesAtDeparture: childAgesAtDeparture ?? [],
    preferredCabinClass: p.preferredCabinClass ?? null,
    travelModes: Array.isArray(p.travelModes) ? p.travelModes : [],
    maxFlightStops: p.maxFlightStops ?? null,
    blackoutRanges: sanitizeBlackoutRanges(p.blackoutRanges),
  };
}

/** Strips the optimizer search `query` down to non-identifying search parameters + a sanitized `userProfile`. */
export function buildShareableQuery(query: unknown): Record<string, unknown> | null {
  if (!query || typeof query !== 'object') return null;
  const q = query as Record<string, unknown>;
  const { userProfile, searchBlackouts, ...rest } = q;
  return {
    ...rest,
    searchBlackouts: sanitizeBlackoutRanges(searchBlackouts),
    userProfile: buildShareableUserProfile(userProfile, (q.earliestDate as string) ?? null),
  };
}

/** Strips the search-form snapshot `formState` down to non-identifying fields + derived child ages. */
export function buildShareableFormState(formState: unknown): Record<string, unknown> | null {
  if (!formState || typeof formState !== 'object') return null;
  const f = formState as Record<string, unknown>;
  const { departureLocation, departureCoords, childrenList, ...rest } = f;
  return {
    ...rest,
    childAgesAtDeparture: computeChildAgesAtDeparture(childrenList, (f.earliestDate as string) ?? null) ?? [],
  };
}

/**
 * Defensive pass over each candidate result window: these come from the optimizer
 * (destination/dates/price/weather) and shouldn't carry family PII, but strip any accidental
 * echo of the home-location/profile fields before it's persisted and served to viewers.
 */
export function buildShareableCandidateSnapshot(win: unknown): unknown {
  if (!win || typeof win !== 'object') return win;
  const { homeLocation, departureLat, departureLon, userProfile, ...rest } = win as Record<string, unknown>;
  return rest;
}
