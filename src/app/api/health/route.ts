import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';

  // Check Database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = `degraded (${err.message || 'connection failed'})`;
  }

  // Check Redis connection
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const ping = await redis.ping();
      if (ping !== 'PONG') {
        redisStatus = 'degraded';
      }
    } else {
      redisStatus = `degraded (status: ${redis.status})`;
    }
  } catch (err: any) {
    redisStatus = 'fallback-in-memory';
  }

  const isHealthy = !dbStatus.startsWith('degraded');

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      version: '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}

