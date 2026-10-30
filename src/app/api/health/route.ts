import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export const dynamic = 'force-dynamic';

// Release images get the tag (v1.2.3) as APP_VERSION at build time; elsewhere package.json's version
const VERSION = (process.env.APP_VERSION || packageJson.version).replace(/^v/, '');

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
