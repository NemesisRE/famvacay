import { NextResponse } from 'next/server';
import { ensureTravelAdvisoriesLoaded } from '@/lib/safety/safety-service';
import { getCountriesBlockedFromDiscovery } from '@/lib/safety/advisory-store';

export const dynamic = 'force-dynamic';

/** Countries flex search never proposes because of travel advisories (pointless to exclude by hand) */
export async function GET() {
  await ensureTravelAdvisoriesLoaded().catch(() => {});
  return NextResponse.json(
    { countries: getCountriesBlockedFromDiscovery() },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
