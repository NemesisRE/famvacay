import { describe, expect, it } from 'vitest';
import { getPublicRuntimeConfig } from '../public-runtime';
import { getConfiguredOAuthProviders } from '@/lib/auth/oauth-config';

describe('public runtime config', () => {
  it('has no analytics and the default banner mode when nothing is configured', () => {
    expect(getPublicRuntimeConfig({})).toEqual({
      umamiWebsiteId: null,
      umamiScriptUrl: '/stats/script.js',
      cookieBannerMode: 'TRANSPARENCY_AND_CHOICE',
    });
  });

  it('reads the deployment environment, treating blank values as unset', () => {
    const config = getPublicRuntimeConfig({
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: ' site-123 ',
      NEXT_PUBLIC_UMAMI_SCRIPT_URL: '',
      NEXT_PUBLIC_COOKIE_BANNER_MODE: 'STRICT_OPT_IN',
    });
    expect(config).toEqual({ umamiWebsiteId: 'site-123', umamiScriptUrl: '/stats/script.js', cookieBannerMode: 'STRICT_OPT_IN' });
    expect(getPublicRuntimeConfig({ NEXT_PUBLIC_COOKIE_BANNER_MODE: 'bogus' }).cookieBannerMode).toBe('TRANSPARENCY_AND_CHOICE');
  });
});

describe('configured sign-in providers', () => {
  it('lists only providers with both credentials, accepting both Apple variable names', () => {
    expect(getConfiguredOAuthProviders({})).toEqual([]);
    expect(getConfiguredOAuthProviders({ GOOGLE_CLIENT_ID: 'id' })).toEqual([]);
    expect(getConfiguredOAuthProviders({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toEqual(['Google']);
    expect(getConfiguredOAuthProviders({ APPLE_CLIENT_ID: 'id', APPLE_CLIENT_SECRET: 's' })).toEqual(['Apple']);
    expect(getConfiguredOAuthProviders({ APPLE_ID: 'id', APPLE_SECRET: 's' })).toEqual(['Apple']);
  });
});
