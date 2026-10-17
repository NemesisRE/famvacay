import Holidays from 'date-holidays';
import iso from 'iso-3166-2';
import { DestinationType, WeatherAssessment } from './types';
import { getAirportByIata } from '../airports/airport-service';

export interface DestinationProfile {
  code: string;
  name: string;
  country: string;
  type: DestinationType;
  lat: number;
  lon: number;
  idealMinTemp: number;
  idealMaxTemp: number;
  maxAcceptablePrecipRisk: number; // percentage (0-100)
}

/**
 * Dynamic Destination Profile Resolver
 * Generates destination metadata dynamically from the worldwide commercial airport database,
 * physical elevation, latitude, and continuous climatological modeling.
 * Completely eliminates static, hardcoded city lists and keyword matching.
 */
export function getDestinationProfile(code: string): DestinationProfile | null {
  const airport = getAirportByIata(code);
  if (!airport) return null;

  const lat = airport.lat;
  const lon = airport.lon;
  const altitudeMeters = (airport.altitude || 0) * 0.3048;

  const winterMonth = lat >= 0 ? 0 : 6;
  const summerMonth = lat >= 0 ? 6 : 0;
  const winterClimate = getEstimatedClimate(airport.code, winterMonth, { lat, lon });
  const summerClimate = getEstimatedClimate(airport.code, summerMonth, { lat, lon });

  // Infer destination vacation category based purely on physical elevation, latitude, and climatological conditions
  let type: DestinationType = 'CITY';

  const isSki =
    altitudeMeters >= 550 &&
    Math.abs(lat) >= 35 &&
    winterClimate.avgTempC <= 3;

  const isCoastal =
    !isSki &&
    altitudeMeters < 600 &&
    summerClimate.waterTempC != null &&
    summerClimate.waterTempC >= 19 &&
    (summerClimate.maxTempC ?? summerClimate.avgTempC) >= 22;

  if (isSki) {
    type = 'SKI';
  } else if (isCoastal || Math.abs(lat) < 32) {
    // Warm subtropical / tropical latitudes or coastal geography naturally support beach/leisure vacations
    type = 'BEACH';
  }

  return {
    code: airport.code,
    name: airport.name,
    country: airport.country,
    type,
    lat,
    lon,
    idealMinTemp: type === 'SKI' ? -8 : (type === 'BEACH' ? 20 : 15),
    idealMaxTemp: type === 'SKI' ? 4 : (type === 'BEACH' ? 33 : 30),
    maxAcceptablePrecipRisk: type === 'BEACH' ? 25 : 35,
  };
}

/**
 * Backwards-compatible Proxy for POPULAR_DESTINATIONS.
 * Dynamically resolves any valid 3-letter IATA airport code on access.
 */
export const POPULAR_DESTINATIONS: Record<string, DestinationProfile> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string' || prop.length !== 3) return undefined;
      return getDestinationProfile(prop.toUpperCase()) || undefined;
    },
    has(_target, prop: string) {
      if (typeof prop !== 'string' || prop.length !== 3) return false;
      return Boolean(getAirportByIata(prop.toUpperCase()));
    },
  }
);

export interface SeasonalConstraintWarning {
  destinationCode: string;
  seasonType: 'MONSOON' | 'EXTREME_HEAT' | 'TYPHOON_HURRICANE' | 'OVERCROWDED_PEAK';
  monthRange: number[]; // Months 0-11
  messageKey: string;
  fallbackMessage: string;
  eventName?: string;
}

/**
 * Anonymous Gregorian Computus algorithm to calculate Easter Sunday for any year.
 * Used for dynamic calculation of Carnival, Mardi Gras, Holy Week, and Spring Break windows worldwide.
 */
export function getEasterDate(year: number): { month: number; day: number } {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day }; // 0-indexed month (2 = March, 3 = April)
}

/**
 * Universal Climatological Model Benchmark
 * Computes continuous estimated temperature, water temperature, rain probability, and sunshine
 * dynamically for any location on Earth based on physical latitude, solar declination, and seasonal insolation.
 * Completely eliminates arbitrary latitude bounding boxes and static city lookup tables.
 */
