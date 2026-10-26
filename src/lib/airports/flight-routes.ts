import { getAirportByIata, calculateGeodesicDistanceKm, getAllCommercialAirports, DynamicAirport } from './airport-service';
import routeGraphData from './data/flight-routes.json';
import { getAdvisoryStore, isDestinationBanned } from '../safety/advisory-store';
import { datasetScopedCache, derived, getDataset } from '@/lib/datasets/store';

/**
 * Non-stop airline route network (OpenFlights, see src/lib/datasets/generators/flight-routes.ts):
 * IATA -> set of IATA codes served non-stop. Built lazily, rebuilt when a refreshed dataset lands.
 */
const getRouteGraph = derived(() => {
  const graph = new Map<string, Set<string>>();
  for (const [code, neighbours] of Object.entries(getDataset('flight-routes', routeGraphData as Record<string, string>))) {
    graph.set(code, new Set(neighbours.split(' ')));
  }
  return graph;
});

/** True when the route network has data for this airport (otherwise the distance model is used). */
export function hasRouteNetworkData(code: string): boolean {
  return getRouteGraph().has((code || '').toUpperCase());
}

/** True when a non-stop airline route between the two airports exists in the route network. */
export function hasNonStopRoute(a: string, b: string): boolean {
  return Boolean(getRouteGraph().get((a || '').toUpperCase())?.has((b || '').toUpperCase()));
}

/**
 * Connecting airports that may be used, per advisory snapshot: the advisory check is costly and the
 * route search asks for the same hubs (hundreds of routes per busy airport) on every airport pair.
 * A new advisory store (live refresh) or refreshed airport data starts a fresh cache.
 */
const usableHubsByStore = datasetScopedCache<object, Map<string, DynamicAirport | null>>();
function usableHubLookup(): (code: string) => DynamicAirport | null {
  const store = getAdvisoryStore();
  const byStore = usableHubsByStore();
  let hubs = byStore.get(store);
  if (!hubs) {
    // Only the current snapshot is ever asked for: drop older ones
    byStore.clear();
    hubs = new Map();
    byStore.set(store, hubs);
  }
  return (code) => {
    let hub = hubs.get(code);
    if (hub === undefined) {
      const airport = getAirportByIata(code);
      hub = airport && !isDestinationBanned(airport.code, airport.country) ? airport : null;
      hubs.set(code, hub);
    }
    return hub;
  };
}

/**
 * Finds the connection with the fewest stops (max. 2) over routes that actually exist, preferring
 * the shortest total distance (intercontinental gateways get a small bonus as they offer more
 * frequencies). Returns the connecting airports (empty = non-stop), or null when either airport is
 * missing from the network or no connection within two stops exists.
 */
