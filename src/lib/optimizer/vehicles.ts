import { TravelVehicle, VehicleTravelMetrics, CarFuelType } from './types';
import { getAirportByIata } from '../airports/airport-service';
import { getSurfaceDestination } from '../geo/surface-destinations';

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
 * Island destinations with NO ferry topology modeled (flight-only, prune when FLIGHT mode disabled):
 * Canary/Balearic Islands for standard car trips, Azores, Madeira, Sicily, Hawaii, Tasmania.
 */
const FLIGHT_ONLY_SUBDIVISIONS = new Set([
  'ES-CN', // Canary Islands (Tenerife, Gran Canaria, etc.)
  'ES-IB', // Balearic Islands (Mallorca, Ibiza, Menorca)
  'PT-20', // Azores
  'PT-30', // Madeira
  'US-HI', // Hawaii
  'AU-TAS', // Tasmania
]);

/**
 * Island subdivisions reachable overland only via a LONG_FERRY crossing (2.5h-10h roundtrip).
 */
const LONG_FERRY_SUBDIVISIONS = new Set([
  'FR-20', 'FR-COR', 'FR-2A', 'FR-2B', // Corsica
  'IT-88', 'IT-SAR', // Sardinia
]);

/**
 * Island subdivisions reachable overland via a SHORT_FERRY crossing (< 2.5h).
 */
const SHORT_FERRY_SUBDIVISIONS = new Set([
  'IT-82', 'IT-SIC', // Sicily (Strait of Messina car ferry, ~20 min crossing)
]);

/**
 * Single-airport islands reachable overland only via a LONG_FERRY crossing (2.5h-10h),
 * where the island has no distinct ISO subdivision code separate from the mainland region.
 */
const LONG_FERRY_AIRPORTS = new Set([
  'RNN', // Bornholm (Denmark)
  'VBY', // Gotland (Sweden)
  'IOM', // Isle of Man (Heysham/Liverpool ferry)
]);

/**
 * Single-airport islands reachable overland only via a SHORT_FERRY crossing (< 2.5h).
 */
const SHORT_FERRY_AIRPORTS = new Set([
  'EBA', // Elba (Italy)
  'GWT', // Sylt (Germany, AutoZug car-shuttle train treated as a short ferry-equivalent transfer)
  'CFU', // Corfu (Greece)
  'JER', // Jersey (Saint-Malo ferry)
  'GCI', // Guernsey (Saint-Malo ferry)
]);

/**
 * Overland-access classification replacing the former binary island filter for CAR/TRAIN/BUS.
 */
export type OverlandAccessClass = 'MAINLAND_OR_BRIDGE' | 'SHORT_FERRY' | 'LONG_FERRY' | 'FLIGHT_ONLY';

export interface OverlandAccessResult {
  access: OverlandAccessClass;
  ferrySurchargeEur: number;
  ferryTransitMinutes: number;
}

/**
 * Classifies the ferry/bridge topology of a destination island, independent of the baseline
 * continent/sea-crossing checks in `isOverlandReachable`.
 * - MAINLAND_OR_BRIDGE: no ferry involved (e.g. Rügen, Fehmarn, Usedom, Krk, UK via Eurotunnel).
 * - SHORT_FERRY (< 2.5h): +140 EUR roundtrip, +120 min transit buffer (incl. check-in).
 * - LONG_FERRY (2.5h-10h): +380 EUR roundtrip, + actual crossing minutes.
 * - FLIGHT_ONLY: pruned from overland results when FLIGHT mode is disabled.
 */
export function classifyOverlandAccess(destination: DestinationGeoPoint): OverlandAccessResult {
  // Surface (non-airport) nodes carry their own curated ferry topology and crossing costs.
  const surface = getSurfaceDestination(destination.code);
  if (surface) {
    return {
      access: surface.access,
      ferrySurchargeEur: surface.ferrySurchargeEur || 0,
      ferryTransitMinutes: surface.ferryTransitMinutes || 0,
    };
  }

  const code = (destination.code || '').toUpperCase();
  const state = destination.state || '';

  if (SHORT_FERRY_AIRPORTS.has(code) || SHORT_FERRY_SUBDIVISIONS.has(state)) {
    return { access: 'SHORT_FERRY', ferrySurchargeEur: 140, ferryTransitMinutes: 120 };
  }

  if (LONG_FERRY_AIRPORTS.has(code) || LONG_FERRY_SUBDIVISIONS.has(state)) {
    // Actual crossing minutes vary by specific route; 360 min (6h) is a representative
    // mid-point for Corsica/Sardinia/Bornholm/Gotland roundtrip-equivalent ferry legs.
    return { access: 'LONG_FERRY', ferrySurchargeEur: 380, ferryTransitMinutes: 360 };
  }

  if (FLIGHT_ONLY_SUBDIVISIONS.has(state) || (GREEK_ISLAND_AIRPORTS.has(code) && code !== 'CFU')) {
    return { access: 'FLIGHT_ONLY', ferrySurchargeEur: 0, ferryTransitMinutes: 0 };
  }

  // Any other island airport (Greek island subdivisions, Scottish isles, "... Island" airports)
  // has no ferry topology modeled, so it must not silently count as reachable by road.
  if (isUnmodeledIslandAirport(code, state)) {
    return { access: 'FLIGHT_ONLY', ferrySurchargeEur: 0, ferryTransitMinutes: 0 };
  }

  return { access: 'MAINLAND_OR_BRIDGE', ferrySurchargeEur: 0, ferryTransitMinutes: 0 };
}

