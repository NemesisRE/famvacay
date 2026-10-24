import { NextResponse } from 'next/server';
import { incrementCounter } from '@/lib/cache/redis';
import { resolveProxyHeaders } from '@/lib/proxy/headers';

/**
 * Fixed-window rate limits for public endpoints (login, registration, sharing, search).
 * Counters live in Valkey/Redis so limits hold across replicas; without the cache each process
 * counts on its own.
 */
export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginPerIp: { bucket: 'login-ip', limit: 30, windowSeconds: 15 * 60 },
  // Per account, so an attack spread over many IPs still cannot guess a password
  loginPerEmail: { bucket: 'login-email', limit: 10, windowSeconds: 15 * 60 },
  register: { bucket: 'register', limit: 5, windowSeconds: 60 * 60 },
  share: { bucket: 'share', limit: 30, windowSeconds: 10 * 60 },
  optimize: { bucket: 'optimize', limit: 60, windowSeconds: 10 * 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(rule: RateLimitRule, identifier: string, now = Date.now()): Promise<RateLimitResult> {
  const window = Math.floor(now / 1000 / rule.windowSeconds);
  const count = await incrementCounter(`rl:${rule.bucket}:${identifier}:${window}`, rule.windowSeconds);
  const windowEnd = (window + 1) * rule.windowSeconds;
  return { allowed: count <= rule.limit, retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - now / 1000)) };
}

/** Client IP as seen through the configured reverse proxy (TRUST_PROXY / TRUSTED_PROXY_HOPS). */
export function clientIdentifier(req: Request): string {
  try {
    return resolveProxyHeaders(req).clientIp;
  } catch {
    return 'unknown';
  }
}

/** Same as clientIdentifier, for NextAuth callbacks that only get the headers as a plain object. */
export function clientIdentifierFromHeaders(raw: Record<string, string | string[] | undefined> | undefined): string {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw ?? {})) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return clientIdentifier({ headers, url: 'http://localhost/' } as Request);
}

/** Rate limiting is skipped in unit tests (see rateLimitByClient). */
export function rateLimitingEnabled(): boolean {
  return process.env.NODE_ENV !== 'test';
}

/**
 * Checks the rule for the requesting client; returns a 429 response when over the limit.
 * Skipped in unit tests (route tests share one client IP and, via a local Valkey, counters
 * across runs); the limiter itself is tested directly.
 */
export async function rateLimitByClient(req: Request, rule: RateLimitRule): Promise<NextResponse | null> {
  if (!rateLimitingEnabled()) return null;
  const result = await checkRateLimit(rule, clientIdentifier(req));
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}
