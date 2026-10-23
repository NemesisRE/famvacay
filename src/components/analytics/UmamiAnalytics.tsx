'use client';

import Script from 'next/script';
import { useUmamiDisabled, useBannerChoiceMade } from '@/lib/consent/cookie-consent-context';

/**
 * Renders the self-hosted Umami tracker only when a website id is configured and the visitor
 * hasn't opted out - either via the explicit `umami.disabled` flag, or (in STRICT_OPT_IN banner
 * mode) by simply not having made a choice yet. `src` is proxied first-party through Next.js
 * `rewrites()` under /stats/*, so no third-party connection is ever made (see next.config.js).
 */
export function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || '/stats/script.js';
  const bannerMode = process.env.NEXT_PUBLIC_COOKIE_BANNER_MODE;

  const umamiDisabled = useUmamiDisabled();
  const choiceMade = useBannerChoiceMade();
  const strictOptInPending = bannerMode === 'STRICT_OPT_IN' && !choiceMade;

  if (!websiteId || umamiDisabled || strictOptInPending) return null;

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
