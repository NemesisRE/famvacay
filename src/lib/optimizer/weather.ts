import { DestinationType, WeatherAssessment } from './types';

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

export const POPULAR_DESTINATIONS: Record<string, DestinationProfile> = {
  // Beach
  PMI: { code: 'PMI', name: 'Palma de Mallorca', country: 'ES', type: 'BEACH', lat: 39.5517, lon: 2.7388, idealMinTemp: 20, idealMaxTemp: 32, maxAcceptablePrecipRisk: 25 },
  AGP: { code: 'AGP', name: 'Malaga / Costa del Sol', country: 'ES', type: 'BEACH', lat: 36.6749, lon: -4.4991, idealMinTemp: 21, idealMaxTemp: 33, maxAcceptablePrecipRisk: 20 },
  HER: { code: 'HER', name: 'Crete Heraklion', country: 'GR', type: 'BEACH', lat: 35.3397, lon: 25.1803, idealMinTemp: 22, idealMaxTemp: 33, maxAcceptablePrecipRisk: 20 },
  AYT: { code: 'AYT', name: 'Antalya', country: 'TR', type: 'BEACH', lat: 36.8987, lon: 30.8005, idealMinTemp: 22, idealMaxTemp: 35, maxAcceptablePrecipRisk: 25 },
  FAO: { code: 'FAO', name: 'Faro / Algarve', country: 'PT', type: 'BEACH', lat: 37.0144, lon: -7.9659, idealMinTemp: 20, idealMaxTemp: 30, maxAcceptablePrecipRisk: 25 },

  // City
  BCN: { code: 'BCN', name: 'Barcelona', country: 'ES', type: 'CITY', lat: 41.2974, lon: 2.0833, idealMinTemp: 15, idealMaxTemp: 29, maxAcceptablePrecipRisk: 30 },
  FCO: { code: 'FCO', name: 'Rome Fiumicino', country: 'IT', type: 'CITY', lat: 41.8003, lon: 12.2389, idealMinTemp: 14, idealMaxTemp: 31, maxAcceptablePrecipRisk: 35 },
  LIS: { code: 'LIS', name: 'Lisbon Humberto Delgado', country: 'PT', type: 'CITY', lat: 38.7756, lon: -9.1354, idealMinTemp: 16, idealMaxTemp: 28, maxAcceptablePrecipRisk: 30 },
  VIE: { code: 'VIE', name: 'Vienna International', country: 'AT', type: 'CITY', lat: 48.1103, lon: 16.5697, idealMinTemp: 12, idealMaxTemp: 28, maxAcceptablePrecipRisk: 40 },

  // Nature
  KEF: { code: 'KEF', name: 'Reykjavik Keflavik', country: 'IS', type: 'NATURE', lat: 63.9850, lon: -22.6056, idealMinTemp: 5, idealMaxTemp: 18, maxAcceptablePrecipRisk: 50 },
  FNC: { code: 'FNC', name: 'Madeira Funchal', country: 'PT', type: 'NATURE', lat: 32.6997, lon: -16.7744, idealMinTemp: 18, idealMaxTemp: 26, maxAcceptablePrecipRisk: 35 },
  OSL: { code: 'OSL', name: 'Oslo Gardermoen', country: 'NO', type: 'NATURE', lat: 60.1975, lon: 11.1004, idealMinTemp: 10, idealMaxTemp: 24, maxAcceptablePrecipRisk: 45 },

  // Ski
  INN: { code: 'INN', name: 'Innsbruck Airport', country: 'AT', type: 'SKI', lat: 47.2602, lon: 11.3440, idealMinTemp: -8, idealMaxTemp: 4, maxAcceptablePrecipRisk: 50 },
  GVA: { code: 'GVA', name: 'Geneva Airport', country: 'CH', type: 'SKI', lat: 46.2381, lon: 6.1089, idealMinTemp: -5, idealMaxTemp: 6, maxAcceptablePrecipRisk: 50 },

  // Long-haul / International Destinations with Seasonality
  BKK: { code: 'BKK', name: 'Bangkok', country: 'TH', type: 'CITY', lat: 13.6900, lon: 100.7501, idealMinTemp: 24, idealMaxTemp: 34, maxAcceptablePrecipRisk: 35 },
  HND: { code: 'HND', name: 'Tokyo Haneda', country: 'JP', type: 'CITY', lat: 35.5494, lon: 139.7798, idealMinTemp: 10, idealMaxTemp: 28, maxAcceptablePrecipRisk: 35 },
  CUN: { code: 'CUN', name: 'Cancun Riviera Maya', country: 'MX', type: 'BEACH', lat: 21.0365, lon: -86.8771, idealMinTemp: 22, idealMaxTemp: 33, maxAcceptablePrecipRisk: 35 },
  DXB: { code: 'DXB', name: 'Dubai', country: 'AE', type: 'CITY', lat: 25.2532, lon: 55.3657, idealMinTemp: 18, idealMaxTemp: 34, maxAcceptablePrecipRisk: 15 },
  // Additional popular European and beach destinations
  ATH: { code: 'ATH', name: 'Athens', country: 'GR', type: 'CITY', lat: 37.9364, lon: 23.9445, idealMinTemp: 16, idealMaxTemp: 34, maxAcceptablePrecipRisk: 25 },
  HRG: { code: 'HRG', name: 'Hurghada Red Sea', country: 'EG', type: 'BEACH', lat: 27.1783, lon: 33.7994, idealMinTemp: 22, idealMaxTemp: 37, maxAcceptablePrecipRisk: 10 },
  SSH: { code: 'SSH', name: 'Sharm el-Sheikh', country: 'EG', type: 'BEACH', lat: 27.9772, lon: 34.3949, idealMinTemp: 22, idealMaxTemp: 37, maxAcceptablePrecipRisk: 10 },
  TFS: { code: 'TFS', name: 'Tenerife South', country: 'ES', type: 'BEACH', lat: 28.0445, lon: -16.5725, idealMinTemp: 20, idealMaxTemp: 29, maxAcceptablePrecipRisk: 20 },
  LPA: { code: 'LPA', name: 'Gran Canaria', country: 'ES', type: 'BEACH', lat: 27.9319, lon: -15.3866, idealMinTemp: 20, idealMaxTemp: 29, maxAcceptablePrecipRisk: 20 },
  IBZ: { code: 'IBZ', name: 'Ibiza', country: 'ES', type: 'BEACH', lat: 38.8729, lon: 1.3731, idealMinTemp: 20, idealMaxTemp: 32, maxAcceptablePrecipRisk: 25 },
  RHO: { code: 'RHO', name: 'Rhodes', country: 'GR', type: 'BEACH', lat: 36.4054, lon: 28.0862, idealMinTemp: 21, idealMaxTemp: 33, maxAcceptablePrecipRisk: 20 },
  DJE: { code: 'DJE', name: 'Djerba Zarzis', country: 'TN', type: 'BEACH', lat: 33.8750, lon: 10.7753, idealMinTemp: 21, idealMaxTemp: 34, maxAcceptablePrecipRisk: 20 },
  MAD: { code: 'MAD', name: 'Madrid Barajas', country: 'ES', type: 'CITY', lat: 40.4983, lon: -3.5676, idealMinTemp: 14, idealMaxTemp: 32, maxAcceptablePrecipRisk: 30 },
};

