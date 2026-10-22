'use client';

import React, { useSyncExternalStore } from 'react';

const SMALL_SCREEN_QUERY = '(max-width: 639px)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(SMALL_SCREEN_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/**
 * True below Tailwind's `sm` breakpoint. Server/hydration render assumes a large screen.
 */
export function useIsSmallScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SMALL_SCREEN_QUERY).matches,
    () => false
  );
}

/**
 * Popover positioning for both form factors: anchored to its trigger (floating-ui styles) on
 * larger screens, a centered, internally scrolling overlay on phones - anchored popovers were
 * flipping above the header or running past the bottom of the viewport there.
 */
export function getResponsivePopoverStyle(
  isSmallScreen: boolean,
  floatingStyles: React.CSSProperties,
  zIndex = 9999
): React.CSSProperties {
  if (!isSmallScreen) return { ...floatingStyles, zIndex };
  return {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100vw - 24px)',
    maxWidth: 440,
    maxHeight: '85vh',
    overflowY: 'auto',
    zIndex,
  };
}

/**
 * Dimmed backdrop behind the phone overlay. Clicks on it land outside the floating element, so
 * floating-ui's useDismiss closes the popover; it also keeps taps from reaching the page below.
 */
export function PopoverBackdrop({ show, zIndex = 9998 }: { show: boolean; zIndex?: number }) {
  if (!show) return null;
  return <div aria-hidden="true" style={{ zIndex }} className="fixed inset-0 bg-slate-900/40 animate-in fade-in" />;
}
