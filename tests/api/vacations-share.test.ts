import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSharedBoardPrisma } from '../helpers/fake-shared-board-prisma';

const fakePrisma = createFakeSharedBoardPrisma();
vi.mock('@/lib/db/prisma', () => ({ prisma: fakePrisma }));

const { POST, GET } = await import('@/app/api/vacations/share/route');

describe('Vacations Share API - Persist & Hydrate', () => {
  beforeEach(() => {
    fakePrisma.__state.boards.clear();
    fakePrisma.__state.candidates.clear();
    fakePrisma.__state.votes.clear();
  });

  const mockWindows = [
    {
      startDate: '2026-08-01',
      endDate: '2026-08-11',
      durationDays: 10,
      originAirport: 'STR',
      destinationAirport: 'PMI',
      destinationName: 'Palma de Mallorca',
      estimatedTotalCost: 1450,
      pricePerPerson: 725,
      totalWeekdays: 8,
      publicHolidaysCount: 0,
      ptoDaysConsumed: 8,
      ptoEfficiencyRatio: 1.25,
      weather: { avgTempC: 30, precipitationRiskPercent: 5, isSuitable: true },
      isArbitrageOpportunity: false,
      isCachedBenchmark: false,
      scoreBreakdown: { priceIndex: 85, weatherIndex: 90, ptoEfficiencyIndex: 75, travelFrictionIndex: 80 },
      finalScore: 83.5,
    },
  ];

  it('rejects POST with empty windows array', async () => {
    const req = new NextRequest('http://localhost:3000/api/vacations/share', {
      method: 'POST',
      body: JSON.stringify({ windows: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('persists search result state and returns unique shareId', async () => {
    const req = new NextRequest('http://localhost:3000/api/vacations/share', {
      method: 'POST',
      body: JSON.stringify({
        query: { targetDestinations: ['PMI'], earliestDate: '2026-08-01', latestDate: '2026-08-20' },
        formState: { destination: 'PMI' },
        windows: mockWindows,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.shareId).toBeDefined();
    expect(data.shareId.startsWith('s_')).toBe(true);
    expect(data.shareUrl).toBe(`/?s=${data.shareId}`);
  });

  it('retrieves stored search results by shareId', async () => {
    // 1. First save
    const postReq = new NextRequest('http://localhost:3000/api/vacations/share', {
      method: 'POST',
      body: JSON.stringify({
        query: { targetDestinations: ['PMI'] },
        windows: mockWindows,
      }),
    });
    const postRes = await POST(postReq);
    const postData = await postRes.json();
    const shareId = postData.shareId;

    // 2. Fetch via GET
    const getReq = new NextRequest(`http://localhost:3000/api/vacations/share?id=${shareId}`, {
      method: 'GET',
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);

    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.payload.windows).toHaveLength(1);
    expect(getData.payload.windows[0].destinationAirport).toBe('PMI');
  });

  it('still creates a working link from the cache when the database is unreachable', async () => {
    const upsert = vi.spyOn(fakePrisma.sharedTripBoard, 'upsert').mockRejectedValueOnce(new Error("Can't reach database server"));
    const res = await POST(
      new NextRequest('http://localhost:3000/api/vacations/share', {
        method: 'POST',
        body: JSON.stringify({ query: { earliestDate: '2031-01-01' }, formState: { x: 1 }, windows: mockWindows }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareId).toMatch(/^s_/);
    expect(data.votingEnabled).toBe(false);

    const read = await GET(new NextRequest(`http://localhost:3000/api/vacations/share?id=${data.shareId}`));
    expect(read.status).toBe(200);
    const body = await read.json();
    expect(body.payload.windows).toHaveLength(1);
    upsert.mockRestore();
  });

  it('delivers every window with its candidate id, also from the cache (voting needs it)', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/vacations/share', {
        method: 'POST',
        body: JSON.stringify({ query: { earliestDate: '2032-01-01' }, formState: { y: 1 }, windows: mockWindows }),
      })
    );
    const { shareId } = await res.json();
    const read = await GET(new NextRequest(`http://localhost:3000/api/vacations/share?id=${shareId}`));
    const body = await read.json();
    expect(body.payload.windows[0].shareCandidateId).toBe(body.payload.candidateIds[0]);
    expect(body.payload.windows[0].shareCandidateId).toBeTruthy();
  });

  it('returns 404 for non-existent shareId', async () => {
    const getReq = new NextRequest('http://localhost:3000/api/vacations/share?id=non_existent_id_99999', {
      method: 'GET',
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(404);
  });
});

