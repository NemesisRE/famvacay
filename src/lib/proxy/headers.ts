import { NextRequest } from 'next/server';

export interface ResolvedProxyRequest {
  clientIp: string;
  protocol: string;
  host: string;
  baseUrl: string;
  isSecure: boolean;
}

/**
 * Resolves proxy headers (X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host)
 * with strict fallback to public APP_URL or request Host header.
 * Prevents internal port leakages behind reverse proxies.
 */
export function resolveProxyHeaders(req: NextRequest | Request): ResolvedProxyRequest {
  const headers = req.headers;
  const envAppUrl = process.env.APP_URL;

  // 1. Client IP
  const xForwardedFor = headers.get('x-forwarded-for');
  const clientIp = xForwardedFor
    ? xForwardedFor.split(',')[0].trim()
    : headers.get('x-real-ip') || '127.0.0.1';

  // 2. Protocol
  let protocol = headers.get('x-forwarded-proto') || 'http';
  if (protocol.includes(',')) {
    protocol = protocol.split(',')[0].trim();
  }

  // 3. Host
  let host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3000';
  if (host.includes(',')) {
    host = host.split(',')[0].trim();
  }

  // 4. Derive Base URL
  let baseUrl = `${protocol}://${host}`;

  if (envAppUrl) {
    try {
      const parsed = new URL(envAppUrl);
      baseUrl = parsed.origin;
      protocol = parsed.protocol.replace(':', '');
      host = parsed.host;
    } catch {
      // If envAppUrl is not full URL, sanitize
      const sanitized = envAppUrl.replace(/\/+$/, '');
      baseUrl = sanitized.startsWith('http') ? sanitized : `https://${sanitized}`;
    }
  }

  return {
    clientIp,
    protocol,
    host,
    baseUrl,
    isSecure: protocol === 'https',
  };
}

/**
 * Build a canonical URL guaranteeing no leakage of internal ports (e.g. 3000).
 */
export function getCanonicalUrl(path: string, req?: NextRequest | Request): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (process.env.APP_URL) {
    const base = process.env.APP_URL.replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  if (req) {
    const resolved = resolveProxyHeaders(req);
    return `${resolved.baseUrl}${cleanPath}`;
  }

  return cleanPath;
}

