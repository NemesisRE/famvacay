import { getDistance } from 'geolib';
import { getCached, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/db/prisma';

export interface RoadRoutingResult {
  drivingKm: number;
  drivingMinutes: number;
  isEstimateFallback: boolean;
}

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 3000;

/**
 * Haversine-based fallback when OSRM is offline, rate-limited, or times out:
 * actual road distance via a 1.30 winding factor at an 85 km/h average speed.
 */
function haversineFallback(lat1: number, lon1: number, lat2: number, lon2: number): RoadRoutingResult {
  const geodesicM = getDistance({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 });
  const geodesicKm = geodesicM / 1000;
  const drivingKm = Math.round(geodesicKm * 1.30 * 10) / 10;
  const drivingMinutes = Math.round((drivingKm / 85) * 60);
  return { drivingKm, drivingMinutes, isEstimateFallback: true };
}

/**
 * Resolves real road driving distance/duration between two coordinates via the public OSRM
 * Route API, with a clean 3-second timeout and automatic fallback to the Haversine*1.30
 * road-winding estimate when OSRM is offline, rate-limited, or too slow. Never throws - this
 * must never block or crash the core CSP optimizer.
 */
export async function getRoadRouting(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<RoadRoutingResult> {
  const cacheKey = `osrm:route:${originLat.toFixed(3)},${originLon.toFixed(3)}:${destLat.toFixed(3)},${destLon.toFixed(3)}`;

  const cached = await getCached<RoadRoutingResult>(cacheKey).catch(() => null);
  if (cached) return cached;

  let result: RoadRoutingResult;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

    const url = `${OSRM_BASE_URL}/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OSRM responded with status ${res.status}`);
    }

    const data = await res.json();
    const route = data?.routes?.[0];

    if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      throw new Error('OSRM response missing route data');
    }

    result = {
      drivingKm: Math.round((route.distance / 1000) * 10) / 10,
      drivingMinutes: Math.round(route.duration / 60),
      isEstimateFallback: false,
    };
  } catch {
    // Offline, rate-limited, timed out, or malformed response - gracefully degrade.
    result = haversineFallback(originLat, originLon, destLat, destLon);
  }

  // Cache resolved routing for 30 days regardless of fallback status, to avoid hammering
  // the public OSRM instance; a later successful lookup will overwrite a stale fallback.
  await setCached(cacheKey, result, 2592000).catch(() => {});

  return result;
}

/**
 * Resolves and persists real road routing metrics (home -> preferred airport) for a family
 * profile's saved `FamilyAirport` link, caching the result on the row itself so repeat
 * searches skip the OSRM round-trip entirely. Never throws.
 */
export async function resolveFamilyAirportRoadRouting(
  familyProfileId: string,
  airportIata: string
): Promise<RoadRoutingResult | null> {
  try {
    const link = await prisma.familyAirport.findUnique({
      where: { familyProfileId_airportIata: { familyProfileId, airportIata } },
      include: { airport: true },
    });
    if (!link) return null;

    if (link.drivingKm != null && link.drivingMinutes != null) {
      return { drivingKm: link.drivingKm, drivingMinutes: link.drivingMinutes, isEstimateFallback: false };
    }

    const profile = await prisma.familyProfile.findUnique({ where: { id: familyProfileId } });
    if (!profile?.homeLat || !profile?.homeLon) return null;

    const result = await getRoadRouting(profile.homeLat, profile.homeLon, link.airport.lat, link.airport.lon);

    await prisma.familyAirport.update({
      where: { id: link.id },
      data: { drivingKm: result.drivingKm, drivingMinutes: result.drivingMinutes },
    }).catch(() => {});

    return result;
  } catch {
    return null;
  }
}
