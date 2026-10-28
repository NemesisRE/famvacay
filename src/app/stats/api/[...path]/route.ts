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
 * First-party reverse proxy for Umami's collection and event APIs (/stats/api/* -> http://umami:3000/api/*).
 * Forwards client IP and headers while keeping analytics requests first-party.
 */
async function proxyUmami(req: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const subpath = path.join('/');
  const urls = getUmamiUrls();

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'content-length'].includes(lower)) {
      forwardHeaders.set(key, value);
    }
  });

  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  if (clientIp) {
    forwardHeaders.set('x-forwarded-for', clientIp);
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined;

  for (const baseUrl of urls) {
    try {
      const targetUrl = `${baseUrl}/api/${subpath}${req.nextUrl.search}`;
      const res = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body,
      });

      const resBody = await res.arrayBuffer();
      const resHeaders = new Headers();
      const contentType = res.headers.get('content-type');
      if (contentType) {
        resHeaders.set('content-type', contentType);
      }

      return new NextResponse(resBody, {
        status: res.status,
        headers: resHeaders,
      });
    } catch {
      // Continue to next candidate URL
    }
  }

  return NextResponse.json({ error: 'Umami analytics upstream unavailable' }, { status: 502 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyUmami(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyUmami(req, params);
}
