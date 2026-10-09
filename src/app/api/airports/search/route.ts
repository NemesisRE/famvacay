import { NextRequest, NextResponse } from 'next/server';
import {
  getRecommendedAirportsForCoordinates,
  searchAirports,
  getAirportByIata,
  pruneStaleAirportsForCoordinates,
} from '@/lib/airports/airport-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');
    const locale = searchParams.get('locale') || 'en';
    const codesParam = searchParams.get('codes');
    const selectedParam = searchParams.get('selected');
    const destinationsParam = searchParams.get('destinations');

    // Batch lookup by codes (for chip synchronization)
    if (codesParam) {
      const codes = codesParam.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
      const airports = codes
        .map((code) => getAirportByIata(code, locale))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

      return NextResponse.json({
        success: true,
        count: airports.length,
        airports,
      });
    }

    let userCoords: { lat: number; lon: number } | undefined;
    if (latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (!isNaN(lat) && !isNaN(lon)) {
        userCoords = { lat, lon };
      }
    }

    if (query && query.trim().length >= 1) {
      const results = searchAirports(query, userCoords, 15, locale);
      return NextResponse.json({
        success: true,
        count: results.length,
        airports: results,
      });
    }

    const targetDestinations = destinationsParam
      ? destinationsParam.split(',').map((d) => d.trim()).filter(Boolean)
      : undefined;

    if (userCoords) {
      // If selected airports were passed, perform geodesic pruning & auto-recommendation
      if (selectedParam) {
        const selectedCodes = selectedParam.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
        const pruneResult = pruneStaleAirportsForCoordinates(
          selectedCodes,
          userCoords.lat,
          userCoords.lon,
          450,
          targetDestinations,
          locale
        );
        return NextResponse.json({
          success: true,
          count: pruneResult.recommendedReplacements.length,
          airports: pruneResult.recommendedReplacements,
          prunedCodes: pruneResult.prunedCodes,
          validCodes: pruneResult.validCodes,
          updatedSelection: pruneResult.updatedSelection,
        });
      }

      const recommended = getRecommendedAirportsForCoordinates(
        userCoords.lat,
        userCoords.lon,
        380,
        targetDestinations,
        locale
      );
      return NextResponse.json({
        success: true,
        count: recommended.length,
        airports: recommended,
      });
    }

    // Default fallback to major central hubs if no coords or query
    const defaultHubs = searchAirports('DE', undefined, 10, locale);
    return NextResponse.json({
      success: true,
      count: defaultHubs.length,
      airports: defaultHubs,
    });
  } catch (error: any) {
    console.error('[API /api/airports/search] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to search airports' },
      { status: 500 }
    );
  }
}
