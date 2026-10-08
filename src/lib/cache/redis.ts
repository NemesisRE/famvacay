import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis | undefined };

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        return null; // Stop retrying after 5 attempts
      }
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
  });

  client.on('error', (err) => {
    // In dev or without redis, log warning instead of crashing
    console.warn('[Redis] Connection warning:', err.message);
  });

  return client;
}

export const redis = globalForRedis.redis || createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * In-memory fallback cache if Redis is unavailable
 */
const memoryCache = new Map<string, { value: string; expiry: number }>();

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    }
  } catch {
    // Redis failed, check fallback
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

  try {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.setex(key, ttlSeconds, serialized);
    }
  } catch {
    // Redis failed, use memory fallback
  }

  memoryCache.set(key, {
    value: serialized,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

