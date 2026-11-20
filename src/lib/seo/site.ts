/** Public origin of this instance (no trailing slash); the same APP_URL the rest of the app uses */
export function getSiteUrl(): string {
  return (process.env.APP_URL || 'https://famvacay.us').replace(/\/+$/, '');
}

/**
 * Pages worth indexing. Everything else (search results, profile, sign-in, API) is personal or
 * generated per visitor and stays out of the sitemap and behind robots rules.
 */
export const INDEXABLE_PATHS = ['/', '/about', '/privacy', '/imprint'] as const;

/** Serializes JSON-LD for an inline script: "<" is escaped so data can never close the tag */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