/**
 * Greek island regions (South/North Aegean, Crete, Ionian Islands) and other island
 * subdivisions whose airports are not explicitly ferry-classified above.
 */
const ISLAND_ONLY_SUBDIVISIONS = new Set(['GR-L', 'GR-K', 'GR-M', 'GR-F', 'GR-81', 'GR-82', 'GR-83', 'GR-85']);
const ISLAND_NAME_PATTERN = /\b(island|islands|isle|isles|isla|islas|insel|inseln|isola|isole|ile|îles?)\b/i;
// Hebrides, Orkney and Shetland airfields, whose names do not say "island".
const SCOTTISH_ISLAND_AIRPORTS = new Set(['BRR', 'TRE', 'ILY', 'SYY', 'BEB', 'KOI', 'LSI', 'LWK', 'CSA', 'NRL', 'PPW', 'WRY', 'SOY', 'EOI']);

function isUnmodeledIslandAirport(code: string, state: string): boolean {
  if (!code || code.length !== 3) return false;
  if (state && ISLAND_ONLY_SUBDIVISIONS.has(state)) return true;
  if (SCOTTISH_ISLAND_AIRPORTS.has(code)) return true;
  const airport = getAirportByIata(code);
  if (!airport) return false;
  // Name/city only: airport keyword lists mention nearby islands for mainland airports too.
  return ISLAND_NAME_PATTERN.test(`${airport.name} ${airport.city}`);
}

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

/**
 * Approximates a location's UTC offset from longitude (15 degrees per hour), since no
 * authoritative timezone database is wired in. Reasonable for jetlag-friction estimation.
 */
