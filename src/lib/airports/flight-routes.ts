import { getAirportByIata, calculateGeodesicDistanceKm, getAllCommercialAirports, DynamicAirport } from './airport-service';

export interface FlightLayover {
  airportCode: string;
  airportName: string;
  city: string;
  country: string;
  durationMinutes: number; // e.g. 75 to 150 minutes
}

export interface FlightSegment {
  departureAirport: string;
  arrivalAirport: string;
  departureCity?: string;
  arrivalCity?: string;
  departureCountry?: string;
  arrivalCountry?: string;
  durationMinutes: number;
  distanceKm: number;
  flightNumber?: string;
  carrier?: string;
}

export interface FlightRouteDetails {
  originAirport: string;
  destinationAirport: string;
  isDirect: boolean;
  stops: number; // 0 = direct, 1 = 1 stop, 2 = 2 stops
  totalFlightDurationMinutes: number;
  pureFlightDurationMinutes: number;
  totalLayoverMinutes: number;
  flightDistanceKm: number;
  layovers: FlightLayover[];
  segments: FlightSegment[];
  directFlightPremiumMultiplier: number;
  connectingSavingsDiscount: number;
  layoverFrictionScorePenalty: number;
  layoverScorePenalty: number;
}

// Global intercontinental trunk hubs commonly used for global passenger connections
const PRIMARY_GATEWAY_HUBS = new Set([
  'FRA', 'MUC', 'CDG', 'LHR', 'AMS', 'ZRH', 'VIE', 'MAD', 'BCN', 'FCO', 'IST',
  'DXB', 'DOH', 'AUH',
  'JFK', 'EWR', 'BOS', 'ORD', 'ATL', 'MIA', 'DFW', 'LAX', 'SFO', 'IAD',
  'SIN', 'BKK', 'HND', 'NRT', 'ICN', 'HKG', 'SYD'
]);

// Popular holiday charter destinations commonly served directly even from secondary European airports
const POPULAR_EURO_CHARTER_DESTINATIONS = new Set([
  'PMI', 'IBZ', 'MAH', 'TFS', 'LPA', 'ACE', 'FUE',
  'AGP', 'ALC', 'FAO', 'BCN', 'VLC',
  'HER', 'RHO', 'KGS', 'CFU', 'CHQ', 'ZTH', 'JMK', 'JTR',
  'AYT', 'DLM', 'BJV', 'GZP',
  'HRG', 'RMF', 'SSH',
  'NAP', 'CTA', 'PMO', 'OLB', 'CAG', 'BRI',
  'DBV', 'SPU', 'ZAD'
]);

// Remote or feeder-only destinations that do not have direct long-haul flights from Europe
const REMOTE_FEEDER_DESTINATIONS = new Set([
  'EIS', 'VIJ', 'AXA', 'SBH', 'NEV', 'SKB', 'GCM', 'CYB', 'BON',
  'BOB', 'RFP', 'MOZ', 'PPT',
  'SEZ', 'PRI', 'MRU',
  'USM', 'KBV', 'TDX'
]);

/**
 * Finds the most logical connecting hub between origin and destination based on geodesic geometry and hub network
 */
export function findOptimalConnectingHub(
  originAirport: DynamicAirport | string,
  destAirport: DynamicAirport | string,
  allAirports: DynamicAirport[] = getAllCommercialAirports(),
  excludeHubs: Set<string> = new Set()
): DynamicAirport | null {
  const orig = typeof originAirport === 'string' ? getAirportByIata(originAirport) : originAirport;
  const dest = typeof destAirport === 'string' ? getAirportByIata(destAirport) : destAirport;
  if (!orig || !dest) return null;

  const directDist = calculateGeodesicDistanceKm(
    orig.lat,
    orig.lon,
    dest.lat,
    dest.lon
  );

  let bestHub: DynamicAirport | null = null;
  let bestScore = Infinity;

  // Potential hub pool: primary gateways or airports flagged as major hubs
  const hubCandidates = allAirports.filter(
    (a) =>
      (PRIMARY_GATEWAY_HUBS.has(a.code) || a.isMajorHub) &&
      a.code !== orig.code &&
      a.code !== dest.code &&
      !excludeHubs.has(a.code)
  );

  for (const hub of hubCandidates) {
    const d1 = calculateGeodesicDistanceKm(orig.lat, orig.lon, hub.lat, hub.lon);
    const d2 = calculateGeodesicDistanceKm(hub.lat, hub.lon, dest.lat, dest.lon);

    // Hub must not be too close to either endpoint (min 60km)
    if (d1 < 60 || d2 < 60) continue;

    const totalPath = d1 + d2;
    const detourRatio = totalPath / Math.max(100, directDist);

    // Hub should not cause excessive detour (> 1.45x direct distance unless very short route)
    if (directDist > 1500 && detourRatio > 1.45) continue;
    if (directDist <= 1500 && detourRatio > 1.6) continue;

    // Favor primary gateway hubs and hubs closer to the midpoint or closer to origin for feeder flights
    let score = detourRatio * 100;
    if (PRIMARY_GATEWAY_HUBS.has(hub.code)) {
      score -= 15; // Prefer tier-1 mega-hubs
    }
    // If origin is regional, heavily favor a hub in the same country/region (e.g. FRA/MUC for German regional)
    if (hub.country === orig.country) {
      score -= 12;
    } else if (hub.country === dest.country) {
      score -= 8;
    }

    if (score < bestScore) {
      bestScore = score;
      bestHub = hub;
    }
  }

  return bestHub;
}

