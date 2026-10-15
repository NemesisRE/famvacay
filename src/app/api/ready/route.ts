import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/cache/redis';

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
  let cacheStatus = 'healthy';

  // 1. Check Database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unreachable';
  }

  // 2. Check Cache connection
  try {
    if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        cacheStatus = 'degraded';
      }
    } else {
      cacheStatus = 'degraded';
    }
  } catch {
    cacheStatus = 'unreachable';
  }

  const isReady = dbStatus === 'healthy' && (cacheStatus === 'healthy' || cacheStatus === 'degraded');

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

