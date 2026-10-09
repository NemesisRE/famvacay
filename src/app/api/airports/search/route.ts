import { NextRequest, NextResponse } from 'next/server';
import { getRecommendedAirportsForCoordinates, searchAirports } from '@/lib/airports/airport-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');

    let userCoords: { lat: number; lon: number } | undefined;
    if (latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (!isNaN(lat) && !isNaN(lon)) {
        userCoords = { lat, lon };
      }
    }

    if (query && query.trim().length >= 1) {
      const results = searchAirports(query, userCoords, 15);
      return NextResponse.json({
        success: true,
        count: results.length,
        airports: results,
      });
    }

    const destinationsParam = searchParams.get('destinations');
    const targetDestinations = destinationsParam
      ? destinationsParam.split(',').map((d) => d.trim()).filter(Boolean)
      : undefined;

    if (userCoords) {
      const recommended = getRecommendedAirportsForCoordinates(
        userCoords.lat,
        userCoords.lon,
        380,
        targetDestinations
      );
      return NextResponse.json({
        success: true,
        count: recommended.length,
        airports: recommended,
      });
    }

    // Default fallback to major central hubs if no coords or query
    const defaultHubs = searchAirports('DE', undefined, 10);
    return NextResponse.json({
      success: true,
      count: defaultHubs.length,
      airports: defaultHubs,
    });
  } catch (error: any) {
    console.error('[API /api/airports/search] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search airports' },
      { status: 500 }
    );
  }
}