export interface SeasonalConstraintWarning {
  destinationCode: string;
  seasonType: 'MONSOON' | 'EXTREME_HEAT' | 'TYPHOON_HURRICANE' | 'OVERCROWDED_PEAK';
  monthRange: number[]; // Months 0-11
  messageKey: string;
  fallbackMessage: string;
}

export const DESTINATION_SEASONAL_CONSTRAINTS: SeasonalConstraintWarning[] = [
  {
    destinationCode: 'BKK',
    seasonType: 'MONSOON',
    monthRange: [5, 6, 7, 8, 9], // June to October
    messageKey: 'seasonWarningMonsoon',
    fallbackMessage: 'Monsoon season: Heavy tropical downpours and high humidity.',
  },
  {
    destinationCode: 'DXB',
    seasonType: 'EXTREME_HEAT',
    monthRange: [5, 6, 7, 8], // June to September
    messageKey: 'seasonWarningExtremeHeat',
    fallbackMessage: 'Extreme summer heat: Daily temperatures consistently exceed 42°C.',
  },
  {
    destinationCode: 'CUN',
    seasonType: 'TYPHOON_HURRICANE',
    monthRange: [7, 8, 9], // August to October
    messageKey: 'seasonWarningHurricane',
    fallbackMessage: 'Atlantic hurricane season: Elevated risk of tropical storms and squalls.',
  },
  {
    destinationCode: 'HND',
    seasonType: 'OVERCROWDED_PEAK',
    monthRange: [2, 3], // Late March to April
    messageKey: 'seasonWarningCrowdedPeak',
    fallbackMessage: 'Cherry blossom hyper-peak: Extreme tourist crowding and elevated hotel rates.',
  },
];

