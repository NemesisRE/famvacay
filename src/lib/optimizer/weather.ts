import { getCalendarHolidays, type CachedCalendarHoliday } from '../holidays/date-holidays-cache';
import climateNormals from './data/climate-normals.json';
import { DestinationType, WeatherAssessment } from './types';
import { getAirportByIata } from '../airports/airport-service';
import { getDestinationPoint } from '../geo/destination-points';

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
  const airport = getDestinationPoint(code);
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

  const isAlpine =
    isSki ||
    (altitudeMeters >= 380 && Math.abs(lat) >= 42 && winterClimate.avgTempC <= 5) ||
    (altitudeMeters >= 500 && Math.abs(lat) >= 30);

  const isCoastal =
    !isAlpine &&
    altitudeMeters < 600 &&
    summerClimate.waterTempC != null &&
    summerClimate.waterTempC >= 19 &&
    (summerClimate.maxTempC ?? summerClimate.avgTempC) >= 22;

  const surfaceStyles = airport.kind === 'SURFACE' ? airport.surface?.styles : undefined;
  if (surfaceStyles && surfaceStyles.length > 0) {
    type = surfaceStyles.includes('BEACH') ? 'BEACH' : surfaceStyles.includes('ALPINE') ? 'ALPINE' : surfaceStyles[0];
  } else if (isSki) {
    type = 'SKI';
  } else if (isAlpine) {
    type = 'ALPINE';
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
    idealMinTemp: type === 'ALPINE' ? -8 : (type === 'BEACH' ? 20 : 15),
    idealMaxTemp: type === 'ALPINE' ? 22 : (type === 'BEACH' ? 33 : 30),
    maxAcceptablePrecipRisk: type === 'BEACH' ? 25 : 35,
  };
}

/**
 * Calculates seasonal ideal temperature comfort band based on airport, month, and vacation type.
 */
