export interface IcsDeepLinks {
  googleFlights?: string;
  skyscanner?: string;
  bookingCom?: string;
}

export interface IcsExportInput {
  destinationName: string;
  originAirport?: string;
  destinationAirport?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalWeekdays: number;
  publicHolidaysCount: number;
  ptoDaysConsumed: number;
  estimatedTotalCost: number;
  pricePerPerson?: number;
  currency?: string;
  deepLinks?: IcsDeepLinks;
}

/**
 * Escapes a text value per RFC 5545 section 3.3.11: backslash, semicolon, comma, and
 * newline must be backslash-escaped before being placed in a property value.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Folds a single content line at 75 octets with CRLF + single-space continuation,
 * per RFC 5545 section 3.1.
 */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  let first = true;
  while (i < line.length) {
    const len = first ? 75 : 74;
    chunks.push(line.slice(i, i + len));
    i += len;
    first = false;
  }
  return chunks.join('\r\n ');
}

function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function addDaysToIsoDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Generates a standards-compliant RFC 5545 .ics string for a single vacation candidate window:
 * an all-day VEVENT spanning the travel window, with PTO summary and booking deep links in
 * DESCRIPTION. DTEND uses the RFC 5545 exclusive-end-date convention for all-day events
 * (one day past the trip's actual last day).
 */
export function generateVacationIcs(input: IcsExportInput): string {
  const currency = input.currency || 'EUR';
  const origin = (input.originAirport || '').toUpperCase();
  const dest = (input.destinationAirport || 'trip').toUpperCase();

  const uid = `famvacay-${origin || 'origin'}-${dest}-${input.startDate}-${input.endDate}@famvacay.us`;
  const dtstamp = `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const dtstart = formatIcsDate(input.startDate);
  const dtendExclusive = formatIcsDate(addDaysToIsoDate(input.endDate, 1));

  const descriptionLines = [
    `Destination: ${input.destinationName}`,
    `PTO days consumed: ${input.ptoDaysConsumed} of ${input.totalWeekdays} weekdays` +
      (input.publicHolidaysCount > 0 ? ` (${input.publicHolidaysCount} public holiday/bridge day(s) leveraged)` : ''),
    `Estimated total cost: ${input.estimatedTotalCost} ${currency}` +
      (input.pricePerPerson ? ` (${input.pricePerPerson} ${currency}/person)` : ''),
  ];
  if (input.deepLinks?.googleFlights) descriptionLines.push(`Flights (Google Flights): ${input.deepLinks.googleFlights}`);
  if (input.deepLinks?.skyscanner) descriptionLines.push(`Flights (Skyscanner): ${input.deepLinks.skyscanner}`);
  if (input.deepLinks?.bookingCom) descriptionLines.push(`Lodging (Booking.com): ${input.deepLinks.bookingCom}`);

  const description = escapeIcsText(descriptionLines.join('\n'));
  const summary = escapeIcsText(`Vacation: ${input.destinationName}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FamVacay//Vacation Optimizer//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtendExclusive}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
