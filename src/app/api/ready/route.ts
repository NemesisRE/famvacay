import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkCacheHealth } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

/**
 * Readiness Probe: GET /api/ready
 * Verifies that required dependencies (PostgreSQL database & Redis/Valkey cache)
 * are reachable and ready to process application requests.
 * Sanitized response: Zero internal connection strings or stack traces leaked.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = 'healthy';

  // 1. Check Database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unreachable';
  }

  // 2. Check Cache connection. A cache outage is reported accurately but
  // doesn't flip overall readiness to 503: the app has a working in-memory
  // fallback (see src/lib/cache/redis.ts) and can still serve traffic
  // without Valkey, just without cross-instance/persistent caching.
  const cacheStatus = await checkCacheHealth();

  const isReady = dbStatus === 'healthy';

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      timestamp,
      checks: {
        database: dbStatus,
        cache: cacheStatus,
      },
    },
    { status: isReady ? 200 : 503 }
  );
}

