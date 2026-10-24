import { describe, expect, it } from 'vitest';
import { checkRateLimit, clientIdentifierFromHeaders } from '../rate-limit';

describe('checkRateLimit', () => {
  it('allows requests up to the limit within a window and blocks the rest', async () => {
    const rule = { bucket: `test-${crypto.randomUUID()}`, limit: 3, windowSeconds: 60 };
    const now = 1_800_000_000_000;
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await checkRateLimit(rule, 'client-a', now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    // The window started at a multiple of 60s; retry once it ends
    expect(results[4].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[4].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('counts clients and windows separately', async () => {
    const rule = { bucket: `test-${crypto.randomUUID()}`, limit: 1, windowSeconds: 60 };
    const now = 1_800_000_000_000;
    expect((await checkRateLimit(rule, 'client-a', now)).allowed).toBe(true);
    expect((await checkRateLimit(rule, 'client-b', now)).allowed).toBe(true);
    expect((await checkRateLimit(rule, 'client-a', now)).allowed).toBe(false);
    expect((await checkRateLimit(rule, 'client-a', now + 60_000)).allowed).toBe(true);
  });
});

describe('clientIdentifierFromHeaders', () => {
  it('reads the client IP from plain header objects', () => {
    expect(clientIdentifierFromHeaders({ 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7');
    expect(clientIdentifierFromHeaders(undefined)).toBe('127.0.0.1');
  });
});
