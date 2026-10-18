/**
 * Moving Holiday Computus & Annual Special Times Calculator
 * Automatically calculates dates for Easter, Pentecost, Ascension, Corpus Christi,
 * and seasonal periods that change every year.
 */

export interface SpecialHolidayPeriod {
  id: 'easter' | 'pentecost' | 'ascension' | 'corpus_christi' | 'christmas_new_year';
  name: string;
  startDate: string;
  endDate: string;
  icon: string;
  description: string;
}

/**
 * Computes Easter Sunday for a given year using the anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
export function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatDateIso(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Returns annual special times and moving holiday periods for a given year.
 */
export function getAnnualSpecialTimes(year: number, locale: string = 'de'): SpecialHolidayPeriod[] {
  const easterSunday = calculateEasterSunday(year);

  // Easter / Holy Week: Good Friday to Easter Monday
  const goodFriday = addDaysUtc(easterSunday, -2);
  const easterMonday = addDaysUtc(easterSunday, 1);

  // Ascension: Thursday (Himmelfahrt) through Sunday (long weekend)
  const ascensionThu = addDaysUtc(easterSunday, 39);
  const ascensionSun = addDaysUtc(easterSunday, 42);

  // Pentecost / Whitsun: Pentecost Saturday to Whit Monday
  const pentecostSat = addDaysUtc(easterSunday, 48);
  const whitMonday = addDaysUtc(easterSunday, 50);

  // Corpus Christi: Thursday to Sunday (Brückentag)
  const corpusThu = addDaysUtc(easterSunday, 60);
  const corpusSun = addDaysUtc(easterSunday, 63);

  // Christmas to New Year
  const christmasStart = `${year}-12-24`;
  const newYearEnd = `${year + 1}-01-01`;

  const isDe = locale.startsWith('de');
  const isFr = locale.startsWith('fr');
  const isEs = locale.startsWith('es');
  const isIt = locale.startsWith('it');

  return [
    {
      id: 'easter',
      name: isDe ? 'Ostern' : isFr ? 'Pâques' : isEs ? 'Semana Santa' : isIt ? 'Pasqua' : 'Easter',
      startDate: formatDateIso(goodFriday),
      endDate: formatDateIso(easterMonday),
      icon: '🐣',
      description: isDe ? 'Karfreitag bis Ostermontag' : 'Good Friday to Easter Monday',
    },
    {
      id: 'pentecost',
      name: isDe ? 'Pfingsten' : isFr ? 'Pentecôte' : isEs ? 'Pentecostés' : isIt ? 'Pentecoste' : 'Pentecost',
      startDate: formatDateIso(pentecostSat),
      endDate: formatDateIso(whitMonday),
      icon: '🕊️',
      description: isDe ? 'Pfingstsamstag bis Pfingstmontag' : 'Pentecost weekend & Whit Monday',
    },
    {
      id: 'ascension',
      name: isDe ? 'Christi Himmelfahrt' : isFr ? 'Ascension' : isEs ? 'Ascensión' : isIt ? 'Ascensione' : 'Ascension Day',
      startDate: formatDateIso(ascensionThu),
      endDate: formatDateIso(ascensionSun),
      icon: '✝️',
      description: isDe ? 'Himmelfahrt + Brückentag-Wochenende' : 'Ascension long weekend',
    },
    {
      id: 'corpus_christi',
      name: isDe ? 'Fronleichnam' : isFr ? 'Fête-Dieu' : isEs ? 'Corpus Christi' : isIt ? 'Corpus Domini' : 'Corpus Christi',
      startDate: formatDateIso(corpusThu),
      endDate: formatDateIso(corpusSun),
      icon: '⛪',
      description: isDe ? 'Fronleichnam + Brückentag' : 'Corpus Christi long weekend',
    },
    {
      id: 'christmas_new_year',
      name: isDe ? 'Weihnachten & Silvester' : isFr ? 'Noël & Nouvel An' : isEs ? 'Navidad y Año Nuevo' : isIt ? 'Natale e Capodanno' : 'Christmas & New Year',
      startDate: christmasStart,
      endDate: newYearEnd,
      icon: '🎄',
      description: isDe ? 'Heiligabend bis Neujahr' : 'Christmas Eve to New Year',
    },
  ];
}

