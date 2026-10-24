import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSharedBoardPrisma } from '../helpers/fake-shared-board-prisma';

const fakePrisma = createFakeSharedBoardPrisma();
vi.mock('@/lib/db/prisma', () => ({ prisma: fakePrisma }));

const { POST, GET } = await import('@/app/api/vacations/share/route');

const mockWindows = [
  {
    startDate: '2026-08-01',
    endDate: '2026-08-11',
    originAirport: 'TXL',
    destinationAirport: 'PMI',
    destinationName: 'Palma de Mallorca',
    estimatedTotalCost: 1450,
    finalScore: 83.5,
  },
];

const piiLadenBody = {
  query: {
    targetDestinations: ['PMI'],
    earliestDate: '2026-08-01',
    latestDate: '2026-08-20',
    searchBlackouts: [{ startDate: '2026-08-05', endDate: '2026-08-06', reason: 'Grandma surgery' }],
    userProfile: {
      homeLocation: '123 Privacy Lane, Berlin',
      departureLat: 52.52,
      departureLon: 13.405,
      federalState: 'DE-BE',
      originAirports: ['TXL'],
      adults: 2,
      childrenAges: [8],
      childrenBirthDates: ['2018-03-15'],
      childrenSchoolRegions: ['DE-BE'],
      blackoutRanges: [{ startDate: '2026-08-05', endDate: '2026-08-06', reason: 'Grandma surgery' }],
      preferredCabinClass: 'ECONOMY',
      travelModes: ['PLANE'],
      maxFlightStops: 1,
    },
  },
  formState: {
    departureLocation: '123 Privacy Lane, Berlin',
    departureCoords: { lat: 52.52, lon: 13.405 },
    earliestDate: '2026-08-01',
    federalState: 'DE-BE',
    childrenList: [{ id: 'c1', birthDate: '2018-03-15', schoolRegion: 'DE-BE' }],
  },
  windows: mockWindows,
};

describe('Vacations Share API - PII sanitization', () => {
  beforeEach(() => {
    fakePrisma.__state.boards.clear();
    fakePrisma.__state.candidates.clear();
  });

  it('never stores or serves exact home address, GPS, birthdates, or blackout reasons', async () => {
    const postRes = await POST(
      new NextRequest('http://localhost:3000/api/vacations/share', {
        method: 'POST',
        body: JSON.stringify(piiLadenBody),
      })
    );
    expect(postRes.status).toBe(200);
    const { shareId } = await postRes.json();

    const getRes = await GET(new NextRequest(`http://localhost:3000/api/vacations/share?id=${shareId}`));
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const serialized = JSON.stringify(getData);

    // PII that must never leave the owner's browser
    expect(serialized).not.toContain('Privacy Lane');
    expect(serialized).not.toContain('52.52');
    expect(serialized).not.toContain('13.405');
    expect(serialized).not.toContain('2018-03-15');
    expect(serialized).not.toContain('Grandma surgery');
    expect(serialized).not.toContain('homeLocation');
    expect(serialized).not.toContain('departureLat');
    expect(serialized).not.toContain('departureLon');
    expect(serialized).not.toContain('childrenBirthDates');
    expect(serialized).not.toContain('childrenSchoolRegions');

    // Derived/non-identifying data should survive
    expect(getData.payload.query.userProfile.federalState).toBe('DE-BE');
    expect(getData.payload.query.userProfile.originAirports).toEqual(['TXL']);
    expect(getData.payload.query.userProfile.childAgesAtDeparture).toEqual([8]);
    expect(getData.payload.query.searchBlackouts).toEqual([{ startDate: '2026-08-05', endDate: '2026-08-06' }]);
    expect(getData.payload.formState.childAgesAtDeparture).toEqual([8]);
  });

  it('also sanitizes the cache-only payload when the database is unreachable', async () => {
    const upsert = vi
      .spyOn(fakePrisma.sharedTripBoard, 'upsert')
      .mockRejectedValueOnce(new Error("Can't reach database server"));

    const postRes = await POST(
      new NextRequest('http://localhost:3000/api/vacations/share', {
        method: 'POST',
        body: JSON.stringify(piiLadenBody),
      })
    );
    const { shareId } = await postRes.json();
    upsert.mockRestore();

    // Cache-only boards are served straight from Redis (no Postgres row) - the cached copy
    // written during POST must already be sanitized, same as the database-backed path.
    const getRes = await GET(new NextRequest(`http://localhost:3000/api/vacations/share?id=${shareId}`));
    const serialized = JSON.stringify(await getRes.json());
    expect(serialized).not.toContain('Privacy Lane');
    expect(serialized).not.toContain('2018-03-15');
    expect(serialized).not.toContain('Grandma surgery');
  });
});
