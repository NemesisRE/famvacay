'use client';

import { useCookieBannerVisible } from '@/lib/consent/cookie-consent-context';

/**
 * The cookie banner is fixed to the bottom of the viewport - without this, it permanently
 * covers whatever page content happens to be there (e.g. the tail of /privacy). Reserves
 * enough bottom space to clear it whenever it's actually on screen.
 */
export function MainContent({ children }: { children: React.ReactNode }) {
  const bannerVisible = useCookieBannerVisible();
  return (
    <main
      className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-[padding] ${
        bannerVisible ? 'pb-72 sm:pb-48' : ''
      }`}
    >
      {children}
    </main>
  );
}
