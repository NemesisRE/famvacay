import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSharedBoardPrisma } from '../../../../tests/helpers/fake-shared-board-prisma';

const fakePrisma = createFakeSharedBoardPrisma();

vi.mock('@/lib/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => {}),
}));

describe('Persistent trip sharing', () => {
  beforeEach(() => {
    fakePrisma.__state.boards.clear();
    fakePrisma.__state.candidates.clear();
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
});
