/**
 * How strongly a travel guide is about one kind of holiday (0-1), from how often it mentions it:
 * mentions per article size, damped for very short articles. Shared by the holiday-appeal
 * generator (to pick, per kind, the article that says the most about it) and the scoring in
 * holiday-appeal.ts. Pure and dependency-free.
 */
export type HolidayEvidenceKind = 'beach' | 'ski' | 'nature' | 'culture' | 'family';

export const HOLIDAY_EVIDENCE_KINDS: HolidayEvidenceKind[] = ['beach', 'ski', 'nature', 'culture', 'family'];

/** Mentions per 10 kB at which the evidence is ~63% saturated (culture needs more: every city guide lists museums) */
const DENSITY_SCALE: Record<HolidayEvidenceKind, number> = { beach: 3, ski: 2, nature: 2, culture: 6, family: 1.5 };
/** Absolute mentions needed before a short article counts (~63% at this many) */
const MIN_MENTIONS = 8;
/** Articles shorter than this are treated as this long, so a stub cannot reach a high density */
const MIN_SIZE_KB = 5;

export function holidayEvidence(kind: HolidayEvidenceKind, mentions: number, sizeKb: number): number {
  const density = (mentions / Math.max(sizeKb, MIN_SIZE_KB)) * 10;
  return (1 - Math.exp(-density / DENSITY_SCALE[kind])) * (1 - Math.exp(-mentions / MIN_MENTIONS));
}
