import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { TripPlanInput } from '@/lib/optimizer/types';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { getSchoolHolidays, getPublicHolidays } from '@/lib/integrations/open-holidays';
import { getAirportByIata } from '@/lib/airports/airport-service';
import { getCached, setCached } from '@/lib/cache/redis';
import { ensureTravelAdvisoriesLoaded } from '@/lib/safety/safety-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
    const cacheKey = `famvac:opt:${queryHash}`;

    const cachedResults = await getCached<any>(cacheKey);
    if (cachedResults) {
      return NextResponse.json(cachedResults, {
        headers: {
          'X-Famvac-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=30',
        },
      });
    }

    const homeState = body.userProfile.federalState || 'DE-BW';
    const statesToFetch = new Set<string>([homeState]);

    // Add states for all selected origin airports to enable arbitrage discovery
    for (const code of body.userProfile.originAirports || []) {
      const airport = getAirportByIata(code);
      if (airport && airport.state) {
        statesToFetch.add(airport.state);
      }
    }

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
    const holidayFetchPromise = Promise.all(
      Array.from(statesToFetch).map(async (state) => {
        const schoolLists = await Promise.all(years.map((y) => getSchoolHolidays(state, y)));
        const publicLists = await Promise.all(years.map((y) => getPublicHolidays(state, y)));

        // Flatten and deduplicate holidays by unique key
        const schoolsMap = new Map<string, any>();
        schoolLists.flat().forEach((h) => {
          if (h && h.startDate && h.endDate) {
            schoolsMap.set(`${h.startDate}_${h.endDate}_${h.name}`, h);
          }
        });

        const publicsMap = new Map<string, any>();
        publicLists.flat().forEach((p) => {
          if (p && p.date && p.name) {
            publicsMap.set(`${p.date}_${p.name}`, p);
          }
        });

        schoolHolidaysByState[state] = Array.from(schoolsMap.values());
        publicHolidaysByState[state] = Array.from(publicsMap.values());
      })
    );

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

    await Promise.all([
      holidayFetchPromise,
      destinationValidationPromise,
      safetyAdvisoriesPromise,
    ]);

    // Run constraint satisfaction & multi-objective scoring
    const results = optimizeVacationWindows(
      body,
      schoolHolidaysByState,
      publicHolidaysByState
    );

    const responsePayload = {
      success: true,
      count: results.length,
      windows: results,
    };

    // Cache computed results in Valkey for 10 minutes (600s)
    await setCached(cacheKey, responsePayload, 600).catch(() => {});

    return NextResponse.json(responsePayload, {
      headers: {
        'X-Famvac-Cache': 'MISS',
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