export function findRouteNetworkConnection(orig: DynamicAirport, dest: DynamicAirport): DynamicAirport[] | null {
  const graph = getRouteGraph();
  const fromOrig = graph.get(orig.code);
  const fromDest = graph.get(dest.code);
  if (!fromOrig || !fromDest) return null;
  if (fromOrig.has(dest.code)) return [];

  const dist = (a: DynamicAirport, b: DynamicAirport) => calculateGeodesicDistanceKm(a.lat, a.lon, b.lat, b.lon);
  const weight = (hub: DynamicAirport) => (PRIMARY_GATEWAY_HUBS.has(hub.code) ? 0.97 : 1);
  // Never connect through a country under a full travel warning or a conflict-zone airport
  const usableHub = usableHubLookup();

  // One stop: hubs served non-stop from both ends
  let bestOne: DynamicAirport | null = null;
  let bestOneScore = Infinity;
  for (const code of fromOrig) {
    if (!fromDest.has(code)) continue;
    const hub = usableHub(code);
    if (!hub) continue;
    const score = (dist(orig, hub) + dist(hub, dest)) * weight(hub);
    if (score < bestOneScore) {
      bestOneScore = score;
      bestOne = hub;
    }
  }
  if (bestOne) return [bestOne];

  // Two stops: orig -> h1 -> h2 -> dest. The last hubs (and their leg to the destination) are the
  // same for every first hub: resolve them once.
  const lastHubs: { code: string; hub: DynamicAirport; toDest: number }[] = [];
  for (const code of fromDest) {
    const hub = usableHub(code);
    if (hub) lastHubs.push({ code, hub, toDest: dist(hub, dest) * weight(hub) });
  }
  let bestTwo: [DynamicAirport, DynamicAirport] | null = null;
  let bestTwoScore = Infinity;
  for (const c1 of fromOrig) {
    const fromH1 = graph.get(c1);
    if (!fromH1) continue;
    const h1 = usableHub(c1);
    if (!h1) continue;
    const w1 = weight(h1);
    const rawLeg1 = dist(orig, h1);
    if (rawLeg1 >= bestTwoScore) continue;
    const leg1 = rawLeg1 * w1;
    for (const last of lastHubs) {
      if (last.code === c1 || !fromH1.has(last.code)) continue;
      // Same total as (leg1 + leg2 + leg3) * w1 * w2, with the weights distributed per leg
      const w2 = weight(last.hub);
      const score = (leg1 + dist(h1, last.hub) * w1) * w2 + last.toDest * w1;
      if (score < bestTwoScore) {
        bestTwoScore = score;
        bestTwo = [h1, last.hub];
      }
    }
  }
  return bestTwo;
}

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
export const PRIMARY_GATEWAY_HUBS = new Set([
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
    // From an intercontinental hub, a long-haul trip connects at a gateway en route, not at a
    // neighbouring hub (FRA -> MUC -> Honiara): the first leg must cover a real share of the trip.
    // Regional airports may still feed into a nearby hub (FKB -> FRA), which is how they operate.
    const minFirstLegKm = PRIMARY_GATEWAY_HUBS.has(orig.code) && directDist > 3200 ? directDist * 0.15 : 60;
    if (d1 < minFirstLegKm || d2 < 60) continue;

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
 *
 * Memoized per airport pair: route topology never depends on dates, but the optimizer asks
 * for it once per candidate window (engine + pricing), and each miss scans every hub.
 */
export function resolveFlightRoute(
  originIata: string,
  destIata: string
): FlightRouteDetails {
  const key = `${(originIata || '').trim().toUpperCase()}>${(destIata || '').trim().toUpperCase()}`;
  const cache = flightRouteCache();
  let route = cache.get(key);
  if (!route) {
    route = computeFlightRoute(originIata, destIata);
    cache.set(key, route);
  }
  return route;
}

// Routes depend on the airport and route datasets: emptied whenever either is refreshed
const flightRouteCache = datasetScopedCache<string, FlightRouteDetails>();

function computeFlightRoute(
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

  // 1. Direct Flight Eligibility: real route network first, distance/hub heuristics as fallback
  const networkHubs = findRouteNetworkConnection(origAirport, destAirport);
  let stops = 0;

  if (networkHubs) {
    stops = networkHubs.length;
  } else if (hasRouteNetworkData(origClean) && hasRouteNetworkData(destClean)) {
    // Both airports' routes are known and none connects them within two stops: certainly no
    // non-stop flight (the rules of thumb below are only for airports without route data)
    stops = 2;
  } else {
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
    const hub = networkHubs ? networkHubs[0] : findOptimalConnectingHub(origAirport, destAirport, allAirports);
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
    const hub1 = networkHubs?.[0] || findOptimalConnectingHub(origAirport, destAirport, allAirports) || getAirportByIata('FRA') || origAirport;
    const hub2 = networkHubs?.[1] || findOptimalConnectingHub(hub1, destAirport, allAirports, new Set([hub1.code])) || getAirportByIata('MIA') || destAirport;

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


/** Search radius for the flexible airport search (no departure airport selected). */
export const FLEX_ORIGIN_RADIUS_KM = 300;
const FLEX_ORIGIN_MIN_ROUTES = 8;
const FLEX_ORIGIN_MAX_AIRPORTS = 6;

/** Number of non-stop destinations served from an airport in the route network. */
export function getRouteCount(code: string): number {
  return getRouteGraph().get((code || '').toUpperCase())?.size ?? 0;
}

/**
 * Departure airports for the flexible search: airports within reach of home ranked by route choice
 * (non-stop destinations in the route network) against distance. Route counts come from the same
 * network the optimizer routes over; Wikidata passenger figures are too patchy for this (Basel-
 * Mulhouse is listed with 2.6M instead of ~9M passengers, which dropped it for Offenburg).
 * The two closest airports are always included - they are often across a border (Strasbourg from
 * Offenburg, Maastricht from Aachen) where the neighbor-country discount applies. The optimizer
 * evaluates all of them and keeps the best one per destination and window.
 */
export function resolveFlexOriginAirports(lat: number, lon: number): string[] {
  const candidates = getAllCommercialAirports()
    .map((a) => ({ a, routes: getRouteCount(a.code), distanceKm: calculateGeodesicDistanceKm(lat, lon, a.lat, a.lon) }))
    .filter(({ a, routes, distanceKm }) => {
      if (distanceKm > FLEX_ORIGIN_RADIUS_KM || isDestinationBanned(a.code, a.country)) return false;
      // A small airport right next door stays eligible (short drive, some direct holiday flights)
      return routes >= FLEX_ORIGIN_MIN_ROUTES || (distanceKm <= 60 && routes >= 4);
    })
    // +1 rank point per doubling of route choice, -1 per 50 km of drive
    .map(({ a, routes, distanceKm }) => ({ code: a.code, distanceKm, score: Math.log2(routes) - distanceKm / 50 }));

  const nearest = [...candidates].sort((x, y) => x.distanceKm - y.distanceKm).filter((c) => c.distanceKm <= 150).slice(0, 2);
  const ranked = [...candidates].sort((x, y) => y.score - x.score);
  return Array.from(new Set([...nearest, ...ranked].map((c) => c.code))).slice(0, FLEX_ORIGIN_MAX_AIRPORTS);
}
