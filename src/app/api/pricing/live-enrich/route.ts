import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { getConfiguredLivePricingProvider } from '@/lib/pricing/pricing-service';
import { AggregatedTripPricing } from '@/lib/pricing/types';

export const dynamic = 'force-dynamic';

const LIVE_PRICE_TTL_SECONDS = 86400; // 24h

/**
 * POST /api/pricing/live-enrich
 * After the deterministic CSP optimizer renders benchmark results, the client asynchronously
 * requests live price enrichment for the top visible cards. If a BYOK provider (Amadeus /
 * Tequila) is configured via env vars, attempts a live quote; otherwise silently returns
 * `live: false` so the UI keeps the benchmark price with no error shown to the user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originAirport, destinationAirport, startDate, endDate, durationDays, party, isArbitrage, preferredBoardType } = body;

    if (!originAirport || !destinationAirport || !startDate || !endDate || !party) {
      return NextResponse.json({ error: 'Missing mandatory parameters.' }, { status: 400 });
    }

    const paxSignature = `${party.adults || 2}a-${(party.childrenAges || []).join(',')}c-${party.cabinClass || 'ECONOMY'}`;
    const cacheKey = `liveprice:${originAirport}:${destinationAirport}:${startDate}:${endDate}:${paxSignature}`;

    const cached = await getCached<AggregatedTripPricing>(cacheKey).catch(() => null);
    if (cached) {
      return NextResponse.json({ success: true, live: true, cached: true, pricing: cached });
    }

    const provider = getConfiguredLivePricingProvider();
    if (!provider) {
      // No BYOK keys configured - silently keep the benchmark price, no error.
      return NextResponse.json({ success: true, live: false });
    }

    const pricing = await provider.getTripPricing({
      originAirport,
      destinationAirport,
      startDate,
      endDate,
      durationDays: durationDays || 7,
      party,
      isArbitrage,
      preferredBoardType,
    });

    // Only surface as "live" when the provider actually returned a non-benchmark quote.
    const isLive = pricing.providerSource !== 'PortalAggregator' && !pricing.isCachedBenchmark;

    await setCached(cacheKey, pricing, LIVE_PRICE_TTL_SECONDS).catch(() => {});

    return NextResponse.json({ success: true, live: isLive, cached: false, pricing });
  } catch (error: any) {
    // Live enrichment must never block or crash the core CSP optimizer / UI.
    console.warn('[API /api/pricing/live-enrich] Error:', error);
    return NextResponse.json({ success: true, live: false });
  }
}