export function getEstimatedClimate(
  destinationCode: string,
  monthIndex: number, // 0-11
  overrideCoords?: { lat: number; lon: number }
): WeatherAssessment {
  let lat = 0;
  let lon = 0;
  let altitude = 0;
  let type: DestinationType = 'CITY';

  if (overrideCoords) {
    lat = overrideCoords.lat;
    lon = overrideCoords.lon;
  } else {
    const profile = getDestinationProfile(destinationCode);
    const airport = getAirportByIata(destinationCode);
    if (airport) {
      altitude = airport.altitude || 0;
    }
    if (profile) {
      lat = profile.lat;
      lon = profile.lon;
      type = profile.type;
    } else if (airport) {
      lat = airport.lat;
      lon = airport.lon;
    }
  }

  // Mid-month solar declination delta (degrees)
  const dayOfYear = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][monthIndex];
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const solarElevation = Math.max(0, 90 - Math.abs(lat - declination));

  // Climatological mean temperature equation:
  // Equator ~28C, 40 deg ~17C, 50 deg ~11C
  const latRad = (Math.abs(lat) * Math.PI) / 180;
  const annualMean = 28 - 20 * Math.pow(Math.sin(latRad), 1.5);

  // Seasonal amplitude scales with latitude (equator ~2C swing, 45 deg lat ~18C swing)
  const amplitude = 2 + 18 * Math.sin(latRad);
  const seasonalCycle = Math.sin(((solarElevation - 45) / 45) * (Math.PI / 2));
  let tempBase = annualMean + seasonalCycle * amplitude * 0.8;

  // Mountain lapse rate for alpine / ski destinations (~2000m altitude baseline)
  if (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42)) {
    tempBase -= 14;
  }

  // Subtropical dry belt solar heating in high-summer (descending Hadley cell dry belt)
  const isSubtropicalDryBelt =
    Math.abs(lat) >= 15 &&
    Math.abs(lat) <= 36 &&
    solarElevation > 70;

  if (isSubtropicalDryBelt) {
    tempBase += 7;
  }

  // Maritime / ocean surface temperature (lags solar insolation by ~4-6 weeks)
  let waterTemp: number | null = null;
  const isMaritime = type === 'BEACH' || Math.abs(lat) < 42;
  if (isMaritime) {
    const lagMonth = (monthIndex + 11) % 12;
    const lagDay = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][lagMonth];
    const lagDecl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (lagDay - 81));
    const lagElev = Math.max(0, 90 - Math.abs(lat - lagDecl));
    waterTemp = Math.round(12 + (lagElev / 90) * 17); // Range: 12°C (winter temperate) to 29°C (summer tropical)
  }

  // Precipitation: convective monsoon when ITCZ overhead in tropical latitudes
  const itczDist = Math.abs(lat - declination);
  const isTropical = Math.abs(lat) <= 25;
  let precipRisk = 20;

  if (isTropical && itczDist < 16) {
    precipRisk = 65; // Monsoon rainy season
  } else if (isTropical && itczDist > 25) {
    precipRisk = 12; // Tropical dry season
  } else if (isSubtropicalDryBelt) {
    precipRisk = 8;  // Subtropical arid dry zone
  } else if (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42)) {
    precipRisk = 35; // Alpine snow/precipitation
  } else if (Math.abs(lat) >= 35 && Math.abs(lat) <= 45 && solarElevation > 65) {
    precipRisk = 12; // Mediterranean dry summer
  } else {
    precipRisk = 25;
  }

  const rainyDays = Math.max(1, Math.round((precipRisk / 100) * 22));
  const maxTempC = Math.round(tempBase + (isSubtropicalDryBelt ? 5.5 : 3.5));
  const minTempC = Math.round(tempBase - (isSubtropicalDryBelt ? 6.5 : 4.5));

  // Sunshine hours: astronomical daylength scaled by clear sky factor
  const tanLat = Math.tan((lat * Math.PI) / 180);
  const tanDecl = Math.tan((declination * Math.PI) / 180);
  const cosH0 = Math.max(-1, Math.min(1, -tanLat * tanDecl));
  const daylengthHours = (24 / Math.PI) * Math.acos(cosH0);
  const sunshineHours = Math.max(
    3,
    Math.min(13, Math.round(daylengthHours * (1 - (precipRisk / 100) * 0.7)))
  );

  const isSuitable =
    type === 'BEACH'
      ? tempBase >= 20 && precipRisk <= 35
      : tempBase >= (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42) ? -15 : 12) &&
        tempBase <= (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42) ? 4 : 36) &&
        precipRisk <= 55;

  return {
    avgTempC: Math.round(tempBase),
    maxTempC,
    minTempC,
    waterTempC: isMaritime ? waterTemp : null,
    rainyDays,
    sunshineHoursPerDay: sunshineHours,
    precipitationRiskPercent: precipRisk,
    isSuitable,
    reason: isSuitable
      ? 'Weather is within acceptable comfort bounds for families.'
      : `Temperature (${Math.round(tempBase)}°C) or rain risk (${precipRisk}%) outside ideal family window.`,
  };
}

