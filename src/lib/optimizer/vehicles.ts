import { TravelVehicle, VehicleTravelMetrics } from './types';
import { getAirportByIata } from '../airports/airport-service';

/**
 * Standard ISO 3166-1 alpha-2 country codes mapped to geographical continents.
 * EU = Europe, NA = North America, SA = South America, AF = Africa, AS = Asia, OC = Oceania.
 */
const COUNTRY_TO_CONTINENT: Record<string, 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC'> = {
  // Europe
  DE: 'EU', AT: 'EU', CH: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', PT: 'EU', NL: 'EU', BE: 'EU', LU: 'EU',
  CZ: 'EU', PL: 'EU', SK: 'EU', HU: 'EU', SI: 'EU', HR: 'EU', BA: 'EU', RS: 'EU', ME: 'EU', MK: 'EU',
  AL: 'EU', GR: 'EU', BG: 'EU', RO: 'EU', MD: 'EU', UA: 'EU', BY: 'EU', LT: 'EU', LV: 'EU', EE: 'EU',
  FI: 'EU', SE: 'EU', NO: 'EU', DK: 'EU', GB: 'EU', IE: 'EU', IS: 'EU', MT: 'EU', CY: 'EU', LI: 'EU',
  MC: 'EU', AD: 'EU', SM: 'EU', VA: 'EU', XK: 'EU', TR: 'EU',

  // North America
  US: 'NA', CA: 'NA', MX: 'NA', GL: 'NA', BM: 'NA', GT: 'NA', BZ: 'NA', SV: 'NA', HN: 'NA', NI: 'NA',
  CR: 'NA', PA: 'NA', BS: 'NA', CU: 'NA', JM: 'NA', HT: 'NA', DO: 'NA', PR: 'NA', TT: 'NA', BB: 'NA',
  AW: 'NA', CW: 'NA', SX: 'NA', AG: 'NA', DM: 'NA', GD: 'NA', KN: 'NA', LC: 'NA', VC: 'NA', KY: 'NA',
  TC: 'NA', VG: 'NA', VI: 'NA', AI: 'NA', MS: 'NA', GP: 'NA', MQ: 'NA', BL: 'NA', MF: 'NA', BQ: 'NA',

  // South America
  BR: 'SA', AR: 'SA', CL: 'SA', CO: 'SA', PE: 'SA', EC: 'SA', VE: 'SA', UY: 'SA', PY: 'SA', BO: 'SA',
  GY: 'SA', SR: 'SA', GF: 'SA', FK: 'SA',

  // Oceania
  AU: 'OC', NZ: 'OC', FJ: 'OC', PG: 'OC', SB: 'OC', VU: 'OC', NC: 'OC', PF: 'OC', WS: 'OC', TO: 'OC',
  FM: 'OC', GU: 'OC', KI: 'OC', MH: 'OC', MP: 'OC', NR: 'OC', PW: 'OC', TV: 'OC', CK: 'OC', NU: 'OC',

  // Asia
  CN: 'AS', JP: 'AS', KR: 'AS', IN: 'AS', TH: 'AS', VN: 'AS', ID: 'AS', MY: 'AS', SG: 'AS', PH: 'AS',
  AE: 'AS', SA: 'AS', QA: 'AS', OM: 'AS', KW: 'AS', BH: 'AS', IL: 'AS', JO: 'AS', LB: 'AS', IR: 'AS',
  IQ: 'AS', PK: 'AS', BD: 'AS', LK: 'AS', NP: 'AS', MV: 'AS', KH: 'AS', LA: 'AS', MM: 'AS', TW: 'AS',
  HK: 'AS', MO: 'AS', KZ: 'AS', UZ: 'AS', GE: 'AS', AM: 'AS', AZ: 'AS',

  // Africa
  EG: 'AF', ZA: 'AF', MA: 'AF', TN: 'AF', DZ: 'AF', NG: 'AF', KE: 'AF', ET: 'AF', GH: 'AF', CI: 'AF',
  SN: 'AF', UG: 'AF', TZ: 'AF', NA: 'AF', BW: 'AF', ZM: 'AF', ZW: 'AF', AO: 'AF', MZ: 'AF', MG: 'AF',
  MU: 'AF', SC: 'AF', CV: 'AF', RW: 'AF', CM: 'AF',
};

/**
 * Isolated island territories that cannot be reached overland by car, train, or bus from the mainland.
 */
const ISLAND_SUBDIVISIONS = new Set([
  'ES-CN', // Canary Islands (Tenerife, Gran Canaria, etc.)
  'ES-IB', // Balearic Islands (Mallorca, Ibiza, Menorca)
  'PT-20', // Azores
  'PT-30', // Madeira
  'FR-20', 'FR-COR', 'FR-2A', 'FR-2B', // Corsica
  'IT-82', 'IT-SIC', // Sicily
  'IT-88', 'IT-SAR', // Sardinia
  'US-HI', // Hawaii
  'AU-TAS', // Tasmania
]);

