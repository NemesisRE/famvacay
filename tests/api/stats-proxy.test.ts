import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as scriptGet } from '@/app/stats/script.js/route';
import { POST as apiPost } from '@/app/stats/api/[...path]/route';

describe('Umami Analytics Reverse Proxy Routes', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('serves script.js with application/javascript header when upstream is reachable', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response('console.log("umami-tracker");', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      })
    );

    const req = new NextRequest('http://localhost:3000/stats/script.js');
    const res = await scriptGet(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const text = await res.text();
    expect(text).toBe('console.log("umami-tracker");');
  });

  it('serves safe fallback script with status 200 when upstream is down (preventing 404 / MIME type errors)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const req = new NextRequest('http://localhost:3000/stats/script.js');
    const res = await scriptGet(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const text = await res.text();
    expect(text).toContain('Umami analytics service unreachable');
  });

  it('proxies /stats/api/send events to upstream Umami with forwarded IP', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const req = new NextRequest('http://localhost:3000/stats/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.195',
      },
      body: JSON.stringify({ type: 'event', payload: { website: 'test-id' } }),
    });

    const res = await apiPost(req, { params: Promise.resolve({ path: ['send'] }) });

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/send'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      })
    );
  });
});