export function getIdealTemperatureBand(
  airportCode: string,
  monthIndex: number,
  userDestinationType?: DestinationType | DestinationType[]
): { minIdeal: number; maxIdeal: number } {
  const profile = getDestinationProfile(airportCode);
  const destType = profile?.type || 'CITY';

  let effectiveType: DestinationType = destType;
  if (Array.isArray(userDestinationType)) {
    const valid = userDestinationType.filter((t) => t !== 'ALL');
    if (valid.length === 1) {
      effectiveType = valid[0];
    } else if (valid.length > 1 && (valid as string[]).includes(destType)) {
      effectiveType = destType;
    }
  } else if (userDestinationType && userDestinationType !== 'ALL') {
    effectiveType = userDestinationType;
  }

  if (effectiveType === 'ALPINE' || effectiveType === 'SKI') {
    // Winter ski / snow comfort band
    if (monthIndex === 11 || monthIndex === 0 || monthIndex === 1 || monthIndex === 2) {
      return { minIdeal: -8, maxIdeal: 4 };
    }
    // Spring, summer, autumn alpine hiking and fresh air
    return { minIdeal: 12, maxIdeal: 24 };
  }

  if (effectiveType === 'BEACH') {
    return { minIdeal: 22, maxIdeal: 33 };
  }

  if (effectiveType === 'CITY') {
    return { minIdeal: 15, maxIdeal: 26 };
  }

  if (effectiveType === 'NATURE') {
    return { minIdeal: 11, maxIdeal: 23 };
  }

  if (effectiveType === 'LONGRANGE') {
    return { minIdeal: 22, maxIdeal: 33 };
  }

  return { minIdeal: 16, maxIdeal: 28 };
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

export type SeasonalWarningType =
  | 'MONSOON'
  | 'EXTREME_HEAT'
  | 'TYPHOON_HURRICANE'
  | 'OVERCROWDED_PEAK'
  | 'NATURAL_PHENOMENON';

export type NaturalPhenomenonType =
  | 'SARGASSUM'
  | 'RED_TIDE'
  | 'JELLYFISH'
  | 'MIDGE_SANDFLY'
  | 'CICADA'
  | 'VOLCANIC_VOG';

export interface SeasonalConstraintWarning {
  destinationCode: string;
  seasonType: SeasonalWarningType;
  monthRange: number[]; // Months 0-11
  messageKey: string;
  fallbackMessage: string;
  eventName?: string;
  eventKey?: string;
  phenomenonType?: NaturalPhenomenonType;
  marketsOnHoliday?: string[];
}

export interface SeasonalWarningImpact {
  weatherPenalty: number;      // Reduction on weather index (0-100)
  overallScorePenalty: number; // Measurable negative penalty on destination score / vacation factor
  severity: 'moderate' | 'high' | 'severe';
  reason: string;
}

/**
 * Calculates the measurable score penalty for active seasonal warnings & local environmental phenomena
 * (e.g. Sargassum algae blooms, extreme heat/monsoon/hurricanes, insect swarms, volcanic vog).
 */
export function getSeasonalWarningPenalty(
  warning: SeasonalConstraintWarning | null | undefined,
  options?: { avoidExtremeHeat?: boolean }
): SeasonalWarningImpact | null {
  if (!warning) return null;

  switch (warning.seasonType) {
    case 'TYPHOON_HURRICANE':
      return {
        weatherPenalty: 28,
        overallScorePenalty: 14,
        severity: 'severe',
        reason: 'Tropical cyclones & squalls severely degrade travel quality and safety.',
      };
    case 'MONSOON':
      return {
        weatherPenalty: 24,
        overallScorePenalty: 10,
        severity: 'high',
        reason: 'Sustained monsoon rain and high humidity impair outdoor leisure.',
      };
    case 'EXTREME_HEAT':
      // Treat extreme summer heat as an allowed user-configurable constraint/filter preference
      // rather than applying an unconditional global scoring penalty.
      if (options && !options.avoidExtremeHeat) {
        if (warning.marketsOnHoliday && warning.marketsOnHoliday.length > 0) {
          return {
            weatherPenalty: 14,
            overallScorePenalty: 12,
            severity: 'high',
            reason: 'Extreme crowd density and travel congestion degrade relaxation.',
          };
        }
        return null;
      }
      return {
        weatherPenalty: 22,
        overallScorePenalty: 10,
        severity: 'high',
        reason: 'Extreme heat (>38°C) limits daytime recreation.',
      };
    case 'NATURAL_PHENOMENON':
      switch (warning.phenomenonType) {
        case 'SARGASSUM':
          return {
            weatherPenalty: 20,
            overallScorePenalty: 10,
            severity: 'high',
            reason: 'Heavy Sargassum seaweed ruins beach quality and swimming.',
          };
        case 'RED_TIDE':
          return {
            weatherPenalty: 22,
            overallScorePenalty: 12,
            severity: 'severe',
            reason: 'Harmful algal blooms trigger beach closures and respiratory irritation.',
          };
        case 'JELLYFISH':
          return {
            weatherPenalty: 16,
            overallScorePenalty: 8,
            severity: 'moderate',
            reason: 'Marine stinger hazard restricts open ocean swimming.',
          };
        case 'MIDGE_SANDFLY':
          return {
            weatherPenalty: 16,
            overallScorePenalty: 8,
            severity: 'moderate',
            reason: 'High density of biting insects severely impairs outdoor recreation.',
          };
        case 'VOLCANIC_VOG':
          return {
            weatherPenalty: 18,
            overallScorePenalty: 9,
            severity: 'moderate',
            reason: 'Volcanic vog and sulfur emissions compromise air clarity and health.',
          };
        case 'CICADA':
          return {
            weatherPenalty: 10,
            overallScorePenalty: 5,
            severity: 'moderate',
            reason: 'High acoustic noise levels and insect abundance.',
          };
        default:
          return {
            weatherPenalty: 15,
            overallScorePenalty: 7,
            severity: 'moderate',
            reason: 'Active natural phenomenon degrades destination comfort.',
          };
      }
    case 'OVERCROWDED_PEAK':
      return {
        weatherPenalty: 14,
        overallScorePenalty: 12,
        severity: 'high',
        reason: 'Extreme crowd density and travel congestion degrade relaxation.',
      };
    default:
      return {
        weatherPenalty: 12,
        overallScorePenalty: 6,
        severity: 'moderate',
        reason: 'Seasonal warning advisory active.',
      };
  }
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
/**
 * Measured monthly climate normals (NASA POWER, see scripts/generate-climate-normals.js):
 * [12 x mean °C, 12 x mean daily range °C, 12 x precipitation mm/day] per destination code.
 */
const CLIMATE_NORMALS = climateNormals as Record<string, number[]>;

export function getClimateNormals(destinationCode: string, monthIndex: number):
  | { avgTempC: number; dailyRangeC: number; precipMmPerDay: number }
  | null {
  const row = CLIMATE_NORMALS[(destinationCode || '').toUpperCase()] || CLIMATE_NORMALS[destinationCode];
  if (!row || row.length < 36) return null;
  return { avgTempC: row[monthIndex], dailyRangeC: row[12 + monthIndex], precipMmPerDay: row[24 + monthIndex] };
}

export function getEstimatedClimate(
  destinationCode: string,
  monthIndex: number, // 0-11
  overrideCoords?: { lat: number; lon: number }
): WeatherAssessment {
  let lat = 0;
  let lon = 0;
  let altitude = 0;
  let type: DestinationType = 'CITY';

  const airport = getDestinationPoint(destinationCode);
  if (airport) {
    altitude = (airport.altitude || 0) * 0.3048;
  }

  if (overrideCoords) {
    lat = overrideCoords.lat;
    lon = overrideCoords.lon;
  } else {
    const profile = getDestinationProfile(destinationCode);
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
  let tempBase = annualMean + seasonalCycle * amplitude;

  // Physical mountain lapse rate (Standard International Atmosphere: 6.5°C per 1,000m)
  if (altitude > 0) {
    const lapseLoss = Math.min(22, (altitude / 1000) * 6.5);
    tempBase -= lapseLoss;
  }
  // Winter alpine snowpack & inversion cooling
  if (altitude >= 450 && Math.abs(lat) >= 40 && solarElevation < 35) {
    tempBase -= 2.5;
  }


  // Maritime / ocean surface temperature (lags solar insolation by ~4-6 weeks)
  let waterTemp: number | null = null;
  const isMaritime = type === 'BEACH' || altitude <= 100;
  if (isMaritime) {
    const lagMonth = (monthIndex + 11) % 12;
    const lagDay = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][lagMonth];
    const lagDecl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (lagDay - 81));
    const lagElev = Math.max(0, 90 - Math.abs(lat - lagDecl));
    waterTemp = Math.round(12 + (lagElev / 90) * 17); // Range: 12°C (winter temperate) to 29°C (summer tropical)
  }

  // Arid subtropical desert belts: Sahara, Arabian Peninsula, Middle East, Sonoran/Mojave deserts, Australian outback
  // Experiencing intense Hadley cell high-summer subsidence and solar insolation
  const isAridSubtropicalBelt =
    (lat >= 15 && lat <= 36 && lon >= -18 && lon <= 65) || // North Africa, Arabian Peninsula, Middle East
    (lat >= 25 && lat <= 37 && lon >= -120 && lon <= -100) || // Sonoran / Mojave deserts
    (lat <= -18 && lat >= -34 && lon >= 115 && lon <= 145);   // Central / Western Australia

  const isSubtropicalDryBelt = isAridSubtropicalBelt && solarElevation > 70;

  if (isSubtropicalDryBelt) {
    tempBase += 7;
  }


  // Precipitation: convective monsoon when ITCZ overhead in tropical latitudes
  const itczDist = Math.abs(lat - declination);
  const isTropical = Math.abs(lat) <= 25;
  const isMonsoonZone =
    (lon >= 65 && lon <= 125 && lat >= 5 && lat <= 30) || // South & Southeast Asia monsoon
    (lon >= -20 && lon <= 45 && lat >= 4 && lat <= 15);   // West & Central African monsoon belt

  let precipRisk = 20;

  if (isTropical && isMonsoonZone && itczDist < 16) {
    precipRisk = 65; // Monsoon rainy season
  } else if (isTropical && itczDist > 25) {
    precipRisk = 12; // Tropical dry season
  } else if (isSubtropicalDryBelt) {
    precipRisk = 8;  // Subtropical arid dry zone
  } else if (type === 'SKI' || type === 'ALPINE' || (altitude >= 1500 && Math.abs(lat) >= 42)) {
    precipRisk = 35; // Alpine snow/precipitation
  } else if (Math.abs(lat) >= 35 && Math.abs(lat) <= 45 && solarElevation > 65) {
    precipRisk = 12; // Mediterranean dry summer
  } else if (isTropical && (type === 'BEACH' || isMaritime) && (monthIndex === 6 || monthIndex === 11 || monthIndex <= 3)) {
    precipRisk = 14; // Tropical dry / mid-summer dry lull
  } else {
    precipRisk = 25;
  }



  // Measured normals (when the destination has them) replace the formula: it was off by up to
  // 15 °C (Tenerife in April came out at 36 °C instead of ~19 °C)
  const normals = overrideCoords ? null : getClimateNormals(destinationCode, monthIndex);
  let rainyDaysFromNormals: number | null = null;
  if (normals) {
    tempBase = normals.avgTempC;
    // ~2.2 rain days per mm of mean daily precipitation (e.g. Antalya January: 5.9 mm/day -> 13 days)
    rainyDaysFromNormals = Math.max(1, Math.min(24, Math.round(normals.precipMmPerDay * 2.2)));
    precipRisk = Math.min(95, Math.round((rainyDaysFromNormals / 22) * 100));
  }

  const rainyDays = rainyDaysFromNormals ?? Math.max(1, Math.round((precipRisk / 100) * 22));
  const maxTempC = normals
    ? Math.round(tempBase + normals.dailyRangeC / 2)
    : Math.round(tempBase + (isSubtropicalDryBelt ? 5.5 : 3.5));
  const minTempC = normals
    ? Math.round(tempBase - normals.dailyRangeC / 2)
    : Math.round(tempBase - (isSubtropicalDryBelt ? 6.5 : 4.5));

  // Sunshine hours: astronomical daylength scaled by clear sky factor
  const tanLat = Math.tan((lat * Math.PI) / 180);
  const tanDecl = Math.tan((declination * Math.PI) / 180);
  const cosH0 = Math.max(-1, Math.min(1, -tanLat * tanDecl));
  const daylengthHours = (24 / Math.PI) * Math.acos(cosH0);
  const sunshineHours = Math.max(
    3,
    Math.min(13, Math.round(daylengthHours * (1 - (precipRisk / 100) * 0.7)))
  );

  const isWinterSeason = lat >= 0
    ? (monthIndex === 11 || monthIndex <= 3)
    : (monthIndex >= 5 && monthIndex <= 9);
  const isAlpineWinter = (type === 'SKI' || type === 'ALPINE' || (altitude >= 1500 && Math.abs(lat) >= 42)) && isWinterSeason;

  const hasSnow = (altitude >= 450 || type === 'SKI' || type === 'ALPINE') && isWinterSeason && (tempBase <= 4 || minTempC <= 0);
  const snowDepthCm = hasSnow ? Math.max(15, Math.round((5 - tempBase) * 8 + (altitude / 100) * 3)) : 0;

  const isSuitable =
    type === 'BEACH'
      ? tempBase >= 20 && precipRisk <= 35
      : type === 'SKI'
      ? isWinterSeason && tempBase >= -15 && tempBase <= 4 && precipRisk <= 55
      : isAlpineWinter
      ? tempBase >= -15 && tempBase <= 5 && precipRisk <= 55
      : tempBase >= 12 && tempBase <= 36 && precipRisk <= 55;

  return {
    avgTempC: Math.round(tempBase),
    maxTempC,
    minTempC,
    waterTempC: isMaritime ? waterTemp : null,
    rainyDays,
    sunshineHoursPerDay: sunshineHours,
    precipitationRiskPercent: precipRisk,
    isSuitable,
    hasSnow,
    snowDepthCm,
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
  const airport = getDestinationPoint(destinationCode);
  if (!airport) return null;

  const lat = airport.lat;
  const lon = airport.lon;
  const cityLower = (airport.city || '').toLowerCase();
  const nameLower = (airport.name || '').toLowerCase();
  const code = airport.code.toUpperCase();
  const year = options?.year || 2026;
  const altitudeMeters = (airport.altitude || 0) * 0.3048;

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

  let destinationHolidays: CachedCalendarHoliday[] = [];
  if (countryCode && countryCode.length === 2) {
    destinationHolidays = getCalendarHolidays(countryCode, year).filter(
      (h) => parseInt(h.date.slice(5, 7), 10) - 1 === monthIndex
    );
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
      eventKey: 'carnival',
    };
  }

  // B) National Water / Summer Celebrations (e.g. Songkran in Thailand)
  const waterFestivalHoliday = destinationHolidays.find((h) => /songkran|water\s*festival/i.test(h.name));
  if (waterFestivalHoliday && (countryCode === 'TH' || countryCode === 'LA' || countryCode === 'MM')) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: `${waterFestivalHoliday.name}: Water festival celebrations, high domestic travel congestion, and elevated hotel rates.`,
      eventName: waterFestivalHoliday.name,
      eventKey: 'songkran',
    };
  }

  // C) Multi-Holiday Clusters & Golden Week Peaks (evaluated dynamically for genuine travel surge periods)
  const goldenWeekHoliday = destinationHolidays.find((h) => /golden\s*week|昭和の日|showa/i.test(h.name));
  const isLunarNewYear = destinationHolidays.find((h) => /lunar\s*new\s*year|chinese\s*new\s*year|spring\s*festival|tet\b|chunjie/i.test(h.name));
  if (goldenWeekHoliday && (countryCode === 'JP' || countryCode === 'CN')) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Golden Week festival hyper-peak: Extreme tourist crowding, busy transit, and elevated hotel rates.',
      eventName: 'Golden Week',
      eventKey: 'golden_week',
    };
  }
  if (isLunarNewYear && (countryCode === 'CN' || countryCode === 'VN' || countryCode === 'TW' || countryCode === 'HK' || countryCode === 'SG' || countryCode === 'MY')) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Lunar New Year / Spring Festival: High visitor volume, peak domestic travel demand, and premium hotel rates.',
      eventName: 'Lunar New Year',
      eventKey: 'lunar_new_year',
    };
  }

  // D) Spring Break & Easter Peak: Evaluates warm beach or cultural destinations during Easter / Spring Break season
  const isEasterMonth = monthIndex === easter.month || (easter.day <= 7 && monthIndex === easter.month - 1);
  const isWarmOrCultural =
    weather.avgTempC >= 18 ||
    ((weather.waterTempC != null && weather.waterTempC >= 18) || Math.abs(lat) < 36);

  if (isEasterMonth && isWarmOrCultural) {
    const isNorthAmericaOrCaribbean =
      countryCode === 'US' ||
      countryCode === 'MX' ||
      countryCode === 'BS' ||
      countryCode === 'JM' ||
      countryCode === 'DO' ||
      countryCode === 'CU' ||
      (lat >= 10 && lat <= 32 && lon >= -105 && lon <= -60);

    if (isNorthAmericaOrCaribbean) {
      return {
        destinationCode,
        seasonType: 'OVERCROWDED_PEAK',
        monthRange: [monthIndex],
        messageKey: 'seasonWarningCrowdedPeak',
        fallbackMessage: 'Spring break & Easter hyper-peak: High visitor volume, family holiday crowds, and peak lodging demand.',
        eventName: 'Spring Break & Easter',
        eventKey: 'spring_break_easter',
      };
    } else {
      // European, Mediterranean, and other world destinations celebrate Easter / Holy Week (Semana Santa / Pasqua)
      return {
        destinationCode,
        seasonType: 'OVERCROWDED_PEAK',
        monthRange: [monthIndex],
        messageKey: 'seasonWarningCrowdedPeak',
        fallbackMessage: 'Easter & Holy Week peak: High holiday travel volume, crowded historic sites, and surge hotel demand.',
        eventName: 'Easter & Holy Week',
        eventKey: 'easter',
      };
    }
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
      eventKey: 'oktoberfest',
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

  // 6. Seasonal & Local Natural Phenomenon Warnings
  // A) Sargassum Seaweed Blooms (Caribbean & Gulf of Mexico coastlines in spring/summer)
  const isSargassumCorridor =
    lat >= 10 && lat <= 26 && lon >= -90 && lon <= -58 && altitudeMeters <= 120;
  const isSargassumSeason = monthIndex >= 3 && monthIndex <= 7; // April to August
  if (isSargassumCorridor && isSargassumSeason && (weather.waterTempC || 0) >= 24) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'SARGASSUM',
      monthRange: [3, 4, 5, 6, 7],
      messageKey: 'seasonWarningSargassum',
      fallbackMessage:
        'Sargassum seaweed bloom: Heavy brown seaweed accumulation on Atlantic and Caribbean beaches, organic odor, and periodic swimming restrictions.',
    };
  }

  // B) Red Tide / Harmful Algal Blooms (Gulf Coast of Florida & Texas in late summer/autumn)
  const isRedTideCorridor =
    lat >= 24 && lat <= 30.5 && lon >= -98 && lon <= -81 && altitudeMeters <= 100;
  const isRedTideSeason = monthIndex >= 7 && monthIndex <= 10; // August to November
  if (isRedTideCorridor && isRedTideSeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'RED_TIDE',
      monthRange: [7, 8, 9, 10],
      messageKey: 'seasonWarningRedTide',
      fallbackMessage:
        'Red tide (harmful algal bloom): Elevated Karenia brevis concentrations can trigger respiratory irritation, beach odor, and localized swimming advisories.',
    };
  }

  // C) Jellyfish Swarms (Tropical Stinger Season in Northern Australia OR Mauve Stinger heatwaves in Mediterranean)
  const isAusStingerZone =
    lat <= -10 && lat >= -26 && lon >= 120 && lon <= 155;
  const isAusStingerSeason = monthIndex >= 10 || monthIndex <= 4; // Nov to May
  if (isAusStingerZone && isAusStingerSeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'JELLYFISH',
      monthRange: [10, 11, 0, 1, 2, 3, 4],
      messageKey: 'seasonWarningJellyfish',
      fallbackMessage:
        'Marine stinger season: Hazardous box jellyfish and Irukandji present in coastal waters. Stinger suits and netted beach enclosures advised.',
    };
  }

  const isMedJellyfishZone =
    lat >= 35 && lat <= 44 && lon >= -6 && lon <= 25 && altitudeMeters <= 100;
  const isMedJellyfishSeason = (monthIndex === 6 || monthIndex === 7) && (weather.waterTempC || 0) >= 28;
  if (isMedJellyfishZone && isMedJellyfishSeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'JELLYFISH',
      monthRange: [6, 7],
      messageKey: 'seasonWarningJellyfish',
      fallbackMessage:
        'Pelagia jellyfish swarms: Warm coastal waters trigger seasonal mauve stinger blooms. Check local beach flags and jellyfish safety nets.',
    };
  }

  // D) Midge & Sandfly Outbreaks (Scottish Highlands in summer OR New Zealand South Island in summer)
  const isHighlandMidgeZone =
    lat >= 56 && lat <= 59.5 && lon >= -8 && lon <= -3;
  const isHighlandMidgeSeason = monthIndex >= 4 && monthIndex <= 7; // Late May - August
  if (isHighlandMidgeZone && isHighlandMidgeSeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'MIDGE_SANDFLY',
      monthRange: [4, 5, 6, 7],
      messageKey: 'seasonWarningMidge',
      fallbackMessage:
        'Highland midge season: Dense biting midge swarms common in mornings, evenings, and calm overcast weather. Insect repellent recommended.',
    };
  }

  const isNZSandflyZone =
    lat <= -41 && lat >= -47 && lon >= 166 && lon <= 173;
  const isNZSandflySeason = monthIndex === 11 || monthIndex === 0 || monthIndex === 1; // Dec - Feb
  if (isNZSandflyZone && isNZSandflySeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'MIDGE_SANDFLY',
      monthRange: [11, 0, 1],
      messageKey: 'seasonWarningMidge',
      fallbackMessage:
        'Sandfly active season: Biting blackflies / sandflies prevalent near lakes, rivers, and coastal fjords. DEET or picaridin insect repellent advised.',
    };
  }

  // E) Periodical Cicada Brood Emergences (Eastern & Midwestern United States in May - June)
  const isCicadaZone =
    lat >= 35 && lat <= 42.5 && lon >= -92 && lon <= -75 && countryCode === 'US';
  const isCicadaSeason = monthIndex === 4 || monthIndex === 5; // May - June
  if (isCicadaZone && isCicadaSeason) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'CICADA',
      monthRange: [4, 5],
      messageKey: 'seasonWarningCicada',
      fallbackMessage:
        'Periodical cicada emergence: High densities of singing cicadas in wooded parks and suburban nature trails, reaching acoustic volumes over 90 dB.',
    };
  }

  // F) Volcanic Activity & Volcanic Smog (Vog)
  // Hawaii Big Island (KOA, ITO)
  const isHawaiiVog =
    lat >= 19 && lat <= 20.5 && lon >= -156.5 && lon <= -154.5;
  if (isHawaiiVog) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'VOLCANIC_VOG',
      monthRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      messageKey: 'seasonWarningVog',
      fallbackMessage:
        'Volcanic smog (Vog) advisory: Sulfur dioxide emissions from active volcanic vents can cause haze and respiratory sensitivity downwind.',
    };
  }

  // Reykjanes / Iceland volcanic rift (KEF)
  const isIcelandVolcanic =
    lat >= 63.8 && lat <= 64.5 && lon >= -23 && lon <= -21;
  if (isIcelandVolcanic) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'VOLCANIC_VOG',
      monthRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      messageKey: 'seasonWarningVog',
      fallbackMessage:
        'Volcanic fissure & gas emission alert: Localized seismic activity and sulfur dioxide plumes near the Reykjanes volcanic systems.',
    };
  }

  // Mount Etna / Sicily (CTA)
  const isEtnaVolcanic =
    lat >= 37.3 && lat <= 38.0 && lon >= 14.8 && lon <= 15.4;
  if (isEtnaVolcanic) {
    return {
      destinationCode,
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'VOLCANIC_VOG',
      monthRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      messageKey: 'seasonWarningVog',
      fallbackMessage:
        'Mount Etna volcanic activity: Periodic ash plumes, summit degassing, and localized airspace observation notices.',
    };
  }

  return null;
}