/**
 * Island nations with no road or rail bridges to continental mainland.
 */
const ISLAND_NATIONS = new Set([
  'CY', 'MT', 'IS', 'BS', 'JM', 'CU', 'DO', 'HT', 'BB', 'AG', 'LC', 'GD', 'TT', 'KN', 'DM', 'VC',
  'AW', 'CW', 'SX', 'MV', 'SC', 'MU', 'CV', 'FJ', 'VU', 'WS', 'TO', 'CK', 'NZ', 'MG', 'TW', 'PH',
  'ID', 'JP', 'LK',
]);

/**
 * Greek island airport codes disconnected from mainland road/rail network.
 */
const GREEK_ISLAND_AIRPORTS = new Set([
  'HER', 'CHQ', // Crete
  'RHO',        // Rhodes
  'CFU',        // Corfu
  'KGS',        // Kos
  'JTR',        // Santorini
  'JMK',        // Mykonos
  'ZTH',        // Zakynthos
  'MJT',        // Lesbos / Mytilene
  'JKH',        // Chios
  'SMI',        // Samos
  'AOK',        // Karpathos
  'JSI',        // Skiathos
  'LXS',        // Lemnos
  'EFL',        // Kefalonia
]);

export interface OriginGeoPoint {
  lat: number;
  lon: number;
  countryCode?: string;
  state?: string;
}

export interface DestinationGeoPoint {
  lat: number;
  lon: number;
  countryCode?: string;
  state?: string;
  code?: string;
  isHighSpeedRailConnected?: boolean;
}

/**
 * Determines whether the destination is overland-reachable by road or rail from the origin.
 * Evaluates continent boundaries, contiguous landmasses, island separations, and underwater tunnels (e.g. Eurotunnel).
 */
export function isOverlandReachable(
  origin: OriginGeoPoint,
  destination: DestinationGeoPoint
): boolean {
  const oCountry = (origin.countryCode || (origin.state ? origin.state.split('-')[0] : '')).toUpperCase();
  const dCountry = (destination.countryCode || (destination.state ? destination.state.split('-')[0] : '')).toUpperCase();

  // If destination is in an island nation (e.g. Cyprus, Malta, Iceland, Bahamas), cannot reach overland
  if (ISLAND_NATIONS.has(dCountry) && oCountry !== dCountry) {
    return false;
  }

  // Island subdivisions (Canaries, Balearics, Madeira, Azores, Corsica, Sardinia, Hawaii, Tasmania)
  if (destination.state && ISLAND_SUBDIVISIONS.has(destination.state)) {
    // Cannot reach island from mainland overland
    if (origin.state !== destination.state) {
      return false;
    }
  }

  // If origin is on an island, cannot reach other subdivisions or mainland overland
  if (origin.state && ISLAND_SUBDIVISIONS.has(origin.state)) {
    if (origin.state !== destination.state) {
      return false;
    }
  }

  // Greek islands check
  if (dCountry === 'GR' && destination.code && GREEK_ISLAND_AIRPORTS.has(destination.code.toUpperCase())) {
    return false;
  }

  // Continent check
  const oContinent = COUNTRY_TO_CONTINENT[oCountry];
  const dContinent = COUNTRY_TO_CONTINENT[dCountry];

  if (oContinent && dContinent && oContinent !== dContinent) {
    return false; // Intercontinental travel requires air or ocean cruise
  }

  // Great Britain to continental Europe is connected by the Eurotunnel (Chunnel)
  // Both car shuttle (Le Shuttle) and high-speed rail (Eurostar) run directly
  const isGBToContinentalEurope =
    (oCountry === 'GB' && ['FR', 'BE', 'NL', 'DE', 'CH', 'LU'].includes(dCountry)) ||
    (dCountry === 'GB' && ['FR', 'BE', 'NL', 'DE', 'CH', 'LU'].includes(oCountry));

  if (oCountry === 'GB' && dCountry !== 'GB' && !isGBToContinentalEurope) {
    return false;
  }
  if (dCountry === 'GB' && oCountry !== 'GB' && !isGBToContinentalEurope) {
    return false;
  }

  // Ireland / Northern Ireland to continental Europe or GB requires sea ferry
  if ((oCountry === 'IE' || origin.state === 'GB-NIR') && dCountry !== 'IE' && destination.state !== 'GB-NIR') {
    return false;
  }
  if ((dCountry === 'IE' || destination.state === 'GB-NIR') && oCountry !== 'IE' && origin.state !== 'GB-NIR') {
    return false;
  }

  return true;
}

/**
 * Calculates which travel vehicles are viable for a journey.
 */
