import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Release images get the tag (v1.2.3) as APP_VERSION at build time. Everything else (dev server,
// self-built images) is "dev": package.json is never bumped on release, so its version would be stale.
const VERSION = process.env.APP_VERSION ? process.env.APP_VERSION.replace(/^v/, '') : 'dev';

/**
 * Liveness Probe: GET /api/health
 * Verifies that the Node.js process is running and accepting HTTP requests.
 * Performs strictly zero external dependency checks (no DB, no cache).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
