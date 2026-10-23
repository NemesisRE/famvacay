import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocodeLocation } from '@/lib/geo/geocoding';

export const dynamic = 'force-dynamic';

/** Town for a coordinate pair (the browser's location): GET ?lat=..&lon=..&locale=de */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }
  const location = await reverseGeocodeLocation(lat, lon, params.get('locale') || 'en');
  if (!location) {
    return NextResponse.json({ success: false, location: null }, { status: 404 });
  }
  return NextResponse.json({ success: true, location });
}