export function getAvailableVehicles(
  origin: OriginGeoPoint,
  destination: DestinationGeoPoint,
  geodesicDistanceKm: number
): TravelVehicle[] {
  const available: TravelVehicle[] = [];

  // Plane: Valid for commercial corridors >= 180 km
  if (geodesicDistanceKm >= 180) {
    available.push('PLANE');
  }

  const overland = isOverlandReachable(origin, destination);

  if (overland) {
    // Car / Camper: Feasible up to 1,200 km overland for family vacation
    if (geodesicDistanceKm <= 1200) {
      available.push('CAR');
    }

    // Train: Up to 900 km, or 1,200 km if high-speed rail connected
    const trainLimit = destination.isHighSpeedRailConnected ? 1200 : 900;
    if (geodesicDistanceKm <= trainLimit) {
      available.push('TRAIN');
    }

    // Bus: Feasible up to 750 km overland
    if (geodesicDistanceKm <= 750) {
      available.push('BUS');
    }
  }

  // If no other vehicle was added (e.g. very short hops under 180 km), ensure at least CAR is available if overland
  if (available.length === 0) {
    if (overland) {
      available.push('CAR');
    } else {
      available.push('PLANE');
    }
  }

  return available;
}

/**
 * Computes realistic travel duration, route distance, round-trip travel costs, and CO2 emissions
 * for a specific vehicle.
 */
export function calculateVehicleMetrics(
  vehicle: TravelVehicle,
  geodesicDistanceKm: number,
  passengerMultiplier: number = 1.0,
  isHighSpeedRail: boolean = false
): VehicleTravelMetrics {
  switch (vehicle) {
    case 'CAR': {
      // Actual driving distance is ~25% longer than geodesic line
      const roadDistanceKm = Math.round(geodesicDistanceKm * 1.25);
      // Realistic family driving speed ~88 km/h on motorways with rest stops (+45 mins)
      const durationMinutes = Math.round((roadDistanceKm / 88) * 60 + 45);
      // Round-trip fuel + wear (~0.20 €/km) + vignettes/tolls (~45 € if dist > 250km)
      // Car cost is per vehicle (for the whole family!)
      const roundTripDist = roadDistanceKm * 2;
      const tolls = geodesicDistanceKm > 250 ? 45 : 0;
      const estimatedTravelCost = Math.round(roundTripDist * 0.20 + tolls);
      const co2KgEstimate = Math.round(roundTripDist * 0.14);

      return {
        vehicle: 'CAR',
        durationMinutes,
        distanceKm: roadDistanceKm,
        estimatedTravelCost,
        isOverlandReachable: true,
        co2KgEstimate,
      };
    }

    case 'TRAIN': {
      const railDistanceKm = Math.round(geodesicDistanceKm * 1.15);
      const durationMinutes = isHighSpeedRail
        ? Math.round((geodesicDistanceKm / 160) * 60 + 30)
        : Math.round((geodesicDistanceKm / 100) * 60 + 45);
      // Train fares scale by passenger multiplier with family discounts
      const adultRoundTripFare = Math.round(60 + geodesicDistanceKm * 0.12);
      const estimatedTravelCost = Math.round(adultRoundTripFare * passengerMultiplier);
      const co2KgEstimate = Math.round(railDistanceKm * 2 * 0.03);

      return {
        vehicle: 'TRAIN',
        durationMinutes,
        distanceKm: railDistanceKm,
        estimatedTravelCost,
        isOverlandReachable: true,
        co2KgEstimate,
      };
    }

    case 'BUS': {
      const busDistanceKm = Math.round(geodesicDistanceKm * 1.25);
      // Coach speed ~72 km/h plus scheduled stops
      const durationMinutes = Math.round((busDistanceKm / 72) * 60 + 60);
      const adultRoundTripFare = Math.round(35 + geodesicDistanceKm * 0.08);
      const estimatedTravelCost = Math.round(adultRoundTripFare * passengerMultiplier);
      const co2KgEstimate = Math.round(busDistanceKm * 2 * 0.04);

      return {
        vehicle: 'BUS',
        durationMinutes,
        distanceKm: busDistanceKm,
        estimatedTravelCost,
        isOverlandReachable: true,
        co2KgEstimate,
      };
    }

    case 'PLANE':
    default: {
      const flightDurationMinutes = Math.round(35 + (geodesicDistanceKm / 820) * 60);
      const co2KgEstimate = Math.round(geodesicDistanceKm * 2 * 0.22);

      return {
        vehicle: 'PLANE',
        durationMinutes: flightDurationMinutes,
        distanceKm: geodesicDistanceKm,
        estimatedTravelCost: 0, // Calculated dynamically by pricing engine
        isOverlandReachable: false,
        co2KgEstimate,
      };
    }
  }
}

