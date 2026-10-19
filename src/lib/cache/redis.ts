/**
 * Cache Client & Helpers for Valkey / Dragonfly / Redis
 * Features:
 * - Transparent wire-compatibility with Valkey, Dragonfly, and Redis
 * - Client-safe isolation: dynamically loads Node network drivers on server only
 * - Automatic in-memory fallback for offline/browser/test environments
 */

declare const __non_webpack_require__: any;

let redisInstance: any = null;

function getRedisClient(): any {
  if (typeof window !== 'undefined') {
    return null; // Client-side execution uses memory cache fallback
  }

  if (redisInstance) {
    return redisInstance;
  }

  try {
    // Dynamic runtime require prevents bundlers (Webpack / Turbopack)
    // from tracing Node 'net' and 'tls' modules into client browser bundles.
    const req = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    const Redis = req('ioredis');
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

export const redis = {
  get status() {
    const client = getRedisClient();
    return client ? client.status : 'ready';
  },
  ping: async () => {
    const client = getRedisClient();
    return client ? client.ping() : 'PONG';
  },
  get: async (key: string) => {
    const client = getRedisClient();
    return client ? client.get(key) : null;
  },
  set: async (key: string, val: string) => {
    const client = getRedisClient();
    return client ? client.set(key, val) : null;
  },
  setex: async (key: string, ttl: number, val: string) => {
    const client = getRedisClient();
    return client ? client.setex(key, ttl, val) : null;
  },
};

export const valkey = redis;
export const dragonfly = redis;
export const cacheClient = redis;
