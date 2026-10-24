import { vi } from 'vitest';

/**
 * Minimal in-memory fake of the Prisma methods used by the trip-sharing route
 * (SharedTripBoard / SharedCandidate), so it can be unit-tested
 * without a live Postgres connection.
 */
export interface FakeBoard {
  id: string;
  shortCode: string;
  familyProfileId: string | null;
  searchParams: any;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface FakeCandidate {
  id: string;
  boardId: string;
  destinationCode: string;
  startDate: Date;
  endDate: Date;
  snapshotData: any;
}

export function createFakeSharedBoardPrisma() {
  const boards = new Map<string, FakeBoard>();
  const candidates = new Map<string, FakeCandidate>();
  let seq = 0;

  return {
    __state: { boards, candidates },
    sharedTripBoard: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = boards.get(where.shortCode);
        if (existing) {
          const updated = { ...existing, ...update };
          boards.set(where.shortCode, updated);
          return updated;
        }
        const record: FakeBoard = {
          id: `board-${++seq}`,
          shortCode: where.shortCode,
          familyProfileId: create.familyProfileId ?? null,
          searchParams: create.searchParams,
          expiresAt: create.expiresAt ?? null,
          createdAt: new Date(),
        };
        boards.set(where.shortCode, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const board = boards.get(where.shortCode);
        if (!board) return null;
        if (!include?.candidates) return board;
        return { ...board, candidates: Array.from(candidates.values()).filter((c) => c.boardId === board.id) };
      }),
    },
    sharedCandidate: {
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const [id, c] of candidates) {
          if (c.boardId === where.boardId) {
            candidates.delete(id);
            count++;
          }
        }
        return { count };
      }),
      create: vi.fn(async ({ data }: any) => {
        const record: FakeCandidate = { id: `cand-${++seq}`, ...data };
        candidates.set(record.id, record);
        return record;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
  };
}
