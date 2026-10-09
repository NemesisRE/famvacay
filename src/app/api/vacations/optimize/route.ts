import { NextRequest, NextResponse } from 'next/server';
import { TripPlanInput } from '@/lib/optimizer/types';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { getSchoolHolidays, getPublicHolidays } from '@/lib/integrations/open-holidays';
import { getAirportByIata } from '@/lib/airports/airport-service';
import { SUPPORTED_ORIGIN_AIRPORTS } from '@/lib/optimizer/arbitrage';

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

    const homeState = body.userProfile.federalState || 'DE-BW';
    const statesToFetch = new Set<string>([homeState]);

    // Add states for all selected origin airports to enable arbitrage discovery
    for (const code of body.userProfile.originAirports || []) {
      const airport = getAirportByIata(code) || SUPPORTED_ORIGIN_AIRPORTS[code];
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

    // Parallel fetch school and public holidays for states across all spanned years
    const schoolHolidaysByState: Record<string, any> = {};
    const publicHolidaysByState: Record<string, any> = {};

    await Promise.all(
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

    // Run constraint satisfaction & multi-objective scoring
    const results = optimizeVacationWindows(
      body,
      schoolHolidaysByState,
      publicHolidaysByState
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      windows: results,
    });
  } catch (error: any) {
    console.error('[API /api/vacations/optimize] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize vacation windows' },
      { status: 500 }
    );
  }
}

