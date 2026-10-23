'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { size, type Middleware } from '@floating-ui/react';

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
 * floating-ui middleware: records the space between the trigger and the viewport edge, so an
 * anchored popover never runs past the screen (getResponsivePopoverStyle caps its height to it).
 */
export function viewportFit(padding = 12): Middleware {
  return size({
    padding,
    apply({ availableHeight, elements }) {
      elements.floating.style.setProperty('--popover-available-height', `${Math.max(120, Math.floor(availableHeight))}px`);
    },
  });
}

/**
 * Popover positioning for both form factors: anchored to its trigger (floating-ui styles) on
 * larger screens, a centered overlay on phones - anchored popovers were flipping above the header
 * or running past the bottom of the viewport there. Either way the popover is limited to the
 * visible space and scrolls internally; reaching the end of its content does not scroll the page
 * behind it (overscroll containment).
 */
export function getResponsivePopoverStyle(
  isSmallScreen: boolean,
  floatingStyles: React.CSSProperties,
  zIndex = 9999
): React.CSSProperties {
  if (!isSmallScreen) {
    return {
      ...floatingStyles,
      zIndex,
      maxHeight: 'min(var(--popover-available-height, calc(100vh - 24px)), calc(100vh - 24px))',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    };
  }
  return {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100vw - 24px)',
    maxWidth: 440,
    maxHeight: '85vh',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    zIndex,
  };
}

/**
 * Dimmed backdrop behind the phone overlay. Clicks on it land outside the floating element, so
 * floating-ui's useDismiss closes the popover; it also keeps taps from reaching the page below.
 * While it is shown the page itself cannot scroll (only the overlay does).
 */
export function PopoverBackdrop({ show, zIndex = 9998 }: { show: boolean; zIndex?: number }) {
  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [show]);

  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      style={{ zIndex, touchAction: 'none' }}
      className="fixed inset-0 bg-slate-900/40 animate-in fade-in"
    />
  );
}

/**
 * useDismiss options for every popover: close on the completed click outside, not on pointerdown.
 * On phones the backdrop covers the trigger; closing on pointerdown removed the backdrop before the
 * click, which then landed on the trigger and opened the popover again.
 */
export const POPOVER_DISMISS_OPTIONS = { outsidePressEvent: 'click' } as const;
