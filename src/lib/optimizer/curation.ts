import { CandidateWindow } from './types';

/**
 * Curates a distinct set of alternative vacation options for presentation.
 * Filters out trivial +1/-1 day shifts and provides balanced diversity across:
 * 1. Lowest Price Deal (midweek / alternative duration savings)
 * 2. Highest PTO efficiency
 * 3. Best full school break window
 * 4. Alternative Origin Airport options (e.g. FKB vs STR vs FRA)
 * 5. Distinct travel periods across the search months
 */
export function curateDistinctAlternativeWindows(
  windows: CandidateWindow[],
  featured: CandidateWindow,
  maxAlternatives: number = 8
): CandidateWindow[] {
  // Exclude the featured window itself
  const candidates = windows.filter(
    (w) =>
      !(
        w.startDate === featured.startDate &&
        w.endDate === featured.endDate &&
        w.originAirport === featured.originAirport &&
        w.durationDays === featured.durationDays
      )
  );

  if (candidates.length === 0) return [];

  const curated: CandidateWindow[] = [];
  const selectedKeys = new Set<string>();

  const isTooClose = (w1: CandidateWindow, w2: CandidateWindow) => {
    // If same origin and start dates are within 2 days, treat as redundant +1 day shift
    if (w1.originAirport === w2.originAirport) {
      const d1 = new Date(w1.startDate).getTime();
      const d2 = new Date(w2.startDate).getTime();
      const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
      return diffDays <= 2;
    }
    // If different origin airport and start dates are identical, keep only if price differs noticeably
    if (w1.startDate === w2.startDate && w1.endDate === w2.endDate) {
      return Math.abs(w1.estimatedTotalCost - w2.estimatedTotalCost) < 40;
    }
    return false;
  };

  const addIfDistinct = (cand: CandidateWindow | undefined) => {
    if (!cand) return;
    const key = `${cand.startDate}_${cand.endDate}_${cand.originAirport}_${cand.durationDays}`;
    if (selectedKeys.has(key)) return;

    if (isTooClose(cand, featured)) return;
    for (const chosen of curated) {
      if (isTooClose(cand, chosen)) return;
    }

    selectedKeys.add(key);
    curated.push(cand);
  };

  // 1. Lowest Price Deal (midweek saving)
  const sortedByPrice = [...candidates].sort((a, b) => a.estimatedTotalCost - b.estimatedTotalCost);
  addIfDistinct(sortedByPrice[0]);

  // 2. Highest PTO efficiency
  const sortedByPto = [...candidates].sort((a, b) => b.ptoEfficiencyRatio - a.ptoEfficiencyRatio);
  addIfDistinct(sortedByPto[0]);

  // 3. Best Holiday Window (if applicable)
  const holidayMatches = candidates.filter((w) => !w.requiresSchoolExemption);
  if (holidayMatches.length > 0) {
    const sortedHolidays = [...holidayMatches].sort((a, b) => b.finalScore - a.finalScore);
    addIfDistinct(sortedHolidays[0]);
  }

  // 4. Best alternative origin airport options
  const altOrigins = Array.from(
    new Set(candidates.map((w) => w.originAirport).filter((o) => o !== featured.originAirport))
  );
  for (const altOrigin of altOrigins) {
    const fromOrigin = candidates
      .filter((w) => w.originAirport === altOrigin)
      .sort((a, b) => b.finalScore - a.finalScore);
    addIfDistinct(fromOrigin[0]);
  }

  // 5. Distinct dates across the months sorted by final score
  const sortedByScore = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
  for (const cand of sortedByScore) {
    if (curated.length >= maxAlternatives) break;
    addIfDistinct(cand);
  }

  return curated.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

