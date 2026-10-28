import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getUmamiUrls(): string[] {
  const configured = process.env.UMAMI_INTERNAL_URL?.trim();
  const candidates: string[] = [];
  if (configured) candidates.push(configured);
  if (!candidates.includes('http://umami:3000')) candidates.push('http://umami:3000');
  if (!candidates.includes('http://famvacay-umami:3000')) candidates.push('http://famvacay-umami:3000');
  return candidates;
}

/**
 * First-party reverse proxy for Umami's tracker script.
 * Dynamically resolves UMAMI_INTERNAL_URL at runtime (bypassing static build-time rewrite limitations).
 * Returns a valid empty JavaScript snippet if Umami is temporarily unreachable, preventing browser MIME/404 errors.
 */
export async function GET(req: NextRequest) {
  const urls = getUmamiUrls();

  for (const baseUrl of urls) {
    try {
      const res = await fetch(`${baseUrl}/script.js`, {
        headers: {
          'User-Agent': req.headers.get('user-agent') || 'FamVacay-Proxy',
        },
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const script = await res.text();
        return new NextResponse(script, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          },
        });
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  // Graceful fallback when Umami is starting or unreachable
  return new NextResponse('/* Umami analytics service unreachable */', {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
