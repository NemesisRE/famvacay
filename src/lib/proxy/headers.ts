import { NextRequest } from 'next/server';

export interface ResolvedProxyRequest {
  clientIp: string;
  protocol: string;
  host: string;
  baseUrl: string;
  isSecure: boolean;
  isProxyTrusted: boolean;
}

interface ParsedForwarded {
  forIps: string[];
  proto?: string;
  host?: string;
}

/**
 * Parse RFC 7239 `Forwarded` header parameter values.
 * Example: Forwarded: for=192.0.2.60;proto=https;host=example.com, for=198.51.100.1
 */
function parseRfc7239Forwarded(headerValue: string): ParsedForwarded {
  const result: ParsedForwarded = {
    forIps: [],
  };

  const hops = headerValue.split(',').map((h) => h.trim());
  for (const hop of hops) {
    const directives = hop.split(';').map((d) => d.trim());
    for (const directive of directives) {
      const eqIdx = directive.indexOf('=');
      if (eqIdx === -1) continue;
      const key = directive.substring(0, eqIdx).trim().toLowerCase();
      let val = directive.substring(eqIdx + 1).trim();
      // Strip optional quotes
      if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
        val = val.substring(1, val.length - 1);
      }

      if (key === 'for') {
        // Strip IPv6 brackets and optional port
        let cleanIp = val;
        if (cleanIp.startsWith('[')) {
          const closeBracket = cleanIp.indexOf(']');
          if (closeBracket !== -1) {
            cleanIp = cleanIp.substring(1, closeBracket);
          }
        } else if (cleanIp.includes(':')) {
          // If IPv4 with port e.g. 1.2.3.4:8080
          const colonParts = cleanIp.split(':');
          if (colonParts.length === 2 && !cleanIp.includes('::')) {
            cleanIp = colonParts[0];
          }
        }
        result.forIps.push(cleanIp);
      } else if (key === 'proto' && !result.proto) {
        result.proto = val.toLowerCase();
      } else if (key === 'host' && !result.host) {
        result.host = val;
      }
    }
  }

  return result;
}

/**
 * Extract client IP using configurable TRUSTED_PROXY_HOPS.
 * Inspects right-most untrusted entry to prevent IP spoofing via injected headers.
 */
function extractClientIp(ips: string[], trustedHopsCount: number): string {
  if (ips.length === 0) return '127.0.0.1';
  // If list length is L and trusted hops is H:
  // The right-most untrusted entry is at index max(0, L - H)
  const targetIndex = Math.max(0, ips.length - Math.max(1, trustedHopsCount));
  return ips[targetIndex].trim();
}

/**
 * Resolves proxy headers (RFC 7239 Forwarded, X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host)
 * strictly conditioned on TRUST_PROXY=true and hardened with TRUSTED_PROXY_HOPS.
 * All canonical absolute URLs derive from the configured public APP_URL.
 */
export function resolveProxyHeaders(req: NextRequest | Request): ResolvedProxyRequest {
  const headers = req.headers;
  const isProxyTrusted = process.env.TRUST_PROXY === 'true';
  const trustedHops = parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10) || 1;
  const envAppUrl = process.env.APP_URL;

  // Derive default fallback protocol and host from request URL
  let directProtocol = 'http';
  let directHost = 'localhost:3000';
  try {
    const reqUrl = new URL(req.url);
    directProtocol = reqUrl.protocol.replace(':', '');
    directHost = reqUrl.host;
  } catch {
    directHost = headers.get('host') || 'localhost:3000';
  }

  let protocol = directProtocol;
  let host = headers.get('host') || directHost;
  let clientIp = '127.0.0.1';

  if (isProxyTrusted) {
    // 1. Check RFC 7239 Forwarded header
    const rfcForwarded = headers.get('forwarded');
    if (rfcForwarded) {
      const parsed = parseRfc7239Forwarded(rfcForwarded);
      if (parsed.forIps.length > 0) {
        clientIp = extractClientIp(parsed.forIps, trustedHops);
      }
      if (parsed.proto) {
        protocol = parsed.proto;
      }
      if (parsed.host) {
        host = parsed.host;
      }
    } else {
      // 2. Check traditional X-Forwarded-* headers
      const xForwardedFor = headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const rawIps = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
        if (rawIps.length > 0) {
          clientIp = extractClientIp(rawIps, trustedHops);
        }
      } else {
        clientIp = headers.get('x-real-ip') || '127.0.0.1';
      }

      const xProto = headers.get('x-forwarded-proto');
      if (xProto) {
        protocol = xProto.split(',')[0].trim().toLowerCase();
      }

      const xHost = headers.get('x-forwarded-host');
      if (xHost) {
        host = xHost.split(',')[0].trim();
      }
    }
  } else {
    // Untrusted proxy: Do not trust forwarded headers for client IP or host
    clientIp = headers.get('x-real-ip') || '127.0.0.1';
  }

  // 3. Derive Base URL strictly from APP_URL if configured (no internal port leaks)
  let baseUrl = `${protocol}://${host}`;
  if (envAppUrl) {
    try {
      const parsed = new URL(envAppUrl);
      baseUrl = parsed.origin;
      protocol = parsed.protocol.replace(':', '');
      host = parsed.host;
    } catch {
      const sanitized = envAppUrl.replace(/\/+$/, '');
      baseUrl = sanitized.startsWith('http') ? sanitized : `https://${sanitized}`;
      try {
        const parsedSanitized = new URL(baseUrl);
        protocol = parsedSanitized.protocol.replace(':', '');
        host = parsedSanitized.host;
      } catch {
        // Fallback keep sanitized
      }
    }
  }

  return {
    clientIp,
    protocol,
    host,
    baseUrl,
    isSecure: protocol === 'https',
    isProxyTrusted,
  };
}

/**
 * Build a canonical URL guaranteeing no leakage of internal ports (e.g. 3000).
 * Derives exclusively from configured APP_URL when set.
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
