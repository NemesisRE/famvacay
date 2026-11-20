import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/privacy', '/imprint'],
      // Per-user or machine-only areas: no value in a search index and they cost crawl budget
      disallow: ['/api/', '/auth/', '/profile', '/offline', '/stats/'],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
