import { describe, it, expect, afterEach } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { jsonLdString } from '@/lib/seo/site';
import { en } from '@/lib/i18n/locales/en';

describe('SEO files', () => {
  const original = process.env.APP_URL;
  afterEach(() => {
    process.env.APP_URL = original;
  });

  it('builds sitemap and robots from APP_URL without a trailing slash', () => {
    process.env.APP_URL = 'https://example.org/';
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://example.org',
      'https://example.org/about',
      'https://example.org/privacy',
      'https://example.org/imprint',
    ]);
    const r = robots();
    expect(r.sitemap).toBe('https://example.org/sitemap.xml');
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toContain('/api/');
  });

  it('escapes "<" in JSON-LD so data cannot close the script tag', () => {
    expect(jsonLdString({ a: '</script><b>' })).not.toContain('<');
  });

  it('keeps the meta description at a search-friendly length', () => {
    expect(en.seo.homeDescription.length).toBeLessThanOrEqual(200);
  });
});
