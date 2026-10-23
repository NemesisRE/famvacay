'use client';

import { useI18n } from '@/lib/i18n/i18n-context';
import { useConsentUi, useCookieBannerVisible, getCookieBannerMode, setBannerChoice } from '@/lib/consent/cookie-consent-context';

/**
 * § 25(2) Nr. 2 TDDDG does not require a consent wall for strictly-necessary cookies +
 * cookieless self-hosted analytics, but this banner offers a defense-in-depth, configurable
 * notice anyway. Reopenable at any time via the footer's "Privacy & Cookie Settings" link.
 */
export function CookiePrivacyBanner() {
  const { t } = useI18n();
  const mode = getCookieBannerMode();
  const visible = useCookieBannerVisible();
  const { dismiss } = useConsentUi();

  if (!visible) return null;

  const handleChoice = (choice: 'accepted' | 'essential_only' | 'analytics_accepted') => {
    setBannerChoice(choice);
    dismiss();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-4 flex justify-center">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-4 sm:p-5 space-y-3">
        <p className="text-xs text-slate-600 dark:text-slate-400">{t.legal.cookieBannerMessage}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {mode === 'STRICT_OPT_IN' ? (
            <>
              <button
                type="button"
                onClick={() => handleChoice('essential_only')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.legal.cookieBannerEssentialOnlyLabel}
              </button>
              <button
                type="button"
                onClick={() => handleChoice('analytics_accepted')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
              >
                {t.legal.cookieBannerAcceptAnalyticsLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleChoice('essential_only')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.legal.cookieBannerEssentialOnlyLabel}
              </button>
              <button
                type="button"
                onClick={() => handleChoice('accepted')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
              >
                {t.legal.cookieBannerAcceptAllLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
