import { describe, it, expect } from 'vitest';
import { findBestStretches, type FreeDay } from '../best-holiday-days';

/** Consecutive free days from `start` with the given other-region counts */
const days = (start: string, counts: (number | null)[]): FreeDay[] =>
  counts.map((otherRegions, i) => ({
    date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
    otherRegions,
  }));

describe('best stretch of each holiday block', () => {
  it('Baden-Württemberg summer: the quiet end of the break, not the crowded start', () => {
    // 29 Jul - 11 Sep 2027: 14-15 states in early August, down to 1 (Bavaria) in September
    const counts = [14, 14, 14, 14, 15, 15, 15, 15, 15, 12, 12, 12, 12, 12, 11, 11, 11, 8, 8, 8, 8, 6, 6, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, ...Array(11).fill(1)];
    const [best] = findBestStretches(days('2027-07-29', counts));
    expect(best).toMatchObject({ start: '2027-09-01', end: '2027-09-11', otherRegions: 1, maxOtherRegions: 1 });
    expect(best).toMatchObject({ blockStart: '2027-07-29', blockEnd: '2027-09-11' });
  });

  it('recommends a trip-sized window, not a single quiet day', () => {
    const [best] = findBestStretches(days('2027-05-18', [9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]));
    expect(best.start).toBe('2027-05-19');
    expect(best.end).toBe('2027-05-29');
  });

  it('handles separate blocks, skips long weekends and blocks without data', () => {
    const free = [...days('2027-04-01', [5, 5, 5, 5]), ...days('2027-06-01', [1, 1]), ...days('2027-10-01', [null, null, null])];
    const result = findBestStretches(free);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ start: '2027-04-01', end: '2027-04-04', blockStart: '2027-04-01', blockEnd: '2027-04-04' });
  });

  it('treats unknown days as the busiest', () => {
    const [best] = findBestStretches(days('2027-08-01', [null, null, null, null, null, null, null, 2, 2, 2, 2, 2, 2, 2]));
    expect(best).toMatchObject({ start: '2027-08-08', end: '2027-08-14', otherRegions: 2 });
  });
});
