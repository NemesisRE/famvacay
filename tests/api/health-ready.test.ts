import { describe, it, expect, vi } from 'vitest';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as readyGet } from '@/app/api/ready/route';
import { prisma } from '@/lib/db/prisma';
import * as cacheModule from '@/lib/cache/redis';

describe('Operational Readiness & Health Probes', () => {
  it('GET /api/health returns 200 OK with runtime metadata and uptime', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    // No release tag in tests: an untagged build reports "dev"
    expect(body.version).toBe('dev');
    expect(typeof body.uptime).toBe('number');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /api/health reports the release tag baked into the image', async () => {
    vi.resetModules();
    vi.stubEnv('APP_VERSION', 'v1.2.3');
    try {
      const { GET } = await import('@/app/api/health/route');
      expect((await (await GET()).json()).version).toBe('1.2.3');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('GET /api/ready returns 200 OK when database and cache are operational', async () => {
    // Mock prisma $queryRaw to succeed
    vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);

    const res = await readyGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.checks.database).toBe('healthy');
  });

  it('GET /api/ready returns 503 Service Unavailable when database is unreachable', async () => {
    // Simulate database outage
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection refused'));

    const res = await readyGet();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe('not_ready');
    expect(body.checks.database).toBe('unreachable');
  });

  it('GET /api/ready reports cache as unreachable without failing overall readiness', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);
    vi.spyOn(cacheModule, 'checkCacheHealth').mockResolvedValueOnce('unreachable');

    const res = await readyGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.checks.cache).toBe('unreachable');
  });
});

