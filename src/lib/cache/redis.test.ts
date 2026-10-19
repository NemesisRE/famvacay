import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, setCached, redis, valkey, dragonfly } from './redis';

describe('Valkey / Dragonfly / Redis Cache Store & Memory Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores and retrieves serialized data in memory cache fallback', async () => {
    const testKey = 'test:key:1';
    const testPayload = { message: 'hello famvac', count: 42, active: true };

    await setCached(testKey, testPayload, 60);
    const retrieved = await getCached<typeof testPayload>(testKey);

    expect(retrieved).toEqual(testPayload);
  });

  it('evicts expired keys from in-memory fallback cache based on TTL', async () => {
    const expiredKey = 'test:key:expired';
    // Set 0 second TTL
    await setCached(expiredKey, { status: 'stale' }, -1);

    const retrieved = await getCached(expiredKey);
    expect(retrieved).toBeNull();
  });

  it('returns null for non-existent cache keys', async () => {
    const nonExistent = await getCached('key:does:not:exist');
    expect(nonExistent).toBeNull();
  });

  it('exposes compatible redis, valkey, and dragonfly facades', async () => {
    expect(valkey).toBe(redis);
    expect(dragonfly).toBe(redis);

    const status = redis.status;
    expect(typeof status).toBe('string');
    expect(['ready', 'connect', 'connecting', 'close', 'reconnecting', 'wait']).toContain(status);

    const pingResult = await redis.ping();
    expect(pingResult).toBeDefined();
  });
});
