import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness Probe: GET /api/health
 * Verifies that the Node.js process is running and accepting HTTP requests.
 * Performs strictly zero external dependency checks (no DB, no cache).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
