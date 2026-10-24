import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSharedBoardPrisma } from '../../../../tests/helpers/fake-shared-board-prisma';

const fakePrisma = createFakeSharedBoardPrisma();

vi.mock('@/lib/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
}));

describe('Persistent trip sharing & voting', () => {
  beforeEach(() => {
    fakePrisma.__state.boards.clear();
    fakePrisma.__state.candidates.clear();
    fakePrisma.__state.votes.clear();
  });

  it('creates a SharedTripBoard with SharedCandidate rows on POST /api/vacations/share', async () => {
    const { POST } = await import('../../../app/api/vacations/share/route');

    const windows = [
      { destinationAirport: 'PMI', startDate: '2026-08-03', endDate: '2026-08-10', estimatedTotalCost: 1800 },
      { destinationAirport: 'AYT', startDate: '2026-08-05', endDate: '2026-08-12', estimatedTotalCost: 1600 },
    ];

    const req = { json: async () => ({ query: { earliestDate: '2026-08-01' }, formState: null, windows }) } as any;
    const res: any = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(fakePrisma.__state.boards.size).toBe(1);
    expect(fakePrisma.__state.candidates.size).toBe(2);

    const board = Array.from(fakePrisma.__state.boards.values())[0];
    expect(board.shortCode).toBe(body.shareId);
    for (const candidate of fakePrisma.__state.candidates.values()) {
      expect(candidate.boardId).toBe(board.id);
    }
    // The first dynamic import of the route loads its whole module graph, which can exceed the
    // default 5s under a busy full-suite run
  }, 30_000);

  it('rejects an empty candidate list', async () => {
    const { POST } = await import('../../../app/api/vacations/share/route');
    const req = { json: async () => ({ query: {}, formState: null, windows: [] }) } as any;
    const res: any = await POST(req);
    expect(res.status).toBe(400);
  });

  it('records a vote and returns an updated tally', async () => {
    const shareRoute = await import('../../../app/api/vacations/share/route');
    const voteRoute = await import('../../../app/api/vacations/share/[shortCode]/vote/route');

    const windows = [
      { destinationAirport: 'PMI', startDate: '2026-08-03', endDate: '2026-08-10', estimatedTotalCost: 1800 },
    ];
    const createReq = { json: async () => ({ query: {}, formState: null, windows }) } as any;
    const createRes: any = await shareRoute.POST(createReq);
    const createBody = await createRes.json();
    const shortCode = createBody.shareId as string;

    const candidateId = Array.from(fakePrisma.__state.candidates.values())[0].id;

    const voteReq = {
      json: async () => ({ candidateId, voterName: 'Mom', vote: 2, comment: 'Love this one!' }),
    } as any;
    const voteRes: any = await voteRoute.POST(voteReq, { params: Promise.resolve({ shortCode }) });
    const voteBody = await voteRes.json();

    expect(voteBody.success).toBe(true);
    expect(voteBody.vote).toMatchObject({ voterName: 'Mom', vote: 2, comment: 'Love this one!' });
    expect(voteBody.tally).toEqual({ upvotes: 0, favorites: 1, vetoes: 0 });
  });

  it('upserts (replaces) a repeat vote from the same voter instead of duplicating it', async () => {
    const shareRoute = await import('../../../app/api/vacations/share/route');
    const voteRoute = await import('../../../app/api/vacations/share/[shortCode]/vote/route');

    const windows = [
      { destinationAirport: 'PMI', startDate: '2026-08-03', endDate: '2026-08-10', estimatedTotalCost: 1800 },
    ];
    const createRes: any = await shareRoute.POST({ json: async () => ({ query: {}, formState: null, windows }) } as any);
    const { shareId: shortCode } = await createRes.json();
    const candidateId = Array.from(fakePrisma.__state.candidates.values())[0].id;

    await voteRoute.POST(
      { json: async () => ({ candidateId, voterName: 'Dad', vote: 1 }) } as any,
      { params: Promise.resolve({ shortCode }) }
    );
    const secondRes: any = await voteRoute.POST(
      { json: async () => ({ candidateId, voterName: 'Dad', vote: -1 }) } as any,
      { params: Promise.resolve({ shortCode }) }
    );
    const secondBody = await secondRes.json();

    expect(fakePrisma.__state.votes.size).toBe(1);
    expect(secondBody.tally).toEqual({ upvotes: 0, favorites: 0, vetoes: 1 });
  });

  it('rejects a vote value outside {-1, 1, 2}', async () => {
    const shareRoute = await import('../../../app/api/vacations/share/route');
    const voteRoute = await import('../../../app/api/vacations/share/[shortCode]/vote/route');

    const windows = [
      { destinationAirport: 'PMI', startDate: '2026-08-03', endDate: '2026-08-10', estimatedTotalCost: 1800 },
    ];
    const createRes: any = await shareRoute.POST({ json: async () => ({ query: {}, formState: null, windows }) } as any);
    const { shareId: shortCode } = await createRes.json();
    const candidateId = Array.from(fakePrisma.__state.candidates.values())[0].id;

    const res: any = await voteRoute.POST(
      { json: async () => ({ candidateId, voterName: 'Dad', vote: 5 }) } as any,
      { params: Promise.resolve({ shortCode }) }
    );
    expect(res.status).toBe(400);
  });
});
