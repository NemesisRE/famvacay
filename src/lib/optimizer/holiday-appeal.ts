import holidayAppealSeed from './data/holiday-appeal.json';
import { derived, getDataset } from '../datasets/store';
import { HOLIDAY_APPEAL_ROW_INDEX, type HolidayAppealRow } from '../datasets/generators/holiday-appeal';
import { holidayEvidence, type HolidayEvidenceKind } from './holiday-evidence';
import type { DestinationType } from './types';

/**
 * How popular an airport's area is as a holiday destination, per vacation style (0-1), from
 * Wikivoyage guides (see src/lib/datasets/generators/holiday-appeal.ts):
 * - readership: annual page views of the place's travel guide
 * - evidence: how much the guide is about beaches, skiing, nature or sights (mentions per article
 *   size, damped for very short articles)
 * Appeal is readership x evidence - roughly "how many people read about this place's beaches" -
 * so a much-read guide wins only for the kind of holiday it is actually about, and between two
 * similar places the more popular one wins (Mallorca over Ibiza). Airports without a guide
 * return null; callers fall back to their own signals.
 */

type Evidence = HolidayEvidenceKind;

const holidayAppealData = () =>
  getDataset('holiday-appeal', holidayAppealSeed as unknown as Record<string, HolidayAppealRow>);

/** Readership of the top 3% of guides: the reference for full appeal */
const REFERENCE_VIEWS_PERCENTILE = 0.97;
/** Evidence a reference destination is expected to have for full appeal */
const REFERENCE_EVIDENCE = 0.8;

const referenceViews = derived(() => {
  const views = Object.values(holidayAppealData())
    .map((row) => row[0])
    .sort((a, b) => a - b);
  return Math.max(1, views[Math.floor(REFERENCE_VIEWS_PERCENTILE * (views.length - 1))] ?? 1);
});

function evidence(row: HolidayAppealRow, kind: Evidence): number {
  const i = HOLIDAY_APPEAL_ROW_INDEX[kind];
  return holidayEvidence(kind, row[i], row[i + 1]);
}

const STYLE_EVIDENCE: Partial<Record<DestinationType, Evidence>> = {
  BEACH: 'beach',
  ALPINE: 'ski',
  SKI: 'ski',
  NATURE: 'nature',
  CITY: 'culture',
};

/** In broad searches (all styles, long-haul) sights alone make a city trip, rarely a family holiday */
const BROAD_SEARCH_CULTURE_FACTOR = 0.3;
/** Theme parks, zoos and aquariums add a little on top */
const FAMILY_BONUS_WEIGHT = 0.1;
/** Below this, a guide says too little about the requested style to count as a match */
export const MIN_STYLE_EVIDENCE = 0.2;

export interface HolidayAppealSignals {
  /** Annual page views of the most-read guide for the airport's area */
  views: number;
  /** 0-1 per style: how much the guide is about it */
  evidence: Record<Evidence, number>;
}

export function getHolidayAppealSignals(code: string): HolidayAppealSignals | null {
  const row = holidayAppealData()[code.toUpperCase()];
  if (!row) return null;
  return {
    views: row[0],
    evidence: {
      beach: evidence(row, 'beach'),
      ski: evidence(row, 'ski'),
      nature: evidence(row, 'nature'),
      culture: evidence(row, 'culture'),
      family: evidence(row, 'family'),
    },
  };
}

function wantedEvidence(styles: DestinationType[]): Evidence[] {
  return [...new Set(styles.map((s) => STYLE_EVIDENCE[s]).filter((e): e is Evidence => Boolean(e)))];
}

/**
 * Evidence for the requested specific styles (strongest of them), or null for broad searches and
 * airports without a guide. Discovery drops destinations below MIN_STYLE_EVIDENCE.
 */
export function getStyleEvidence(code: string, styles: DestinationType[]): number | null {
  const kinds = wantedEvidence(styles);
  if (kinds.length === 0) return null;
  const signals = getHolidayAppealSignals(code);
  if (!signals) return null;
  return Math.max(...kinds.map((k) => signals.evidence[k]));
}

/**
 * 0-1 holiday appeal for the requested styles: readership (capped at a top destination's) x the
 * strongest evidence among them, relative to a top destination, square-rooted to keep differences
 * visible. "All styles" and long-haul take the destination's strongest kind of holiday, culture at
 * 30% weight.
 */
export function getHolidayAppeal(code: string, styles: DestinationType[]): number | null {
  const signals = getHolidayAppealSignals(code);
  if (!signals) return null;
  const wanted = wantedEvidence(styles);
  const bestEvidence =
    wanted.length > 0
      ? Math.max(...wanted.map((k) => signals.evidence[k]))
      : Math.max(
          signals.evidence.beach,
          signals.evidence.ski,
          signals.evidence.nature,
          BROAD_SEARCH_CULTURE_FACTOR * signals.evidence.culture
        );
  // Readership counts up to the reference: Paris's 150k readers do not make it a beach holiday
  const popularity = (Math.min(signals.views, referenceViews()) * bestEvidence) / (referenceViews() * REFERENCE_EVIDENCE);
  return Math.min(1, Math.sqrt(popularity) + FAMILY_BONUS_WEIGHT * signals.evidence.family);
}
