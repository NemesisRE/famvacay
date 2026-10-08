import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProxyHeaders, getCanonicalUrl } from './headers';

describe('Proxy Header Resolution & Network Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APP_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('correctly resolves X-Forwarded-* headers with comma-separated proxies', () => {
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 192.168.1.1',
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'vacations.myfamily.org, internal.proxy',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('203.0.113.195');
    expect(resolved.protocol).toBe('https');
    expect(resolved.host).toBe('vacations.myfamily.org');
    expect(resolved.baseUrl).toBe('https://vacations.myfamily.org');
    expect(resolved.isSecure).toBe(true);
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const mockRequest = new Request('http://localhost:3000/api/vacation', {
      headers: {
        'x-real-ip': '198.51.100.22',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.clientIp).toBe('198.51.100.22');
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

  it('falls back gracefully when behind plain direct access without proxy headers or APP_URL', () => {
    const mockRequest = new Request('http://localhost:3000/test', {
      headers: {
        host: 'localhost:3000',
      },
    });

    const resolved = resolveProxyHeaders(mockRequest);
    expect(resolved.protocol).toBe('http');
    expect(resolved.host).toBe('localhost:3000');
    expect(resolved.baseUrl).toBe('http://localhost:3000');
    expect(resolved.clientIp).toBe('127.0.0.1');

    const canonical = getCanonicalUrl('/dashboard', mockRequest);
    expect(canonical).toBe('http://localhost:3000/dashboard');

    const bareCanonical = getCanonicalUrl('/bare-path');
    expect(bareCanonical).toBe('/bare-path');
  });
});

