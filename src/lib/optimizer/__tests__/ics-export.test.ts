import { describe, it, expect } from 'vitest';
import { escapeIcsText, foldIcsLine, generateVacationIcs } from '../../calendar/ics-export';

describe('RFC 5545 .ics text escaping', () => {
  it('escapes backslashes, semicolons, commas, and newlines per section 3.3.11', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b');
    expect(escapeIcsText('a;b')).toBe('a\\;b');
    expect(escapeIcsText('a,b')).toBe('a\\,b');
    expect(escapeIcsText('a\nb')).toBe('a\\nb');
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb');
  });

  it('escapes combinations in the correct order (backslash first)', () => {
    expect(escapeIcsText('a\\,b')).toBe('a\\\\\\,b');
  });
});

describe('RFC 5545 line folding', () => {
  it('leaves short lines (<= 75 octets) unchanged', () => {
    const short = 'SUMMARY:Short line';
    expect(foldIcsLine(short)).toBe(short);
  });

  it('folds long lines at 75 octets with CRLF + single-space continuation', () => {
    const long = `DESCRIPTION:${'x'.repeat(100)}`;
    const folded = foldIcsLine(long);
    const segments = folded.split('\r\n');
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].length).toBe(75);
    for (const seg of segments.slice(1)) {
      expect(seg.startsWith(' ')).toBe(true);
    }
    // Rejoining (stripping the CRLF + leading space) must reconstruct the original line
    const rejoined = segments[0] + segments.slice(1).map((s) => s.slice(1)).join('');
    expect(rejoined).toBe(long);
  });
});

describe('generateVacationIcs', () => {
  const baseInput = {
    destinationName: 'Palma, Mallorca',
    originAirport: 'STR',
    destinationAirport: 'PMI',
    startDate: '2026-08-03',
    endDate: '2026-08-10',
    totalWeekdays: 5,
    publicHolidaysCount: 1,
    ptoDaysConsumed: 4,
    estimatedTotalCost: 1800,
    pricePerPerson: 450,
    deepLinks: {
      googleFlights: 'https://www.google.com/travel/flights?q=test',
    },
  };

  it('produces a well-formed VCALENDAR/VEVENT wrapper', () => {
    const ics = generateVacationIcs(baseInput);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('uses all-day DATE values with an exclusive DTEND one day past the trip end', () => {
    const ics = generateVacationIcs(baseInput);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260803');
    expect(ics).toContain('DTEND;VALUE=DATE:20260811');
  });

  it('includes the escaped destination name and PTO/cost summary in DESCRIPTION', () => {
    const ics = generateVacationIcs(baseInput);
    // Un-fold any inserted "\r\n " continuations before asserting on content
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:Vacation: Palma\\, Mallorca');
    expect(unfolded).toContain('Destination: Palma\\, Mallorca');
    expect(unfolded).toContain('PTO days consumed: 4 of 5 weekdays');
    expect(unfolded).toContain('1 public holiday/bridge day(s) leveraged');
    expect(unfolded).toContain('Estimated total cost: 1800 EUR (450 EUR/person)');
    expect(unfolded).toContain('https://www.google.com/travel/flights?q=test');
  });

  it('produces a stable, deterministic UID for the same trip', () => {
    const first = generateVacationIcs(baseInput);
    const second = generateVacationIcs(baseInput);
    const uidOf = (s: string) => s.match(/UID:([^\r\n]+)/)?.[1];
    expect(uidOf(first)).toBe(uidOf(second));
    expect(uidOf(first)).toContain('STR-PMI-2026-08-03-2026-08-10');
  });
});
