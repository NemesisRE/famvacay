'use client';

import { useLayoutEffect } from 'react';
import { THEME_STORAGE_KEY, applyTheme, resolveDarkTheme } from '@/lib/theme';

/**
 * Keeps the theme on <html> after React takes over: re-applies it on every mount of the app
 * (a hydration mismatch makes React re-render the whole document and reset <html>'s attributes),
 * follows the system setting while the user has not picked a theme, and syncs other tabs.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(resolveDarkTheme());

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => applyTheme(resolveDarkTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) applyTheme(resolveDarkTheme());
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}
