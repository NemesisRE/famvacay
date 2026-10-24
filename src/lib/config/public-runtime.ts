/**
 * Browser-facing settings that must follow the *runtime* environment of a deployment.
 *
 * Next.js inlines every `process.env.NEXT_PUBLIC_X` reference at build time - in client and
 * server code alike - so a single Docker image configured per environment would ship with
 * whatever was set during `next build` (usually nothing). These values are therefore read on
 * the server through a dynamic key (which is never inlined) and served to the browser by
 * /api/public-config. The variable names keep their NEXT_PUBLIC_ prefix for compatibility.
 */
export type CookieBannerMode = 'TRANSPARENCY_AND_CHOICE' | 'STRICT_OPT_IN' | 'NONE';

export interface PublicRuntimeConfig {
  /** Self-hosted Umami website id; null = no analytics at all on this deployment. */
  umamiWebsiteId: string | null;
  umamiScriptUrl: string;
  cookieBannerMode: CookieBannerMode;
}

/** Request-time environment lookup; the dynamic key keeps Next.js from inlining it at build. */
export function runtimeEnv(name: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export function getPublicRuntimeConfig(env: Record<string, string | undefined> = process.env): PublicRuntimeConfig {
  const mode = runtimeEnv('NEXT_PUBLIC_COOKIE_BANNER_MODE', env);
  return {
    umamiWebsiteId: runtimeEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', env) ?? null,
    umamiScriptUrl: runtimeEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', env) ?? '/stats/script.js',
    cookieBannerMode: mode === 'STRICT_OPT_IN' || mode === 'NONE' ? mode : 'TRANSPARENCY_AND_CHOICE',
  };
}
