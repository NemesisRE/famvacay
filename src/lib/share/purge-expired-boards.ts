import { prisma } from '@/lib/db/prisma';

/**
 * Deletes shared boards past their expiry date (30 days after the last share), together with
 * their candidates and votes (cascading foreign keys). Expired boards were already hidden from
 * readers; this keeps the retention promise in the privacy policy. Runs hourly in every server
 * process - deleting is idempotent, so concurrent replicas don't need a lease.
 */
const FIRST_RUN_MS = 2 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

interface BoardDb {
  sharedTripBoard: {
    deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<{ count: number }>;
  };
}

export async function purgeExpiredBoards(db: BoardDb = prisma, now = new Date()): Promise<number> {
  const { count } = await db.sharedTripBoard.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}

export function startExpiredBoardPurge(): void {
  const g = globalThis as unknown as { __famvacayBoardPurge?: boolean };
  if (g.__famvacayBoardPurge) return;
  g.__famvacayBoardPurge = true;

  const run = async () => {
    try {
      const count = await purgeExpiredBoards();
      if (count > 0) console.log(`[share] deleted ${count} expired shared board(s)`);
    } catch (err) {
      console.warn('[share] could not delete expired shared boards:', (err as Error)?.message || err);
    }
  };
  setTimeout(run, FIRST_RUN_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
}
