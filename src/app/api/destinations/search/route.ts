import { NextRequest, NextResponse } from 'next/server';
import { searchGlobalPlaces } from '@/lib/geo/places';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const locale = searchParams.get('locale') || 'en';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        count: 0,
        destinations: [],
      });
    }

    const destinations = await searchGlobalPlaces(query.trim(), locale, limit);

    // Cache resolved entities into dynamicDestinationEntityCache for synchronous optimizer queries
    const { dynamicDestinationEntityCache, normalizeDestinationString } = await import('@/lib/optimizer/destinations');
    for (const d of destinations) {
      if (d && d.airportCodes && d.airportCodes.length > 0) {
        const ent = {
          id: d.id,
          category: d.category as any,
          code: d.airportCodes[0],
          parentRegionId: d.parentRegionId,
          aliases: d.aliases,
          airportCodes: d.airportCodes,
          countryCode: d.countryCode,
          names: d.names || { en: d.name, de: d.name, fr: d.name, es: d.name, it: d.name },
          countryNames: { en: d.countryName, de: d.countryName, fr: d.countryName, es: d.countryName, it: d.countryName },
        };
        dynamicDestinationEntityCache.set(normalizeDestinationString(d.name), ent);
        dynamicDestinationEntityCache.set(normalizeDestinationString(d.id), ent);
        dynamicDestinationEntityCache.set(normalizeDestinationString(query.trim()), ent);
      }
    }

    return NextResponse.json({
      success: true,
      count: destinations.length,
      destinations,
    });
  } catch (error: any) {
    console.error('[API /api/destinations/search] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to search destinations' },
      { status: 500 }
    );
  }
}

