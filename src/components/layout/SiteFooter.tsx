'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useAnalyticsEnabled, useConsentUi } from '@/lib/consent/cookie-consent-context';

/** Footer in the interface language (the root layout itself is a server component). */
export function SiteFooter() {
  const { t } = useI18n();
  const { requestOpen } = useConsentUi();
  const analyticsEnabled = useAnalyticsEnabled();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>{t.common.footer}</span>
        <span className="hidden sm:inline">•</span>
        <a
          href="https://github.com/NemesisRE/famvacay"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          {t.common.sourceCode}
        </a>
        <span className="hidden sm:inline">•</span>
        <Link href="/imprint" className="underline hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          {t.legal.footerImprintLink}
        </Link>
        <span className="hidden sm:inline">•</span>
        <Link href="/privacy" className="underline hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          {t.legal.footerPrivacyLink}
        </Link>
        {/* Only analytics are a choice; without them there are no settings to change */}
        {analyticsEnabled && (
          <>
            <span className="hidden sm:inline">•</span>
            <button
              type="button"
              onClick={requestOpen}
              className="underline hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              {t.legal.footerPrivacySettingsLink}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
