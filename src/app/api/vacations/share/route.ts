import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCached, setCached } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, formState, windows } = body;

    if (!Array.isArray(windows) || windows.length === 0) {
      return NextResponse.json(
        { error: 'Cannot create shareable state for empty result set.' },
        { status: 400 }
      );
    }

    // Generate a deterministic or random URL-safe compact share ID
    const seed = JSON.stringify({
      destinations: query?.targetDestinations || formState?.targetDestinations,
      origin: query?.userProfile?.originAirports || formState?.originAirports,
      earliest: query?.earliestDate || formState?.earliestDate,
      duration: query?.durationDays || formState?.durationDaysMin,
      count: windows.length,
      firstWin: windows[0]?.startDate + '_' + windows[0]?.destinationAirport,
    });

    const contentHash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 10);
    const shareId = `s_${contentHash}`;
    const cacheKey = `famvac:share:${shareId}`;

    const payload = {
      shareId,
      createdAt: new Date().toISOString(),
      query: query || null,
      formState: formState || null,
      count: windows.length,
      windows,
    };

    // Cache in Redis/Valkey for 30 days (2,592,000 seconds)
    await setCached(cacheKey, payload, 2592000).catch((err) => {
      console.warn('[Share API] Cache write warning:', err);
    });

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl: `/?s=${shareId}`,
      count: windows.length,
    });
  } catch (error: any) {
    console.error('[API /api/vacations/share POST Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to persist shareable state' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || searchParams.get('s');

    if (!id) {
      return NextResponse.json(
        { error: 'Share ID parameter is required.' },
        { status: 400 }
      );
    }

    const cleanId = id.startsWith('s_') ? id : `s_${id}`;
    const cacheKey = `famvac:share:${cleanId}`;

    const cached = await getCached<any>(cacheKey);
    if (!cached) {
      return NextResponse.json(
        { error: 'Shared search results not found or expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payload: cached,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=60',
      },
    });
  } catch (error: any) {
    console.error('[API /api/vacations/share GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve shared state' },
      { status: 500 }
    );
  }
}

