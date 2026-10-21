import { describe, it, expect } from 'vitest';
import { calculateEffectivePtoDaysConsumed } from '../pto-calculator';
import { applyChildcareArbitrageWarnings, ChildcareArbitrageCandidate } from '../childcare-arbitrage';

describe('Childcare Closure Opportunity Cost', () => {
  describe('calculateEffectivePtoDaysConsumed', () => {
    it('matches the base PTO calculation when no closures overlap', () => {
      const result = calculateEffectivePtoDaysConsumed('2026-08-03', '2026-08-09', [], [1, 2, 3, 4, 5], []);
      expect(result.totalWeekdays).toBe(5);
      expect(result.effectivePtoDaysConsumed).toBe(5);
      expect(result.overlappingClosureWeekdays).toBe(0);
    });

    it('reduces effective PTO to zero for a fully-covered closure (coverageFactor 1.0)', () => {
      const result = calculateEffectivePtoDaysConsumed(
        '2026-08-03',
        '2026-08-09',
        [],
        [1, 2, 3, 4, 5],
        [{ startDate: '2026-08-01', endDate: '2026-08-14', coverageFactor: 1.0 }]
      );
      expect(result.ptoDaysConsumed).toBe(5);
      expect(result.overlappingClosureWeekdays).toBe(5);
      expect(result.effectivePtoDaysConsumed).toBe(0);
    });

    it('applies a partial coverageFactor (grandparents cover half)', () => {
      const result = calculateEffectivePtoDaysConsumed(
        '2026-08-03',
        '2026-08-09',
        [],
        [1, 2, 3, 4, 5],
        [{ startDate: '2026-08-01', endDate: '2026-08-14', coverageFactor: 0.5 }]
      );
      expect(result.effectivePtoDaysConsumed).toBe(2.5);
    });

    it('never goes negative when the closure spans more weekdays than consumed', () => {
      const result = calculateEffectivePtoDaysConsumed(
        '2026-08-03',
        '2026-08-04',
        [],
        [1, 2, 3, 4, 5],
        [{ startDate: '2026-01-01', endDate: '2026-12-31', coverageFactor: 1.0 }]
      );
      expect(result.effectivePtoDaysConsumed).toBe(0);
    });

    it('excludes public holidays from both the base and closure-weighted calculation', () => {
      const result = calculateEffectivePtoDaysConsumed(
        '2026-08-03',
        '2026-08-09',
        [{ date: '2026-08-04', name: 'Test Holiday' }],
        [1, 2, 3, 4, 5],
        [{ startDate: '2026-08-01', endDate: '2026-08-14', coverageFactor: 1.0 }]
      );
      expect(result.publicHolidaysCount).toBe(1);
      expect(result.ptoDaysConsumed).toBe(4);
      expect(result.overlappingClosureWeekdays).toBe(4);
      expect(result.effectivePtoDaysConsumed).toBe(0);
    });
  });

  describe('applyChildcareArbitrageWarnings', () => {
    function makeCandidate(overrides: Partial<ChildcareArbitrageCandidate>): ChildcareArbitrageCandidate {
      return {
        destinationAirport: 'PMI',
        durationDays: 7,
        startDate: '2026-08-03',
        endDate: '2026-08-09',
        ptoDaysConsumed: 0,
        estimatedTotalCost: 1000,
        ...overrides,
      };
    }

    it('attaches a warning when cost-per-saved-PTO-day exceeds the EUR 150 threshold', () => {
      const closureWindow = makeCandidate({
        overlapsChildcareClosure: true,
        hasYoungChildAtDeparture: true,
        rawPtoDaysConsumed: 5,
        ptoDaysConsumed: 0,
        estimatedTotalCost: 2000,
      });
      const offPeakWindow = makeCandidate({
        startDate: '2026-05-04',
        endDate: '2026-05-10',
        overlapsChildcareClosure: false,
        estimatedTotalCost: 500,
      });

      applyChildcareArbitrageWarnings([closureWindow, offPeakWindow]);

      expect(closureWindow.childcareArbitrageWarning).toBeDefined();
      expect(closureWindow.childcareArbitrageWarning).toMatchObject({
        savedPtoDays: 5,
        extraCostEur: 1500,
        costPerSavedPtoDay: 300,
        bestOffPeakPrice: 500,
      });
      expect(offPeakWindow.childcareArbitrageWarning).toBeUndefined();
    });

    it('does not warn when cost-per-saved-PTO-day is at or below the threshold', () => {
      const closureWindow = makeCandidate({
        overlapsChildcareClosure: true,
        hasYoungChildAtDeparture: true,
        rawPtoDaysConsumed: 5,
        ptoDaysConsumed: 0,
        estimatedTotalCost: 1600,
      });
      const offPeakWindow = makeCandidate({
        startDate: '2026-05-04',
        endDate: '2026-05-10',
        overlapsChildcareClosure: false,
        estimatedTotalCost: 1500,
      });

      applyChildcareArbitrageWarnings([closureWindow, offPeakWindow]);

      // DeltaCost=100, savedPtoDays=5 -> costPerSavedPtoDay=20, below the 150 threshold
      expect(closureWindow.childcareArbitrageWarning).toBeUndefined();
    });

    it('skips families without a daycare-age child even when the window overlaps a closure', () => {
      const closureWindow = makeCandidate({
        overlapsChildcareClosure: true,
        hasYoungChildAtDeparture: false,
        rawPtoDaysConsumed: 5,
        ptoDaysConsumed: 0,
        estimatedTotalCost: 5000,
      });
      const offPeakWindow = makeCandidate({
        startDate: '2026-05-04',
        endDate: '2026-05-10',
        overlapsChildcareClosure: false,
        estimatedTotalCost: 200,
      });

      applyChildcareArbitrageWarnings([closureWindow, offPeakWindow]);

      expect(closureWindow.childcareArbitrageWarning).toBeUndefined();
    });

    it('only compares against siblings of the same destination and duration', () => {
      const closureWindow = makeCandidate({
        destinationAirport: 'PMI',
        durationDays: 7,
        overlapsChildcareClosure: true,
        hasYoungChildAtDeparture: true,
        rawPtoDaysConsumed: 5,
        ptoDaysConsumed: 0,
        estimatedTotalCost: 2000,
      });
      const unrelatedDestination = makeCandidate({
        destinationAirport: 'AYT',
        durationDays: 7,
        overlapsChildcareClosure: false,
        estimatedTotalCost: 50,
      });
      const unrelatedDuration = makeCandidate({
        destinationAirport: 'PMI',
        durationDays: 14,
        overlapsChildcareClosure: false,
        estimatedTotalCost: 50,
      });

      applyChildcareArbitrageWarnings([closureWindow, unrelatedDestination, unrelatedDuration]);

      // No off-peak sibling with the same destination+duration exists, so no comparison is possible
      expect(closureWindow.childcareArbitrageWarning).toBeUndefined();
    });
  });
});
