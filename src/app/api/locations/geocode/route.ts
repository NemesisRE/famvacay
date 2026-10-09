import { NextRequest, NextResponse } from 'next/server';
import { geocodeLocation } from '@/lib/geo/geocoding';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, locations: [] });
    }

    const locations = await geocodeLocation(query);
    return NextResponse.json({
      success: true,
      count: locations.length,
      locations,
    });
  } catch (error: any) {
    console.error('[API /api/locations/geocode] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to geocode location' },
      { status: 500 }
    );
  }
}