export function estimateUtcOffsetHours(lonDegrees: number): number {
  return Math.round(lonDegrees / 15);
}

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

  // Surface nodes on islands (Mallorca via Barcelona, Corsica, Sardinia, Hvar...) declare an
  // explicit ferry link, so the airport-oriented island blocks below do not apply to them.
  const isSurfaceNode = Boolean(getSurfaceDestination(destination.code));

  // Flight-only island subdivisions (Canaries, Balearics, Madeira, Azores, Sicily, Hawaii, Tasmania):
  // no ferry topology modeled, so these remain a hard overland block. Corsica and Sardinia are
  // excluded here - they are reachable via LONG_FERRY (see classifyOverlandAccess).
  if (!isSurfaceNode && destination.state && FLIGHT_ONLY_SUBDIVISIONS.has(destination.state)) {
    if (origin.state !== destination.state) {
      return false;
    }
  }

  // If origin is on a flight-only island, cannot reach other subdivisions or mainland overland
  if (origin.state && FLIGHT_ONLY_SUBDIVISIONS.has(origin.state)) {
    if (origin.state !== destination.state) {
      return false;
    }
  }

  // Greek islands check (Corfu excluded - reachable via SHORT_FERRY)
  if (dCountry === 'GR' && destination.code && GREEK_ISLAND_AIRPORTS.has(destination.code.toUpperCase()) && destination.code.toUpperCase() !== 'CFU') {
    return false;
  }

  // Island airports without a modeled ferry link (see classifyOverlandAccess)
  if (!isSurfaceNode && destination.code && isUnmodeledIslandAirport(destination.code.toUpperCase(), destination.state || '')) {
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
 * Maximum geodesic (straight-line) distance each overland vehicle is considered for when the
 * user has not set an explicit travel-time cap. Car trips to the Spanish Mediterranean coast or
 * the Algarve are classic two-day family road trips, so the car range covers them; the
 * travel-time filter (maxOverlandTravelMinutes) and the overland friction score keep long
 * drives from dominating.
 */
export const OVERLAND_MAX_GEODESIC_KM = {
  CAR: 2000,
  TRAIN: 900,
  TRAIN_HIGH_SPEED: 1300,
  BUS: 1200,
} as const;

/**
 * Inverts the vehicle duration models below: the largest geodesic distance a vehicle can cover
 * within the given door-to-door minutes (ignoring ferry legs, which only shrink it further).
 */
export function maxGeodesicKmForMinutes(
  vehicle: Exclude<TravelVehicle, 'PLANE'>,
  minutes: number,
  highSpeedRail = false
): number {
  switch (vehicle) {
    case 'CAR':
      return Math.max(0, (((minutes - 45) / 60) * 88) / 1.25);
    case 'TRAIN':
      return highSpeedRail
        ? Math.max(0, ((minutes - 30) / 60) * 160)
        : Math.max(0, ((minutes - 45) / 60) * 100);
    case 'BUS':
    default:
      return Math.max(0, (((minutes - 60) / 60) * 72) / 1.25);
  }
}

/**
 * Whether a single overland vehicle can physically cover the given geodesic distance.
 */
export function isOverlandVehicleInRange(
  vehicle: Exclude<TravelVehicle, 'PLANE'>,
  geodesicDistanceKm: number,
  highSpeedRail = false
): boolean {
  if (vehicle === 'CAR') return geodesicDistanceKm <= OVERLAND_MAX_GEODESIC_KM.CAR;
  if (vehicle === 'TRAIN') {
    return geodesicDistanceKm <= (highSpeedRail ? OVERLAND_MAX_GEODESIC_KM.TRAIN_HIGH_SPEED : OVERLAND_MAX_GEODESIC_KM.TRAIN);
  }
  return geodesicDistanceKm <= OVERLAND_MAX_GEODESIC_KM.BUS;
}

/**
 * Travel friction for an overland journey (0-100, higher = easier), driven by door-to-door
 * duration rather than flight distance. A 4h drive to the Baltic should rank as far less
 * tiring than a 14h drive to the Algarve, and ferry legs add boarding/queueing friction.
 */
export function calculateOverlandFrictionScore(
  vehicle: Exclude<TravelVehicle, 'PLANE'>,
  durationMinutes: number,
  access: OverlandAccessClass = 'MAINLAND_OR_BRIDGE'
): number {
  const hours = durationMinutes / 60;
  let score: number;
  if (hours <= 3) score = 96;
  else if (hours <= 6) score = 96 - ((hours - 3) / 3) * 14;   // 96 -> 82
  else if (hours <= 10) score = 82 - ((hours - 6) / 4) * 20;  // 82 -> 62
  else if (hours <= 14) score = 62 - ((hours - 10) / 4) * 18; // 62 -> 44
  else score = 44 - Math.min(24, (hours - 14) * 3);           // 44 -> 20

  // Kids can move around on a train; coaches are the most cramped option.
  if (vehicle === 'TRAIN') score += 4;
  if (vehicle === 'BUS') score -= 6;
  if (access === 'SHORT_FERRY') score -= 2;
  if (access === 'LONG_FERRY') score -= 5;

  return Math.round(Math.max(15, Math.min(100, score)));
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

  // Plane: Valid for commercial corridors >= 180 km, and only to an actual airport
  if (geodesicDistanceKm >= 180 && !getSurfaceDestination(destination.code)) {
    available.push('PLANE');
  }

  const overland = isOverlandReachable(origin, destination);

  if (overland) {
    if (isOverlandVehicleInRange('CAR', geodesicDistanceKm)) {
      available.push('CAR');
    }
    if (isOverlandVehicleInRange('TRAIN', geodesicDistanceKm, destination.isHighSpeedRailConnected)) {
      available.push('TRAIN');
    }
    if (isOverlandVehicleInRange('BUS', geodesicDistanceKm)) {
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
 * Per-drivetrain assumptions for a mid-size family car / van on motorway trips (EU 2026 price
 * level). energy = cost per road km; wear = maintenance + tyres + depreciation share per km.
 * Electric charging uses mostly motorway fast chargers on a road trip, hence the higher kWh price.
 */
export const CAR_FUEL_PROFILES: Record<
  CarFuelType,
  { consumptionPer100Km: number; unitPriceEur: number; co2KgPerUnit: number; wearEurPerKm: number; unit: 'l' | 'kWh' }
> = {
  PETROL: { consumptionPer100Km: 7.5, unitPriceEur: 1.75, co2KgPerUnit: 2.37, wearEurPerKm: 0.07, unit: 'l' },
  DIESEL: { consumptionPer100Km: 6.2, unitPriceEur: 1.65, co2KgPerUnit: 2.65, wearEurPerKm: 0.07, unit: 'l' },
  // EU grid mix ~0.25 kg CO2/kWh incl. charging losses
  ELECTRIC: { consumptionPer100Km: 20, unitPriceEur: 0.55, co2KgPerUnit: 0.25, wearEurPerKm: 0.05, unit: 'kWh' },
};

// Usable motorway range between fast-charging stops (10-80% charge window at ~120 km/h)
const EV_LEG_KM = 280;
// Extra minutes per charging stop beyond the regular rest-stop budget (kids eat/play meanwhile)
const EV_EXTRA_MINUTES_PER_STOP = 20;

/**
 * Computes realistic travel duration, route distance, round-trip travel costs, and CO2 emissions
 * for a specific vehicle.
 */
export function calculateVehicleMetrics(
  vehicle: TravelVehicle,
  geodesicDistanceKm: number,
  passengerMultiplier: number = 1.0,
  isHighSpeedRail: boolean = false,
  ferryAccess?: OverlandAccessResult,
  carFuelType?: CarFuelType
): VehicleTravelMetrics {
  const ferrySurcharge = ferryAccess?.ferrySurchargeEur || 0;
  const ferryMinutes = ferryAccess?.ferryTransitMinutes || 0;

  switch (vehicle) {
    case 'CAR': {
      // Actual driving distance is ~25% longer than geodesic line
      const roadDistanceKm = Math.round(geodesicDistanceKm * 1.25);
      // Realistic family driving speed ~88 km/h on motorways with rest stops (+45 mins)
      const baseMinutes = Math.round((roadDistanceKm / 88) * 60 + 45) + ferryMinutes;
      // Car cost is per vehicle (for the whole family!), plus vignettes/tolls (~45 € if dist > 250km)
      const roundTripDist = roadDistanceKm * 2;
      const tolls = geodesicDistanceKm > 250 ? 45 : 0;

      if (!carFuelType) {
        // Drivetrain unknown: blended fuel + wear (~0.20 €/km) and average CO2
        return {
          vehicle: 'CAR',
          durationMinutes: baseMinutes,
          distanceKm: roadDistanceKm,
          estimatedTravelCost: Math.round(roundTripDist * 0.20 + tolls) + ferrySurcharge,
          isOverlandReachable: true,
          co2KgEstimate: Math.round(roundTripDist * 0.14),
        };
      }

      const profile = CAR_FUEL_PROFILES[carFuelType];
      const energyUnits = (roundTripDist / 100) * profile.consumptionPer100Km;
      const energyCostEur = Math.round(energyUnits * profile.unitPriceEur);
      const wearCost = roundTripDist * profile.wearEurPerKm;
      // Electric: one fast-charging stop per EV_LEG_KM after leaving home with a full battery
      const chargingStops = carFuelType === 'ELECTRIC' ? Math.max(0, Math.ceil(roadDistanceKm / EV_LEG_KM) - 1) : 0;

      return {
        vehicle: 'CAR',
        durationMinutes: baseMinutes + chargingStops * EV_EXTRA_MINUTES_PER_STOP,
        distanceKm: roadDistanceKm,
        estimatedTravelCost: Math.round(energyCostEur + wearCost + tolls) + ferrySurcharge,
        isOverlandReachable: true,
        co2KgEstimate: Math.round(energyUnits * profile.co2KgPerUnit),
        fuelType: carFuelType,
        energyCostEur,
        chargingStops: carFuelType === 'ELECTRIC' ? chargingStops : undefined,
      };
    }

    case 'TRAIN': {
      const railDistanceKm = Math.round(geodesicDistanceKm * 1.15);
      const durationMinutes = (isHighSpeedRail
        ? Math.round((geodesicDistanceKm / 160) * 60 + 30)
        : Math.round((geodesicDistanceKm / 100) * 60 + 45)) + ferryMinutes;
      // Train fares scale by passenger multiplier with family discounts
      const adultRoundTripFare = Math.round(60 + geodesicDistanceKm * 0.12);
      const estimatedTravelCost = Math.round(adultRoundTripFare * passengerMultiplier) + ferrySurcharge;
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
      const durationMinutes = Math.round((busDistanceKm / 72) * 60 + 60) + ferryMinutes;
      const adultRoundTripFare = Math.round(35 + geodesicDistanceKm * 0.08);
      const estimatedTravelCost = Math.round(adultRoundTripFare * passengerMultiplier) + ferrySurcharge;
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

