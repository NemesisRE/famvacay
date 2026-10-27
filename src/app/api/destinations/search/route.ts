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

    // Suggestions only: nothing is written to the optimizer's destination cache here. Caching every
    // suggestion under the typed text let the last one win ("Oberhof" became a village in Poland,
    // "Amsterdam" the City of Amsterdam, NY) - for everyone on this server. The optimizer resolves
    // the destination the user actually added on its own (validateDestinationInput).
    const destinations = await searchGlobalPlaces(query.trim(), locale, limit);

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

