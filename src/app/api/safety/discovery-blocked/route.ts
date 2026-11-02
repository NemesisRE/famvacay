import { NextResponse } from 'next/server';
import { ensureTravelAdvisoriesLoaded } from '@/lib/safety/safety-service';
import { getCountriesBlockedFromDiscovery } from '@/lib/safety/advisory-store';

export const dynamic = 'force-dynamic';

/**
 * Countries flex search never proposes because of travel advisories (pointless to exclude by hand).
 * `?home=DE` adds the traveller's own government's warnings, as the search itself does.
 */
export async function GET(request: Request) {
  await ensureTravelAdvisoriesLoaded().catch(() => {});
  const home = new URL(request.url).searchParams.get('home') || '';
  return NextResponse.json(
    { countries: getCountriesBlockedFromDiscovery(/^[A-Za-z]{2}$/.test(home) ? home.toUpperCase() : undefined) },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