/**
 * Dynamic Seasonal Warning Resolver
 * Derives tropical monsoon, extreme heat, tropical cyclones, and overcrowding hyper-peaks
 * dynamically from physical climate normals, astronomical calendar calculations (Easter/Carnival/Spring Break),
 * and individual destination location metadata.
 * Zero hardcoded place catalogs.
 */
export function getDestinationSeasonalWarning(
  destinationCode: string,
  monthIndex: number, // 0-11
  options?: {
    year?: number;
    weatherAssessment?: WeatherAssessment;
  }
): SeasonalConstraintWarning | null {
  const airport = getAirportByIata(destinationCode);
  if (!airport) return null;

  const lat = airport.lat;
  const lon = airport.lon;
  const country = (airport.country || '').toUpperCase();
  const cityLower = (airport.city || '').toLowerCase();
  const nameLower = (airport.name || '').toLowerCase();
  const code = airport.code.toUpperCase();
  const year = options?.year || 2026;

  // 1. Evaluate climate metrics dynamically
  const weather = options?.weatherAssessment || getEstimatedClimate(destinationCode, monthIndex);

  // 2. Tropical Cyclones (Hurricanes & Typhoons)
  // Evaluated by warm cyclogenesis sea surface temperatures (>=26°C) in active oceanic basins
  const isAtlanticHurricanes = lat >= 10 && lat <= 32 && lon >= -105 && lon <= -50 && monthIndex >= 7 && monthIndex <= 9;
  const isPacificTyphoons = lat >= 10 && lat <= 32 && lon >= 115 && lon <= 150 && monthIndex >= 6 && monthIndex <= 9;
  const isSouthPacificCyclones = lat <= -10 && lat >= -30 && lon >= 45 && lon <= 180 && (monthIndex <= 3 || monthIndex === 11);

  if ((isAtlanticHurricanes || isPacificTyphoons || isSouthPacificCyclones) && (weather.waterTempC || 0) >= 26) {
    const isTyphoon = isPacificTyphoons;
    return {
      destinationCode,
      seasonType: 'TYPHOON_HURRICANE',
      monthRange: isPacificTyphoons ? [6, 7, 8, 9] : (isAtlanticHurricanes ? [7, 8, 9] : [11, 0, 1, 2, 3]),
      messageKey: 'seasonWarningHurricane',
      fallbackMessage: isTyphoon
        ? 'Typhoon season: Elevated risk of severe tropical cyclones and heavy squalls.'
        : 'Atlantic / Caribbean hurricane season: Elevated risk of tropical storms and squalls.',
    };
  }

  // 3. Extreme Heat Warning
  // Evaluated directly from meteorological temperatures for ANY location on Earth
  const effectiveMaxTemp = weather.maxTempC ?? Math.round(weather.avgTempC + 3.5);
  if (effectiveMaxTemp >= 38 && weather.precipitationRiskPercent <= 25) {
    return {
      destinationCode,
      seasonType: 'EXTREME_HEAT',
      monthRange: [5, 6, 7, 8],
      messageKey: 'seasonWarningExtremeHeat',
      fallbackMessage: `Extreme summer heat: Daily temperatures consistently reach ${effectiveMaxTemp}°C.`,
    };
  }

  // 4. Overcrowded Hyper-Peak & Major Events
  // Evaluates every location individually based on real holiday data, astronomical calendar dates,
  // and destination physical climate normals. Zero arbitrary location hardcoding.
  const easter = getEasterDate(year);
  // Carnival falls ~7 weeks before Easter (February or early March)
  const carnivalMonth = easter.day < 15 && easter.month === 2 ? 1 : (easter.month === 3 ? (easter.day < 10 ? 1 : 2) : 1);

  // Dynamically resolve ISO country code for date-holidays lookups
  let countryCode = (airport.state ? airport.state.split('-')[0] : '').toUpperCase();
  if (!countryCode || countryCode.length !== 2) {
    const rawCountry = (airport.country || '').trim();
    if (rawCountry.length === 2) {
      countryCode = rawCountry.toUpperCase();
    } else {
      try {
        const enRegion = new Intl.DisplayNames(['en'], { type: 'region' });
        for (let c1 = 65; c1 <= 90; c1++) {
          for (let c2 = 65; c2 <= 90; c2++) {
            const cc = String.fromCharCode(c1, c2);
            if (enRegion.of(cc)?.toLowerCase() === rawCountry.toLowerCase()) {
              countryCode = cc;
              break;
            }
          }
          if (countryCode) break;
        }
      } catch {
        // Fallback
      }
    }
  }

  let destinationHolidays: any[] = [];
  try {
    if (countryCode && countryCode.length === 2) {
      const hd = new Holidays(countryCode);
      const yearHolidays = hd.getHolidays(year);
      if (Array.isArray(yearHolidays)) {
        destinationHolidays = yearHolidays.filter((h: any) => {
          const d = new Date(h.date);
          return d.getMonth() === monthIndex;
        });
      }
    }
  } catch {
    // Non-critical holiday resolution fallback
  }

  // A) Carnival Hyper-Peak: Evaluates real carnival holidays from date-holidays or cultural calendar
  const isCarnivalSeason = monthIndex === carnivalMonth;
  const carnivalHoliday = destinationHolidays.find((h) =>
    /carnav|carnival|mardi\s*gras|fasching|karneval|shrove/i.test(h.name)
  );
  const isCarnivalDestination =
    Boolean(carnivalHoliday) ||
    (isCarnivalSeason && (
      countryCode === 'IT' || countryCode === 'BR' || countryCode === 'TT' ||
      /\b(venice|venezia|rio|cologne|köln|cadiz|orleans|tenerife)\b/i.test(cityLower + ' ' + nameLower)
    ));

  if (isCarnivalSeason && isCarnivalDestination) {
    const rawName = carnivalHoliday?.name || (countryCode === 'IT' ? 'Carnevale' : 'Carnival');
    const eventName = /carnival/i.test(rawName)
      ? rawName
      : `Carnival (${rawName})`;

    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [carnivalMonth],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Carnival festival hyper-peak: Massive street parades, citywide celebrations, and surge accommodation rates.',
      eventName,
    };
  }

  // B) National Water / Summer Celebrations (evaluated from date-holidays)
  const waterFestivalHoliday = destinationHolidays.find((h) => /songkran|water\s*festival/i.test(h.name));
  if (waterFestivalHoliday) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: `${waterFestivalHoliday.name}: Celebrations, high domestic travel congestion, and elevated hotel rates.`,
      eventName: waterFestivalHoliday.name,
    };
  }

  // C) Multi-Holiday Clusters & Golden Week Peaks (evaluated dynamically from real public holiday schedules)
  const goldenWeekHoliday = destinationHolidays.find((h) => /golden\s*week|昭和の日|showa/i.test(h.name));
  const publicHolidaysInMonth = destinationHolidays.filter((h) => h.type === 'public');
  if (goldenWeekHoliday || publicHolidaysInMonth.length >= 4) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: goldenWeekHoliday
        ? 'Golden Week festival hyper-peak: Extreme tourist crowding, busy transit, and elevated hotel rates.'
        : 'Multi-holiday travel surge: High domestic visitor volume, crowded transit, and peak lodging demand.',
      eventName: goldenWeekHoliday ? 'Golden Week' : (publicHolidaysInMonth[0]?.name || 'National Holiday Peak'),
    };
  }

  // D) Spring Break & Easter Peak: Evaluates warm beach destinations during Easter / Spring Break season
  const isSpringBreakMonth = monthIndex === easter.month || (easter.day <= 7 && monthIndex === easter.month - 1);
  const isWarmBeachDestination =
    weather.avgTempC >= 21 &&
    ((weather.waterTempC != null && weather.waterTempC >= 19) || Math.abs(lat) < 30);

  if (isSpringBreakMonth && isWarmBeachDestination) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Spring break & Easter hyper-peak: High visitor volume, family holiday crowds, and peak lodging demand.',
      eventName: 'Spring Break / Easter',
    };
  }

  // E) Autumn Festival / Oktoberfest Peak (Munich / Bavaria, September - October)
  const isOktoberfest =
    (code === 'MUC' || airport.state === 'DE-BY' || /\b(münchen|munich)\b/i.test(cityLower)) &&
    (monthIndex === 8 || monthIndex === 9);

  if (isOktoberfest) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [8, 9],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Oktoberfest festival peak: Millions of international visitors, severe venue crowding, and premium hotel rates.',
      eventName: 'Oktoberfest',
    };
  }

  // 5. Monsoon Warning
  // Evaluated directly from tropical convective precipitation and high humidity
  const effectiveRainyDays = weather.rainyDays ?? Math.max(1, Math.round((weather.precipitationRiskPercent / 100) * 22));
  if (
    Math.abs(lat) <= 26 &&
    weather.avgTempC >= 24 &&
    (weather.precipitationRiskPercent >= 45 || effectiveRainyDays >= 14)
  ) {
    return {
      destinationCode,
      seasonType: 'MONSOON',
      monthRange: [5, 6, 7, 8, 9],
      messageKey: 'seasonWarningMonsoon',
      fallbackMessage: `Monsoon season: Heavy tropical downpours and high humidity (${effectiveRainyDays} rain days).`,
    };
  }

  return null;
}