export function getDestinationSeasonalWarning(destinationCode: string, monthIndex: number): SeasonalConstraintWarning | null {
  const found = DESTINATION_SEASONAL_CONSTRAINTS.find(
    (c) => c.destinationCode === destinationCode && c.monthRange.includes(monthIndex)
  );
  return found || null;
}

/**
 * Historical climate model benchmark (used if Open-Meteo is offline / during fast simulation)
 */
export function getEstimatedClimate(
  destinationCode: string,
  monthIndex: number // 0-11
): WeatherAssessment {
  const dest = POPULAR_DESTINATIONS[destinationCode];
  if (!dest) {
    return {
      avgTempC: 22,
      maxTempC: 26,
      minTempC: 17,
      waterTempC: 21,
      rainyDays: 3,
      sunshineHoursPerDay: 9,
      precipitationRiskPercent: 20,
      isSuitable: true,
      reason: 'Pleasant family weather expected.',
    };
  }

  // Base seasonal temperatures based on latitude and destination type
  let tempBase = 20;
  let precipRisk = 20;
  let waterTemp: number | null = null;
  let sunshineHours = 8;

  // Midsummer (June-Aug)
  if (monthIndex >= 5 && monthIndex <= 7) {
    if (dest.type === 'BEACH') {
      tempBase = 27 + (dest.lat < 38 ? 3 : 0);
      precipRisk = 10;
      waterTemp = 24 + (dest.lat < 38 ? 3 : 0);
      sunshineHours = 11;
    } else if (dest.type === 'SKI') {
      tempBase = 18; // Not ski season
      precipRisk = 30;
      sunshineHours = 7;
    } else {
      tempBase = 24;
      precipRisk = 25;
      sunshineHours = 10;
    }
  } 
  // Winter (Dec-Feb)
  else if (monthIndex === 11 || monthIndex <= 1) {
    if (dest.type === 'SKI') {
      tempBase = -2;
      precipRisk = 40;
      sunshineHours = 4;
    } else if (dest.type === 'BEACH') {
      tempBase = dest.lat < 30 ? 20 : 14;
      precipRisk = dest.lat < 30 ? 20 : 40;
      waterTemp = dest.lat < 30 ? 20 : 15;
      sunshineHours = dest.lat < 30 ? 6 : 5;
    } else {
      tempBase = 6;
      precipRisk = 45;
      sunshineHours = 4;
    }
  }
  // Spring / Autumn
  else {
    if (dest.type === 'BEACH') {
      tempBase = 22 + (dest.lat < 38 ? 2 : 0);
      precipRisk = 20;
      waterTemp = 20 + (dest.lat < 38 ? 2 : 0);
      sunshineHours = 8;
    } else if (dest.type === 'SKI') {
      tempBase = 4;
      precipRisk = 35;
      sunshineHours = 5;
    } else {
      tempBase = 18;
      precipRisk = 25;
      sunshineHours = 7;
    }
  }

  const rainyDays = Math.max(1, Math.round((precipRisk / 100) * 15));
  const maxTempC = Math.round(tempBase + 3.5);
  const minTempC = Math.round(tempBase - 4.5);

  const isSuitable =
    tempBase >= dest.idealMinTemp - 4 &&
    tempBase <= dest.idealMaxTemp + 4 &&
    precipRisk <= dest.maxAcceptablePrecipRisk + 15;

  return {
    avgTempC: Math.round(tempBase),
    maxTempC,
    minTempC,
    waterTempC: dest.type === 'BEACH' ? waterTemp : null,
    rainyDays,
    sunshineHoursPerDay: sunshineHours,
    precipitationRiskPercent: precipRisk,
    isSuitable,
    reason: isSuitable
      ? 'Weather is within acceptable comfort bounds for families.'
      : `Temperature (${tempBase}°C) or rain risk (${precipRisk}%) outside ideal family window.`,
  };
}

