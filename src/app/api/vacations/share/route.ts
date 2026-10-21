import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCached, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const BOARD_TTL_SECONDS = 2592000; // 30 days
const CACHE_TTL_SECONDS = 3600; // 1h read-through cache on top of Postgres source of truth

interface SharedBoardPayload {
  shortCode: string;
  createdAt: string;
  expiresAt: string | null;
  query: any;
  formState: any;
  count: number;
  windows: any[];
  candidateIds: string[]; // SharedCandidate.id, aligned 1:1 with `windows`
}

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

    // Generate a deterministic, content-addressed short code (stable across identical re-shares)
    const seed = JSON.stringify({
      destinations: query?.targetDestinations || formState?.targetDestinations,
      origin: query?.userProfile?.originAirports || formState?.originAirports,
      earliest: query?.earliestDate || formState?.earliestDate,
      duration: query?.durationDays || formState?.durationDaysMin,
      count: windows.length,
      firstWin: `${windows[0]?.startDate}_${windows[0]?.destinationAirport}`,
    });
    const contentHash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 10);
    const shortCode = `s_${contentHash}`;

    const expiresAt = new Date(Date.now() + BOARD_TTL_SECONDS * 1000);

    const board = await prisma.sharedTripBoard.upsert({
      where: { shortCode },
      create: {
        shortCode,
        familyProfileId: query?.userProfile?.id || null,
        searchParams: { query: query || null, formState: formState || null },
        expiresAt,
      },
      update: {
        searchParams: { query: query || null, formState: formState || null },
        expiresAt,
      },
    });

    // Replace candidates on every (re-)share so the board always reflects the latest search
    await prisma.sharedCandidate.deleteMany({ where: { boardId: board.id } });

    const created = await prisma.$transaction(
      windows.map((win: any) =>
        prisma.sharedCandidate.create({
          data: {
            boardId: board.id,
            destinationCode: win.destinationAirport || 'UNKNOWN',
            startDate: new Date(win.startDate),
            endDate: new Date(win.endDate),
            snapshotData: win,
          },
        })
      )
    );

    const payload: SharedBoardPayload = {
      shortCode,
      createdAt: board.createdAt.toISOString(),
      expiresAt: board.expiresAt ? board.expiresAt.toISOString() : null,
      query: query || null,
      formState: formState || null,
      count: windows.length,
      windows,
      candidateIds: created.map((c) => c.id),
    };

    await setCached(`famvac:share:${shortCode}`, payload, CACHE_TTL_SECONDS).catch(() => {});

    return NextResponse.json({
      success: true,
      shareId: shortCode,
      shareUrl: `/?s=${shortCode}`,
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

    const shortCode = id.startsWith('s_') ? id : `s_${id}`;
    const cacheKey = `famvac:share:${shortCode}`;

    // Redis read-through cache in front of Postgres source of truth
    const cached = await getCached<SharedBoardPayload>(cacheKey).catch(() => null);
    if (cached) {
      return NextResponse.json(
        { success: true, payload: cached },
        { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=60', 'X-Famvac-Cache': 'HIT' } }
      );
    }

    const board = await prisma.sharedTripBoard.findUnique({
      where: { shortCode },
      include: { candidates: { include: { votes: true } } },
    });

    if (!board || (board.expiresAt && board.expiresAt < new Date())) {
      return NextResponse.json(
        { error: 'Shared search results not found or expired.' },
        { status: 404 }
      );
    }

    const searchParamsJson = (board.searchParams as any) || {};
    const payload: SharedBoardPayload = {
      shortCode: board.shortCode,
      createdAt: board.createdAt.toISOString(),
      expiresAt: board.expiresAt ? board.expiresAt.toISOString() : null,
      query: searchParamsJson.query ?? null,
      formState: searchParamsJson.formState ?? null,
      count: board.candidates.length,
      windows: board.candidates.map((c) => ({
        ...(c.snapshotData as any),
        shareCandidateId: c.id,
        votes: c.votes.map((v) => ({ voterName: v.voterName, vote: v.vote, comment: v.comment })),
      })),
      candidateIds: board.candidates.map((c) => c.id),
    };

    await setCached(cacheKey, payload, CACHE_TTL_SECONDS).catch(() => {});

    return NextResponse.json(
      { success: true, payload },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=60', 'X-Famvac-Cache': 'MISS' } }
    );
  } catch (error: any) {
    console.error('[API /api/vacations/share GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve shared state' },
      { status: 500 }
    );
  }
}
