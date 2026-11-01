/**
 * The best stretch of each block of shared holiday days: the days on which the fewest other
 * school regions are on holiday (the quietest and cheapest part of the break). For a family in
 * Baden-Württemberg that is early September in the summer holidays - fewer and fewer states are
 * off as August goes on, until only Bavaria is left.
 */

export interface FreeDay {
  date: string; // YYYY-MM-DD, a day all children are off (and no blackout)
  /** Other school regions on holiday that day; null = unknown */
  otherRegions: number | null;
}

export interface BestStretch {
  blockStart: string;
  blockEnd: string;
  start: string;
  end: string;
  /** Other regions on holiday within the stretch: fewest and most */
  otherRegions: number;
  maxOtherRegions: number;
}

/** Shorter breaks (a long weekend) are not worth a recommendation */
const MIN_BLOCK_DAYS = 3;
/** Recommend a trip-sized stretch, not the single quietest day */
const TRIP_DAYS = 7;

const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Per block: the quietest window of a trip's length (the block itself when shorter; unknown days
 * rank behind every known one), extended by the neighbouring days that are no busier than the window's
 * busiest day - in Baden-Württemberg's summer that is 1-11 September, when only Bavaria is still off.
 */
export function findBestStretches(freeDays: FreeDay[]): BestStretch[] {
  const sorted = [...freeDays].sort((a, b) => a.date.localeCompare(b.date));
  const blocks: FreeDay[][] = [];
  for (const day of sorted) {
    const block = blocks[blocks.length - 1];
    if (block && nextDay(block[block.length - 1].date) === day.date) block.push(day);
    else blocks.push([day]);
  }

  const result: BestStretch[] = [];
  for (const block of blocks) {
    if (block.length < MIN_BLOCK_DAYS) continue;
    const known = block.filter((d) => d.otherRegions !== null).map((d) => d.otherRegions!);
    if (known.length === 0) continue;
    // Unknown days rank behind every known one
    const unknownLoad = Math.max(...known) + 1;
    const load = block.map((d) => d.otherRegions ?? unknownLoad);
    const size = Math.min(TRIP_DAYS, block.length);
    let bestStart = 0;
    let bestSum = Infinity;
    for (let i = 0; i + size <= block.length; i++) {
      const sum = load.slice(i, i + size).reduce((a, b) => a + b, 0);
      if (sum < bestSum) {
        bestSum = sum;
        bestStart = i;
      }
    }
    let start = bestStart;
    let end = bestStart + size - 1;
    const ceiling = Math.max(...load.slice(start, end + 1));
    while (start > 0 && load[start - 1] <= ceiling) start--;
    while (end < block.length - 1 && load[end + 1] <= ceiling) end++;
    result.push({
      blockStart: block[0].date,
      blockEnd: block[block.length - 1].date,
      start: block[start].date,
      end: block[end].date,
      otherRegions: Math.min(...load.slice(start, end + 1)),
      maxOtherRegions: Math.min(ceiling, unknownLoad - 1),
    });
  }
  return result;
}

export interface QuietStretch {
  start: string;
  end: string;
  /** School regions on holiday during the stretch */
  regions: number;
}

/** A stretch worth a trip */
const MIN_QUIET_DAYS = 7;
const MAX_QUIET_STRETCHES = 6;

/**
 * Without school children every day is possible: the best times are the longest stretches with the
 * fewest school regions on holiday (usually none - outside all school holidays), in calendar order.
 */
export function findQuietStretches(days: FreeDay[]): QuietStretch[] {
  const known = [...days].filter((d) => d.otherRegions !== null).sort((a, b) => a.date.localeCompare(b.date));
  if (known.length === 0) return [];
  const min = Math.min(...known.map((d) => d.otherRegions!));
  const runs: QuietStretch[] = [];
  let current: QuietStretch | null = null;
  for (const d of known) {
    if (d.otherRegions === min && current && nextDay(current.end) === d.date) {
      current.end = d.date;
    } else if (d.otherRegions === min) {
      current = { start: d.date, end: d.date, regions: min };
      runs.push(current);
    } else {
      current = null;
    }
  }
  const length = (r: QuietStretch) => (Date.parse(r.end) - Date.parse(r.start)) / 86_400_000 + 1;
  return runs
    .filter((r) => length(r) >= MIN_QUIET_DAYS)
    .sort((a, b) => length(b) - length(a) || a.start.localeCompare(b.start))
    .slice(0, MAX_QUIET_STRETCHES)
    .sort((a, b) => a.start.localeCompare(b.start));
}
