import { describe, it, expect, vi } from 'vitest';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as readyGet } from '@/app/api/ready/route';
import { prisma } from '@/lib/db/prisma';

describe('Operational Readiness & Health Probes', () => {
  it('GET /api/health returns 200 OK with runtime metadata and uptime', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
    expect(typeof body.uptime).toBe('number');
    expect(body.timestamp).toBeDefined();
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
});

