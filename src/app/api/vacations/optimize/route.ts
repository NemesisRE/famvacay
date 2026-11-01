import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { TripPlanInput, CandidateWindow } from '@/lib/optimizer/types';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { getSchoolHolidays, getPublicHolidays } from '@/lib/integrations/open-holidays';
import { getAirportByIata } from '@/lib/airports/airport-service';
import { resolveFlexOriginAirports } from '@/lib/airports/flight-routes';
import { loadSourceMarketCalendars } from '@/lib/holidays/source-market-loader';
import { getCached, setCached } from '@/lib/cache/redis';
import { ensureTravelAdvisoriesLoaded } from '@/lib/safety/safety-service';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';
import { runOptimizerTask } from '@/lib/optimizer/run-queue';

export const dynamic = 'force-dynamic';

// Bump whenever the optimizer's output shape or selection logic changes, so results cached
// by an older build are not served after a deploy.
const OPTIMIZER_CACHE_VERSION = 'v16';

interface OptimizeResponsePayload {
  success: true;
  count: number;
  windows: CandidateWindow[];
}

// Identical searches arriving concurrently (double submit, a shared link opened by several
// family members at once) share one computation instead of each running the full optimizer.
const inFlight = new Map<string, Promise<OptimizeResponsePayload>>();

