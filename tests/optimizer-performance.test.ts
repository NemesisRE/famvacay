import { describe, it, expect } from 'vitest';
import {
  optimizeVacationWindows,
  selectRepresentativeWindows,
  DEFAULT_MAX_TOTAL_WINDOWS,
  DEFAULT_MAX_WINDOWS_PER_DESTINATION,
} from '@/lib/optimizer/engine';
import type { CandidateWindow, TripPlanInput } from '@/lib/optimizer/types';

const wideSearch: TripPlanInput = {
  durationDaysMin: 10,
  durationDaysMax: 14,
  durationDays: 10,
  earliestDate: '2027-06-01',
  latestDate: '2027-09-15',
  travelVehicles: ['PLANE', 'CAR'],
  userProfile: {
    homeLocation: 'Karlsruhe, Germany',
    departureLat: 49.0069,
    departureLon: 8.4037,
    federalState: 'DE-BW',
    originAirports: ['STR', 'FKB', 'FRA'],
    childrenAges: [5, 9],
    blackoutRanges: [],
  },
};

describe('Optimizer performance & payload bounds', () => {
  // Before memoization/pruning this exact search took ~186 s and produced 46k windows (~256 MB JSON).
  it(
    'a 3.5-month, 5-duration, 3-airport search stays fast and bounded',
    () => {
      const t0 = performance.now();
      const windows = optimizeVacationWindows(wideSearch, {}, {});
      const elapsedMs = performance.now() - t0;

      expect(elapsedMs).toBeLessThan(20000); // generous for slow CI runners; ~1.5 s locally
      expect(windows.length).toBeLessThanOrEqual(DEFAULT_MAX_TOTAL_WINDOWS);
      expect(JSON.stringify(windows).length).toBeLessThan(15 * 1024 * 1024);
      expect(new Set(windows.map((w) => w.destinationAirport)).size).toBeGreaterThanOrEqual(20);
    },
    // Vitest's default 5s per-test timeout is tighter than the 20s SLA this test is actually
    // asserting above; raise it to match so v8 coverage instrumentation overhead alone
    // doesn't fail the test before that assertion ever runs.
    20000,
  );

  // Runs the full wide search first: the same 20 s budget as above (5 s is too tight in a parallel run)
  it('representative selection keeps every month x duration bucket and the curation anchors', () => {
    const all = optimizeVacationWindows({ ...wideSearch, maxWindowsPerDestination: 0 }, {}, {});
    const kept = selectRepresentativeWindows(all, {
      maxPerDestination: DEFAULT_MAX_WINDOWS_PER_DESTINATION,
      maxTotal: Number.MAX_SAFE_INTEGER,
    });

    const byDest = (list: CandidateWindow[]) => {
      const m = new Map<string, CandidateWindow[]>();
      for (const w of list) m.set(w.destinationAirport, [...(m.get(w.destinationAirport) || []), w]);
      return m;
    };
    const allByDest = byDest(all);
    const keptByDest = byDest(kept);

    for (const [dest, list] of allByDest) {
      const keptList = keptByDest.get(dest) || [];
      expect(keptList.length).toBeLessThanOrEqual(DEFAULT_MAX_WINDOWS_PER_DESTINATION);
      const buckets = new Set(list.map((w) => `${w.startDate.slice(0, 7)}|${w.durationDays}`));
      const keptBuckets = new Set(keptList.map((w) => `${w.startDate.slice(0, 7)}|${w.durationDays}`));
      if (buckets.size <= DEFAULT_MAX_WINDOWS_PER_DESTINATION - 3) {
        expect(keptBuckets).toEqual(buckets);
      }
      const cheapest = Math.min(...list.map((w) => w.estimatedTotalCost));
      expect(keptList.some((w) => w.estimatedTotalCost === cheapest)).toBe(true);
      const best = Math.max(...list.map((w) => w.finalScore));
      expect(keptList.some((w) => w.finalScore === best)).toBe(true);
    }
  }, 20000);
});
