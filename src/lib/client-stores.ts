'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Browser-only values read through useSyncExternalStore: the server render and hydration use the
 * server snapshot, the client switches right after - without setState in an effect (an extra
 * render and the "cascading renders" lint warning).
 */

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// ---- Dark theme: the <html class="dark"> the layout's inline script applies before paint ----

function subscribeToThemeClass(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Current theme (from the page itself) and a setter that also persists the choice. */
export function useDarkTheme(): [boolean, (dark: boolean) => void] {
  const isDark = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.classList.contains('dark'),
    () => false
  );
  const setDark = useCallback((dark: boolean) => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('famvac_theme', dark ? 'dark' : 'light');
    } catch {
      // storage blocked: the theme still applies for this visit
    }
  }, []);
  return [isDark, setDark];
}
