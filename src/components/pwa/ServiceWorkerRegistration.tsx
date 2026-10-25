'use client';

import { useEffect } from 'react';

/**
 * Registers public/sw.js (installable app, offline fallback). Production only: in development a
 * service worker would serve stale bundles past hot reloading.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Without a service worker the site simply works online only
    });
  }, []);
  return null;
}