async function runOptimization(body: TripPlanInput): Promise<OptimizeResponsePayload> {
  const homeState = body.userProfile.federalState || 'DE-BW';

  // School calendars: the home region, every child's own school region (siblings can attend
  // schools in different states/countries), and each departure airport's state (arbitrage).
  const schoolStates = new Set<string>([homeState]);
  for (const region of body.userProfile.childrenSchoolRegions || []) {
    if (typeof region === 'string' && region.trim()) {
      schoolStates.add(region.trim().toUpperCase());
    }
  }
  // No airport selected = flexible search: the optimizer evaluates the airports around home
  const { departureLat, departureLon } = body.userProfile;
  const originCodes =
    body.userProfile.originAirports && body.userProfile.originAirports.length > 0
      ? body.userProfile.originAirports
      : departureLat != null && departureLon != null
      ? resolveFlexOriginAirports(departureLat, departureLon)
      : [];
  // Departure airports' regions only decide the cross-border/neighbor-state discount: there a
  // typical calendar is better than none (an unknown calendar would never grant the discount)
  const estimateStates = new Set<string>();
  for (const code of originCodes) {
    const airport = getAirportByIata(code);
    if (airport && airport.state) {
      if (!schoolStates.has(airport.state)) estimateStates.add(airport.state);
      schoolStates.add(airport.state);
    }
  }

  // Public holidays only drive the parents' PTO math, which follows the home region.
  const publicStates = new Set<string>([homeState]);

  // Determine all calendar years spanned by search window
  const startYear = parseInt(body.earliestDate.split('-')[0], 10) || 2026;
  const endYear = parseInt(body.latestDate.split('-')[0], 10) || startYear;
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  const schoolHolidaysByState: Record<string, any> = {};
  const publicHolidaysByState: Record<string, any> = {};

  // Parallelize all async I/O:
  // 1. School & public holiday fetches across states & years
  // 2. Target destinations validation
  // 3. Travel safety advisories ingestion into cache
  const schoolFetches = Array.from(schoolStates).map(async (state) => {
    const schoolLists = await Promise.all(
      years.map((y) => getSchoolHolidays(state, y, estimateStates.has(state) ? { allowEstimates: true } : undefined))
    );
    // Flatten and deduplicate holidays by unique key
    const schoolsMap = new Map<string, any>();
    schoolLists.flat().forEach((h) => {
      if (h && h.startDate && h.endDate) {
        schoolsMap.set(`${h.startDate}_${h.endDate}_${h.name}`, h);
      }
    });
    schoolHolidaysByState[state] = Array.from(schoolsMap.values());
  });
  const publicFetches = Array.from(publicStates).map(async (state) => {
    const publicLists = await Promise.all(years.map((y) => getPublicHolidays(state, y)));
    const publicsMap = new Map<string, any>();
    publicLists.flat().forEach((p) => {
      if (p && p.date && p.name) {
        publicsMap.set(`${p.date}_${p.name}`, p);
      }
    });
    publicHolidaysByState[state] = Array.from(publicsMap.values());
  });

  const destinationValidationPromise =
    body.targetDestinations && body.targetDestinations.length > 0
      ? (async () => {
          const { validateDestinationInput } = await import('@/lib/optimizer/destinations');
          await Promise.all(
            body.targetDestinations!.map(async (dest) => {
              try {
                await validateDestinationInput(dest, 'en');
              } catch {
                // Ignore pre-validation error and let optimizer handle offline fallback
              }
            })
          );
        })()
      : Promise.resolve();

  const safetyAdvisoriesPromise = ensureTravelAdvisoriesLoaded().catch(() => {});
  // When Europe's big source markets (DE, GB, FR, NL, ...) are on school holidays (prices, crowds)
  const sourceMarketsPromise = loadSourceMarketCalendars(years).catch(() => []);

  await Promise.all([
    ...schoolFetches,
    ...publicFetches,
    destinationValidationPromise,
    safetyAdvisoriesPromise,
  ]);
  const sourceMarketCalendars = await sourceMarketsPromise;

  // Run constraint satisfaction & multi-objective scoring
  const results = optimizeVacationWindows(
    body,
    schoolHolidaysByState,
    publicHolidaysByState,
    undefined,
    { sourceMarketCalendars }
  );

  return {
    success: true,
    count: results.length,
    windows: results,
  };
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitByClient(req, RATE_LIMITS.optimize);
  if (limited) return limited;
  try {
    const body: TripPlanInput = await req.json();

    if (!body.userProfile || !body.earliestDate || !body.latestDate || (!body.durationDays && !body.durationDaysMin)) {
      return NextResponse.json(
        { error: 'Invalid input. Missing mandatory parameters.' },
        { status: 400 }
      );
    }

    if (!body.durationDays && body.durationDaysMin) {
      body.durationDays = body.durationDaysMin;
    }

    // Check Valkey / Dragonfly cache for instant result output
    const queryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    const cacheKey = `famvac:opt:${OPTIMIZER_CACHE_VERSION}:${queryHash}`;

    // A first-tier search whose full (extended) result is already cached gets that one right away:
    // the client then skips its background phase instead of swapping the list a moment later
    if (!body.discoveryScope && !body.targetDestinations?.length) {
      const extendedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ ...body, discoveryScope: 'extended' }))
        .digest('hex');
      const cachedExtended = await getCached<OptimizeResponsePayload>(`famvac:opt:${OPTIMIZER_CACHE_VERSION}:${extendedHash}`);
      if (cachedExtended) {
        return NextResponse.json(cachedExtended, {
          headers: {
            'X-Famvac-Cache': 'HIT',
            'X-Famvac-Scope': 'extended',
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=30',
          },
        });
      }
    }

    const cachedResults = await getCached<OptimizeResponsePayload>(cacheKey);
    if (cachedResults) {
      return NextResponse.json(cachedResults, {
        headers: {
          'X-Famvac-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=30',
        },
      });
    }

    let pending = inFlight.get(cacheKey);
    const isCoalesced = Boolean(pending);
    if (!pending) {
      // One computation at a time per process (memory peaks, see run-queue.ts); identical
      // searches still share it through inFlight.
      pending = runOptimizerTask(
        () => runOptimization(body),
        // Background discovery waits behind anyone still waiting for their first results
        body.discoveryScope === 'extended' ? 'low' : 'high'
      ).then(async (payload) => {
        // Cache computed results in Valkey for 10 minutes (600s)
        await setCached(cacheKey, payload, 600).catch(() => {});
        return payload;
      });
      inFlight.set(cacheKey, pending);
      pending.finally(() => inFlight.delete(cacheKey)).catch(() => {});
    }

    const responsePayload = await pending;

    return NextResponse.json(responsePayload, {
      headers: {
        'X-Famvac-Cache': isCoalesced ? 'COALESCED' : 'MISS',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    console.error('[API /api/vacations/optimize] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize vacation windows' },
      { status: 500 }
    );
  }
}
