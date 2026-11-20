import type { MetadataRoute } from 'next';
import { INDEXABLE_PATHS, getSiteUrl } from '@/lib/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return INDEXABLE_PATHS.map((path) => ({
    url: path === '/' ? site : `${site}${path}`,
    changeFrequency: path === '/' ? 'weekly' : 'yearly',
    priority: path === '/' ? 1 : 0.5,
  }));
}