/**
 * Resolves comprehensive flight route logistics between any origin and destination airport:
 * - Detects direct routes vs 1-stop or 2-stop connecting flights
 * - Computes exact legs, transfer hubs, layover durations, and total transit times
 * - Calculates direct flight premium vs connecting discount
 * - Calculates layover friction and overall score penalties
 */
export function resolveFlightRoute(
  originIata: string,
  destIata: string
): FlightRouteDetails {
  const origClean = (originIata || '').trim().toUpperCase();
  const destClean = (destIata || '').trim().toUpperCase();

  const origAirport = getAirportByIata(origClean);
  const destAirport = getAirportByIata(destClean);

  if (!origAirport || !destAirport || origClean === destClean) {
    // Fallback baseline direct route
    const fallbackDist = 1200;
    const durMins = Math.round(35 + (fallbackDist / 820) * 60);
    return {
      originAirport: origClean,
      destinationAirport: destClean,
      isDirect: true,
      stops: 0,
      totalFlightDurationMinutes: durMins,
      pureFlightDurationMinutes: durMins,
      totalLayoverMinutes: 0,
      flightDistanceKm: fallbackDist,
      layovers: [],
      segments: [
        {
          departureAirport: origClean,
          arrivalAirport: destClean,
          durationMinutes: durMins,
          distanceKm: fallbackDist,
        },
      ],
      directFlightPremiumMultiplier: 1.18,
      connectingSavingsDiscount: 0,
      layoverFrictionScorePenalty: 0,
      layoverScorePenalty: 0,
    };
  }

  const directDistKm = calculateGeodesicDistanceKm(
    origAirport.lat,
    origAirport.lon,
    destAirport.lat,
    destAirport.lon
  );

  const allAirports = getAllCommercialAirports();
  const isOriginIntercontinentalHub = PRIMARY_GATEWAY_HUBS.has(origClean);
  const isDestMajorHub = PRIMARY_GATEWAY_HUBS.has(destClean) || Boolean(destAirport.isMajorHub);
  const isCharterDest = POPULAR_EURO_CHARTER_DESTINATIONS.has(destClean);
  const isRemoteFeederDest = REMOTE_FEEDER_DESTINATIONS.has(destClean);

  // 1. Direct Flight Eligibility:
  let stops = 0;

  // Ultra-long-haul (> 11,500km, e.g. Europe to Australia/NZ) cannot operate economically non-stop
  if (directDistKm >= 11500) {
    stops = isOriginIntercontinentalHub ? 1 : 2;
  } else if (isRemoteFeederDest) {
    // Remote feeder island or airstrip
    stops = isOriginIntercontinentalHub ? 1 : 2;
  } else if (directDistKm > 3200) {
    // Intercontinental / Long-haul routes (> 3200km)
    if (!isOriginIntercontinentalHub) {
      // Secondary or regional airport (e.g. FKB, STR, FDH, NUE, BSL) CANNOT fly direct long-haul
      stops = 1;
    } else {
      // From a major international hub (e.g. FRA, CDG, LHR):
      // Direct if destination is a major hub or prominent long-haul holiday corridor (CUN, PUJ, MIA, BKK, DXB, etc.)
      const isKnownLongHaulDirect =
        isDestMajorHub ||
        ['CUN', 'PUJ', 'MBJ', 'CUR', 'MLE', 'BKK', 'HKT', 'MIA', 'JFK', 'DXB'].includes(destClean);
      stops = isKnownLongHaulDirect ? 0 : 1;
    }
  } else {
    // Short / Medium Haul (< 3200km)
    if (isOriginIntercontinentalHub) {
      stops = 0; // Major hubs serve practically all European / Mediterranean leisure destinations non-stop
    } else {
      // Regional origin (e.g. FKB, STR):
      // Direct if it is a popular Mediterranean/Canaries holiday charter destination or feeder to close major hub
      const isDirectCharterCorridor =
        isCharterDest ||
        PRIMARY_GATEWAY_HUBS.has(destClean) ||
        (origAirport.country === destAirport.country && directDistKm <= 900);

      stops = isDirectCharterCorridor ? 0 : 1;
    }
  }

  // 2. Build Legs and Layovers
  const layovers: FlightLayover[] = [];
  const segments: FlightSegment[] = [];
  let totalLayoverMinutes = 0;
  let totalFlightDurationMinutes = 0;
  let pureFlightDurationMinutes = 0;

  if (stops === 0) {
    const durMins = Math.round(35 + (directDistKm / 820) * 60);
    pureFlightDurationMinutes = durMins;
    totalFlightDurationMinutes = durMins;
    segments.push({
      departureAirport: origClean,
      arrivalAirport: destClean,
      departureCity: origAirport.city,
      arrivalCity: destAirport.city,
      departureCountry: origAirport.country,
      arrivalCountry: destAirport.country,
      durationMinutes: durMins,
      distanceKm: directDistKm,
      carrier: 'Primary Airline / Star Alliance / Oneworld',
      flightNumber: `${origClean.slice(0, 2)} ${Math.floor(100 + Math.random() * 899)}`,
    });
  } else if (stops === 1) {
    const hub = findOptimalConnectingHub(origAirport, destAirport, allAirports);
    const hubAirport = hub || getAirportByIata('FRA') || origAirport;

    const leg1Dist = calculateGeodesicDistanceKm(origAirport.lat, origAirport.lon, hubAirport.lat, hubAirport.lon);
    const leg2Dist = calculateGeodesicDistanceKm(hubAirport.lat, hubAirport.lon, destAirport.lat, destAirport.lon);

    const leg1Dur = Math.round(35 + (leg1Dist / 820) * 60);
    const leg2Dur = Math.round(35 + (leg2Dist / 820) * 60);

    // Realistic connection layover: ~75 to 110m for intra-continental, ~105 to 140m for intercontinental
    const isIntercontinental = directDistKm > 3200;
    const layoverDuration = isIntercontinental ? 115 : 85;

    totalLayoverMinutes = layoverDuration;
    pureFlightDurationMinutes = leg1Dur + leg2Dur;
    totalFlightDurationMinutes = pureFlightDurationMinutes + totalLayoverMinutes;

    layovers.push({
      airportCode: hubAirport.code,
      airportName: hubAirport.name,
      city: hubAirport.city,
      country: hubAirport.country,
      durationMinutes: layoverDuration,
    });

    segments.push({
      departureAirport: origClean,
      arrivalAirport: hubAirport.code,
      departureCity: origAirport.city,
      arrivalCity: hubAirport.city,
      departureCountry: origAirport.country,
      arrivalCountry: hubAirport.country,
      durationMinutes: leg1Dur,
      distanceKm: leg1Dist,
      carrier: 'Connecting Regional Flight',
      flightNumber: `${origClean.slice(0, 2)} ${Math.floor(100 + Math.random() * 899)}`,
    });

    segments.push({
      departureAirport: hubAirport.code,
      arrivalAirport: destClean,
      departureCity: hubAirport.city,
      arrivalCity: destAirport.city,
      departureCountry: hubAirport.country,
      arrivalCountry: destAirport.country,
      durationMinutes: leg2Dur,
      distanceKm: leg2Dist,
      carrier: 'Connecting Long-Haul Flight',
      flightNumber: `${hubAirport.code.slice(0, 2)} ${Math.floor(100 + Math.random() * 899)}`,
    });
  } else {
    // 2 Stops (e.g. regional origin -> primary hub -> destination gateway -> destination)
    const hub1 = findOptimalConnectingHub(origAirport, destAirport, allAirports) || getAirportByIata('FRA') || origAirport;
    const hub2 = findOptimalConnectingHub(hub1, destAirport, allAirports, new Set([hub1.code])) || getAirportByIata('MIA') || destAirport;

    const leg1Dist = calculateGeodesicDistanceKm(origAirport.lat, origAirport.lon, hub1.lat, hub1.lon);
    const leg2Dist = calculateGeodesicDistanceKm(hub1.lat, hub1.lon, hub2.lat, hub2.lon);
    const leg3Dist = calculateGeodesicDistanceKm(hub2.lat, hub2.lon, destAirport.lat, destAirport.lon);

    const leg1Dur = Math.round(35 + (leg1Dist / 820) * 60);
    const leg2Dur = Math.round(35 + (leg2Dist / 820) * 60);
    const leg3Dur = Math.round(35 + (leg3Dist / 820) * 60);

    const layover1Dur = 90;
    const layover2Dur = 120;
    totalLayoverMinutes = layover1Dur + layover2Dur;
    pureFlightDurationMinutes = leg1Dur + leg2Dur + leg3Dur;
    totalFlightDurationMinutes = pureFlightDurationMinutes + totalLayoverMinutes;

    layovers.push({
      airportCode: hub1.code,
      airportName: hub1.name,
      city: hub1.city,
      country: hub1.country,
      durationMinutes: layover1Dur,
    });
    layovers.push({
      airportCode: hub2.code,
      airportName: hub2.name,
      city: hub2.city,
      country: hub2.country,
      durationMinutes: layover2Dur,
    });

    segments.push({
      departureAirport: origClean,
      arrivalAirport: hub1.code,
      departureCity: origAirport.city,
      arrivalCity: hub1.city,
      departureCountry: origAirport.country,
      arrivalCountry: hub1.country,
      durationMinutes: leg1Dur,
      distanceKm: leg1Dist,
    });
    segments.push({
      departureAirport: hub1.code,
      arrivalAirport: hub2.code,
      departureCity: hub1.city,
      arrivalCity: hub2.city,
      departureCountry: hub1.country,
      arrivalCountry: hub2.country,
      durationMinutes: leg2Dur,
      distanceKm: leg2Dist,
    });
    segments.push({
      departureAirport: hub2.code,
      arrivalAirport: destClean,
      departureCity: hub2.city,
      arrivalCity: destAirport.city,
      departureCountry: hub2.country,
      arrivalCountry: destAirport.country,
      durationMinutes: leg3Dur,
      distanceKm: leg3Dist,
    });
  }

  // 3. Pricing Disparity & Premium / Discount Modeling:
  // Non-stop flights command a direct flight premium (~18% higher base fare)
  // Connecting flights are discounted to incentivize multi-leg travel (~15% discount for 1 stop, ~24% for 2 stops)
  let directFlightPremiumMultiplier = 1.0;
  let connectingSavingsDiscount = 0.0;

  if (stops === 0) {
    directFlightPremiumMultiplier = 1.18; // +18% non-stop convenience premium
    connectingSavingsDiscount = 0.0;
  } else if (stops === 1) {
    directFlightPremiumMultiplier = 1.0;
    connectingSavingsDiscount = 0.15; // ~15% discount for 1 stop
  } else {
    directFlightPremiumMultiplier = 1.0;
    connectingSavingsDiscount = 0.24; // ~24% discount for 2 stops
  }

  // 4. Scoring Penalties:
  // Layover-weighted scoring penalty on Travel Friction Index:
  // - 1 stop: -16 points
  // - 2 stops: -32 points
  // Plus extra friction if layover exceeds 120 minutes
  let layoverFrictionScorePenalty = 0;
  let layoverScorePenalty = 0;

  if (stops === 1) {
    layoverFrictionScorePenalty = 16 + Math.max(0, Math.round((totalLayoverMinutes - 90) / 30) * 2);
    layoverScorePenalty = 5; // Measurable direct penalty on overall vacation factor (0-100)
  } else if (stops >= 2) {
    layoverFrictionScorePenalty = 32 + Math.max(0, Math.round((totalLayoverMinutes - 180) / 30) * 3);
    layoverScorePenalty = 12; // Severe penalty on overall vacation factor for multi-transfer connections
  }

  return {
    originAirport: origClean,
    destinationAirport: destClean,
    isDirect: stops === 0,
    stops,
    totalFlightDurationMinutes,
    pureFlightDurationMinutes,
    totalLayoverMinutes,
    flightDistanceKm: directDistKm,
    layovers,
    segments,
    directFlightPremiumMultiplier,
    connectingSavingsDiscount,
    layoverFrictionScorePenalty,
    layoverScorePenalty,
  };
}

