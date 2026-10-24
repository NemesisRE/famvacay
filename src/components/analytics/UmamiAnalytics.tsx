'use client';

import Script from 'next/script';
import { useUmamiDisabled, useBannerChoiceMade, useConsentUi } from '@/lib/consent/cookie-consent-context';

/**
 * Renders the self-hosted Umami tracker only when a website id is configured (at runtime, via
 * /api/public-config) and the visitor hasn't opted out - either via the explicit
 * `umami.disabled` flag, or (in STRICT_OPT_IN banner mode) by simply not having made a choice
 * yet. `src` is proxied first-party through Next.js `rewrites()` under /stats/*, so no
 * third-party connection is ever made (see next.config.js).
 */
export function UmamiAnalytics() {
  const { config } = useConsentUi();
  const umamiDisabled = useUmamiDisabled();
  const choiceMade = useBannerChoiceMade();

  if (!config?.umamiWebsiteId || umamiDisabled) return null;
  if (config.cookieBannerMode === 'STRICT_OPT_IN' && !choiceMade) return null;

  return (
    <Script
      src={config.umamiScriptUrl}
      data-website-id={config.umamiWebsiteId}
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
