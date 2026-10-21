import { vi } from 'vitest';

/**
 * Minimal in-memory fake of the Prisma methods used by the trip-sharing & voting routes
 * (SharedTripBoard / SharedCandidate / CandidateVote), so these routes can be unit-tested
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

export interface FakeVote {
  id: string;
  candidateId: string;
  voterName: string;
  vote: number;
  comment: string | null;
}

export function createFakeSharedBoardPrisma() {
  const boards = new Map<string, FakeBoard>();
  const candidates = new Map<string, FakeCandidate>();
  const votes = new Map<string, FakeVote>();
  let seq = 0;

  return {
    __state: { boards, candidates, votes },
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
        const boardCandidates = Array.from(candidates.values()).filter((c) => c.boardId === board.id);
        return {
          ...board,
          candidates: boardCandidates.map((c) => ({
            ...c,
            votes: Array.from(votes.values()).filter((v) => v.candidateId === c.id),
          })),
        };
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
      findFirst: vi.fn(async ({ where }: any) => {
        return Array.from(candidates.values()).find((c) => c.id === where.id && c.boardId === where.boardId) || null;
      }),
    },
    candidateVote: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.candidateId_voterName.candidateId}|${where.candidateId_voterName.voterName}`;
        const existing = votes.get(key);
        const record: FakeVote = existing
          ? { ...existing, ...update }
          : { id: `vote-${++seq}`, ...create };
        votes.set(key, record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return Array.from(votes.values()).filter((v) => v.candidateId === where.candidateId);
      }),
    },
    $transaction: vi.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
  };
}
