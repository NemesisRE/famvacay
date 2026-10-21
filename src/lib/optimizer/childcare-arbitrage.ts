import { ChildcareArbitrageWarning } from './types';

export interface ChildcareArbitrageCandidate {
  destinationAirport: string;
  durationDays: number;
  overlapsChildcareClosure?: boolean;
  hasYoungChildAtDeparture?: boolean;
  rawPtoDaysConsumed?: number;
  ptoDaysConsumed: number;
  effectiveCost?: number;
  estimatedTotalCost: number;
  startDate: string;
  endDate: string;
  childcareArbitrageWarning?: ChildcareArbitrageWarning;
}

/**
 * Childcare Closure vs. Peak Season Arbitrage (mutates candidates in place).
 *
 * For windows overlapping a CHILDCARE_CLOSURE where the family has a daycare-age child
 * (< 6y at departure), compares against the cheapest off-peak alternative for the same
 * destination & duration:
 *   DeltaCost = Cost_closure_window - Cost_best_offpeak_window
 *   CostPerSavedPtoDay = DeltaCost / max(1, SavedPtoDays)
 * Attaches `childcareArbitrageWarning` when CostPerSavedPtoDay exceeds `thresholdEur` (default 150).
 */
export function applyChildcareArbitrageWarnings<T extends ChildcareArbitrageCandidate>(
  candidates: T[],
  thresholdEur: number = 150
): void {
  const groupKey = (c: T) => `${c.destinationAirport}__${c.durationDays}`;
  const groups = new Map<string, T[]>();
  for (const c of candidates) {
    const key = groupKey(c);
    const list = groups.get(key) || [];
    list.push(c);
    groups.set(key, list);
  }

  for (const cand of candidates) {
    if (!cand.overlapsChildcareClosure || !cand.hasYoungChildAtDeparture) continue;

    const savedPtoDays = Math.max(0, (cand.rawPtoDaysConsumed ?? cand.ptoDaysConsumed) - cand.ptoDaysConsumed);
    if (savedPtoDays <= 0) continue;

    const offPeakSiblings = (groups.get(groupKey(cand)) || []).filter((s) => !s.overlapsChildcareClosure);
    if (offPeakSiblings.length === 0) continue;

    const bestOffPeak = offPeakSiblings.reduce((best, cur) =>
      (cur.effectiveCost ?? cur.estimatedTotalCost) < (best.effectiveCost ?? best.estimatedTotalCost) ? cur : best
    );

    const closureCost = cand.effectiveCost ?? cand.estimatedTotalCost;
    const offPeakCost = bestOffPeak.effectiveCost ?? bestOffPeak.estimatedTotalCost;
    const extraCostEur = Math.round(closureCost - offPeakCost);
    if (extraCostEur <= 0) continue;

    const costPerSavedPtoDay = Math.round(extraCostEur / Math.max(1, savedPtoDays));

    if (costPerSavedPtoDay > thresholdEur) {
      cand.childcareArbitrageWarning = {
        savedPtoDays,
        extraCostEur,
        costPerSavedPtoDay,
        bestOffPeakDateRange: { startDate: bestOffPeak.startDate, endDate: bestOffPeak.endDate },
        bestOffPeakPrice: Math.round(offPeakCost),
      };
    }
  }
}
