import { NextResponse } from 'next/server';
import { getPublicRuntimeConfig } from '@/lib/config/public-runtime';

export const dynamic = 'force-dynamic';

/** Runtime settings the browser needs (analytics, cookie banner) - see public-runtime.ts. */
export function GET() {
  return NextResponse.json(getPublicRuntimeConfig(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
