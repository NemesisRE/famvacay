import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProxyHeaders, getCanonicalUrl } from './headers';

describe('Proxy Header Resolution & Network Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APP_URL;
    process.env.TRUST_PROXY = 'true';
    process.env.TRUSTED_PROXY_HOPS = '1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('correctly resolves X-Forwarded-* headers when TRUST_PROXY=true', () => {
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 192.168.1.1',
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'vacations.myfamily.org, internal.proxy',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('192.168.1.1'); // With TRUSTED_PROXY_HOPS=1, rightmost untrusted entry
    expect(resolved.protocol).toBe('https');
    expect(resolved.host).toBe('vacations.myfamily.org');
    expect(resolved.baseUrl).toBe('https://vacations.myfamily.org');
    expect(resolved.isSecure).toBe(true);
    expect(resolved.isProxyTrusted).toBe(true);
  });

  it('correctly extracts client IP with TRUSTED_PROXY_HOPS=2', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 198.51.100.5, 10.0.0.1',
      },
    });

    // Length = 3, Hops = 2 -> Index = max(0, 3 - 2) = 1 -> '198.51.100.5'
    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('198.51.100.5');
  });

  it('correctly parses RFC 7239 Forwarded header', () => {
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        forwarded: 'for="[2001:db8:cafe::17]:4711";proto=https;host=vacay.example.org, for=198.51.100.4',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('198.51.100.4');
    expect(resolved.protocol).toBe('https');
    expect(resolved.host).toBe('vacay.example.org');
    expect(resolved.baseUrl).toBe('https://vacay.example.org');
  });

  it('rejects forwarded headers when TRUST_PROXY is false or unset', () => {
    process.env.TRUST_PROXY = 'false';
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        'x-forwarded-for': '203.0.113.195',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'malicious.attacker.com',
        host: 'internal-host:3000',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.isProxyTrusted).toBe(false);
    expect(resolved.host).toBe('internal-host:3000');
    expect(resolved.protocol).toBe('http');
    expect(resolved.clientIp).toBe('127.0.0.1');
  });

  it('prevents internal port leaks by honoring configured APP_URL', () => {
    process.env.APP_URL = 'https://myvacay.example.com';

    const mockRequest = new Request('http://famvacay-backend:3000/trips', {
      headers: {
        host: 'famvacay-backend:3000',
      },
    });

    const canonical = getCanonicalUrl('/api/export/calendar.ics', mockRequest);
    expect(canonical).toBe('https://myvacay.example.com/api/export/calendar.ics');

    const canonicalWithoutSlash = getCanonicalUrl('api/export/calendar.ics');
    expect(canonicalWithoutSlash).toBe('https://myvacay.example.com/api/export/calendar.ics');

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.baseUrl).toBe('https://myvacay.example.com');
  });

  it('handles invalid URL string gracefully in APP_URL', () => {
    process.env.APP_URL = 'myvacay.internal.local';
    const mockRequest = new Request('http://localhost:3000/test');
    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.baseUrl).toBe('https://myvacay.internal.local');
  });

  it('handles IPv4 with port in Forwarded header', () => {
    const mockRequest = new Request('http://localhost:3000/api', {
      headers: {
        forwarded: 'for=192.0.2.1:8080;proto=https;host=test.local',
      },
    });
    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('192.0.2.1');
    expect(resolved.protocol).toBe('https');
    expect(resolved.host).toBe('test.local');
  });

  it('returns bare path when getCanonicalUrl is called without APP_URL or request', () => {
    delete process.env.APP_URL;
    expect(getCanonicalUrl('/api/test')).toBe('/api/test');
    expect(getCanonicalUrl('api/test')).toBe('/api/test');
  });
});
