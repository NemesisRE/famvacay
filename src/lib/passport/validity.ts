/**
 * Passport validity rules shared by the result cards and the reminder mails.
 *
 * Many countries want a passport valid for 6 months beyond the stay. Between countries of the EU,
 * the EEA and Switzerland citizens travel with an ID card, so a trip there gets no warning - the
 * home country stands in for the citizenship we do not ask for.
 */
export const PASSPORT_VALIDITY_MONTHS = 6;

const FREE_MOVEMENT = new Set([
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA and Switzerland
  'IS', 'LI', 'NO', 'CH',
]);

export interface PassportHolder {
  label: string;
  /** YYYY-MM-DD */
  expiry: string;
}

/** YYYY-MM-DD plus whole months, clamped to the month's last day (Aug 31 + 6 months = Feb 28/29) */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function needsPassportValidity(homeCountry: string | undefined, destinationCountry: string | undefined): boolean {
  const home = (homeCountry || '').toUpperCase();
  const dest = (destinationCountry || '').toUpperCase();
  if (!dest || home === dest) return false;
  return !(FREE_MOVEMENT.has(home) && FREE_MOVEMENT.has(dest));
}

/** Holders whose passport is not valid for 6 months after the trip ends */
export function passportWarningsForTrip(
  holders: PassportHolder[],
  tripEnd: string,
  homeCountry: string | undefined,
  destinationCountry: string | undefined
): PassportHolder[] {
  if (holders.length === 0 || !needsPassportValidity(homeCountry, destinationCountry)) return [];
  const requiredUntil = addMonths(tripEnd, PASSPORT_VALIDITY_MONTHS);
  return holders.filter((h) => h.expiry.slice(0, 10) < requiredUntil);
}

export type ReminderStage = '6m' | '1m';

/**
 * Which reminder is due for a passport: 6 months ahead, then 1 month ahead (also shortly after it
 * expired). Passports that expired more than 30 days ago are left alone - the date is stale.
 */
export function reminderStage(expiry: string, today: string): ReminderStage | null {
  const days = Math.round((Date.parse(expiry.slice(0, 10)) - Date.parse(today.slice(0, 10))) / 86_400_000);
  if (days < -30) return null;
  if (days <= 31) return '1m';
  if (expiry.slice(0, 10) <= addMonths(today, PASSPORT_VALIDITY_MONTHS)) return '6m';
  return null;
}
