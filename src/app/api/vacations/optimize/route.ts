import { NextRequest, NextResponse } from 'next/server';
import { TripPlanInput } from '@/lib/optimizer/types';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { getSchoolHolidays, getPublicHolidays } from '@/lib/integrations/open-holidays';
import { SUPPORTED_ORIGIN_AIRPORTS } from '@/lib/optimizer/arbitrage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body: TripPlanInput = await req.json();

    if (!body.userProfile || !body.earliestDate || !body.latestDate || !body.durationDays) {
      return NextResponse.json(
        { error: 'Invalid input. Missing mandatory parameters.' },
        { status: 400 }
      );
    }

    const homeState = body.userProfile.federalState || 'DE-BW';
    const statesToFetch = new Set<string>([homeState]);

    // Add states for all selected origin airports to enable arbitrage discovery
    for (const code of body.userProfile.originAirports || []) {
      const airport = SUPPORTED_ORIGIN_AIRPORTS[code];
      if (airport) {
        statesToFetch.add(airport.state);
      }
    }

    // Parallel fetch school and public holidays for states
    const schoolHolidaysByState: Record<string, any> = {};
    const publicHolidaysByState: Record<string, any> = {};

    await Promise.all(
      Array.from(statesToFetch).map(async (state) => {
        const [schools, publics] = await Promise.all([
          getSchoolHolidays(state),
          getPublicHolidays(state),
        ]);
        schoolHolidaysByState[state] = schools;
        publicHolidaysByState[state] = publics;
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

