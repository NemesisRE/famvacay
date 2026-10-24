'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { PublicRuntimeConfig } from '@/lib/config/public-runtime';

/**
 * Single source of truth for the self-hosted Umami opt-out + the cookie banner's "has the
 * visitor already chosen?" state, shared between CookiePrivacyBanner, the /privacy opt-out
 * toggle, and the footer's "Privacy & Cookie Settings" link (which re-opens the banner).
 */
const UMAMI_DISABLED_KEY = 'umami.disabled';
const BANNER_CHOICE_KEY = 'famvacay_cookie_choice';
const CONSENT_CHANGED_EVENT = 'famvacay:consent-changed';

export type BannerChoice = 'accepted' | 'essential_only' | 'analytics_accepted';

function emitChange() {
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  } catch {
    // SSR / no window
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
  };
}

function readUmamiDisabled(): boolean {
  try {
    return localStorage.getItem(UMAMI_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function readBannerChoiceMade(): boolean {
  try {
    return Boolean(localStorage.getItem(BANNER_CHOICE_KEY));
  } catch {
    return false;
  }
}

export function setUmamiDisabled(disabled: boolean) {
  try {
    localStorage.setItem(UMAMI_DISABLED_KEY, disabled ? '1' : '0');
  } catch {
    // Storage quota / disabled - analytics script just won't opt back in client-side
  }
  emitChange();
}

export function setBannerChoice(choice: BannerChoice) {
  try {
    localStorage.setItem(BANNER_CHOICE_KEY, choice);
  } catch {
    // Storage quota / disabled
  }
  setUmamiDisabled(choice === 'essential_only');
}

/** Live (per-tab) read of the current Umami opt-out flag, for the banner and the privacy toggle. */
export function useUmamiDisabled(): boolean {
  return useSyncExternalStore(subscribe, readUmamiDisabled, () => false);
}

/** Whether the visitor has already made a banner choice (so the first-visit banner can hide). */
export function useBannerChoiceMade(): boolean {
  return useSyncExternalStore(subscribe, readBannerChoiceMade, () => true);
}

interface ConsentUiContextValue {
  forceOpen: boolean;
  requestOpen: () => void;
  dismiss: () => void;
  /** Runtime settings from /api/public-config; null until loaded (or if it failed). */
  config: PublicRuntimeConfig | null;
}

const ConsentUiContext = createContext<ConsentUiContextValue | null>(null);

export function ConsentUiProvider({ children }: { children: React.ReactNode }) {
  const [forceOpen, setForceOpen] = useState(false);
  const [config, setConfig] = useState<PublicRuntimeConfig | null>(null);
  const requestOpen = useCallback(() => setForceOpen(true), []);
  const dismiss = useCallback(() => setForceOpen(false), []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((value) => !cancelled && value && setConfig(value))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <ConsentUiContext.Provider value={{ forceOpen, requestOpen, dismiss, config }}>{children}</ConsentUiContext.Provider>
  );
}

export function useConsentUi(): ConsentUiContextValue {
  const ctx = useContext(ConsentUiContext);
  if (!ctx) throw new Error('useConsentUi must be used within ConsentUiProvider');
  return ctx;
}

/** Analytics only exist on deployments with an Umami website id. */
export function useAnalyticsEnabled(): boolean {
  return Boolean(useConsentUi().config?.umamiWebsiteId);
}

/**
 * Whether the fixed-position cookie banner is currently on screen - shared by the banner itself
 * and by the page layout, which needs to reserve bottom space so the banner never permanently
 * covers page content. Without analytics there is nothing to choose (only strictly necessary
 * storage, which § 25(2) Nr. 2 TDDDG exempts), so no banner is shown at all.
 */
export function useCookieBannerVisible(): boolean {
  const choiceMade = useBannerChoiceMade();
  const { forceOpen, config } = useConsentUi();
  if (!config?.umamiWebsiteId || config.cookieBannerMode === 'NONE') return false;
  return forceOpen || !choiceMade;
}
