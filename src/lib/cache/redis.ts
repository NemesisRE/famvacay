/**
 * Cache Client & Helpers for Valkey / Dragonfly / Redis
 * Features:
 * - Transparent wire-compatibility with Valkey, Dragonfly, and Redis
 * - Client-safe isolation: dynamically loads Node network drivers on server only
 * - Automatic in-memory fallback for offline/browser/test environments
 */

import Redis from 'ioredis';

let redisInstance: Redis | null = null;

function getRedisClient(): Redis | null {
  if (typeof window !== 'undefined') {
    return null; // Client-side execution uses memory cache fallback
  }

  if (redisInstance) {
    return redisInstance;
  }

  try {
    const cacheUrl =
      process.env.VALKEY_URL ||
      process.env.DRAGONFLY_URL ||
      process.env.REDIS_URL ||
      'redis://localhost:6379';

    const client = new Redis(cacheUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) {
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err: any) => {
      console.warn('[Cache] Connection warning (Valkey/Dragonfly/Redis):', err.message);
    });

    redisInstance = client;
    return client;
  } catch (err: any) {
    console.warn('[Cache] Could not initialize ioredis driver:', err.message);
    return null;
  }
}

/**
 * In-memory fallback cache if Redis/Valkey is unavailable
 */
const memoryCache = new Map<string, { value: string; expiry: number }>();

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (client && (client.status === 'ready' || client.status === 'connecting')) {
    try {
      const data = await client.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch {
      // Redis / Valkey failed, proceed to memory fallback
    }
  }

  // Memory fallback
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() < mem.expiry) {
      return JSON.parse(mem.value) as T;
    }
    memoryCache.delete(key);
  }

  return null;
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);
  const client = getRedisClient();

  if (client && (client.status === 'ready' || client.status === 'connecting')) {
    try {
      await client.setex(key, ttlSeconds, serialized);
    } catch {
      // Redis / Valkey failed, proceed to memory fallback
    }
  }

  memoryCache.set(key, {
    value: serialized,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

const counterMemory = new Map<string, { count: number; expiry: number }>();

/**
 * Atomic counter with expiry (rate limiting). Shared across replicas via Valkey/Redis; falls back
 * to this process's memory when the cache is unavailable.
 */
export async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  const client = getRedisClient();
  if (client && client.status === 'ready') {
    try {
      const results = await client.multi().incr(key).expire(key, ttlSeconds).exec();
      const count = Number(results?.[0]?.[1]);
      if (Number.isFinite(count)) return count;
    } catch {
      // Fall through to the memory counter
    }
  }
  const now = Date.now();
  if (counterMemory.size > 10_000) {
    for (const [k, v] of counterMemory) if (v.expiry <= now) counterMemory.delete(k);
  }
  const entry = counterMemory.get(key);
  if (!entry || entry.expiry <= now) {
    counterMemory.set(key, { count: 1, expiry: now + ttlSeconds * 1000 });
    return 1;
  }
  return ++entry.count;
}

export const redis = {
  get status() {
    const client = getRedisClient();
    return client ? client.status : 'ready';
  },
  ping: async () => {
    const client = getRedisClient();
    if (!client) return 'PONG';
    try {
      return await client.ping();
    } catch {
      return 'PONG';
    }
  },
  get: async (key: string) => {
    const client = getRedisClient();
    if (!client) return null;
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, val: string) => {
    const client = getRedisClient();
    if (!client) return null;
    try {
      return await client.set(key, val);
    } catch {
      return null;
    }
  },
  setex: async (key: string, ttl: number, val: string) => {
    const client = getRedisClient();
    if (!client) return null;
    try {
      return await client.setex(key, ttl, val);
    } catch {
      return null;
    }
  },
};

export const valkey = redis;
export const dragonfly = redis;
export const cacheClient = redis;

/**
 * Unmasked connectivity check for the readiness probe. Unlike `redis.ping()`
 * above (which deliberately swallows errors so feature code can fall back to
 * the in-memory cache without crashing), this surfaces a real outage instead
 * of reporting healthy, and actually attempts to connect even when the lazy
 * ioredis client hasn't opened a connection yet (status 'wait').
 */
export async function checkCacheHealth(): Promise<'healthy' | 'unreachable'> {
  const client = getRedisClient();
  if (!client) return 'unreachable';
  try {
    const pong = await client.ping();
    return pong === 'PONG' ? 'healthy' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/** Closes the underlying ioredis connection cleanly on shutdown (SIGTERM/SIGINT). */
export async function disconnectCache(): Promise<void> {
  if (!redisInstance) return;
  try {
    await redisInstance.quit();
  } catch {
    redisInstance.disconnect();
  } finally {
    redisInstance = null;
  }
}
