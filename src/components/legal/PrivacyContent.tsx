'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { LegalConfig } from '@/lib/config/legal';
import { useUmamiDisabled, setUmamiDisabled } from '@/lib/consent/cookie-consent-context';

const sectionTitleClass = 'font-semibold text-slate-800 dark:text-slate-200 mb-1';
const sectionBodyClass = 'text-sm text-slate-600 dark:text-slate-400 leading-relaxed';

export function PrivacyContent({ legal }: { legal: LegalConfig }) {
  const { t } = useI18n();
  const umamiDisabled = useUmamiDisabled();

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.legal.privacyTitle}</h1>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.controllerSectionTitle}</h2>
        <p className={sectionBodyClass}>
          {legal.operatorName}
          <br />
          {legal.operatorStreet}
          <br />
          {legal.operatorPostalCity}
          <br />
          {t.legal.contactEmailLabel}: {legal.contactEmail}
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.hostingDpaSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.hostingDpaNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.accountDataSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.accountDataNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.passkeysSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.passkeysNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.oauthSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.oauthNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.proxyingSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.proxyingNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.analyticsSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.analyticsNotice}</p>
        <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.legal.analyticsOptOutLabel}{' '}
            <span className={umamiDisabled ? 'text-slate-400' : 'text-teal-600 dark:text-teal-400'}>
              {umamiDisabled ? t.legal.analyticsStatusDisabled : t.legal.analyticsStatusEnabled}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setUmamiDisabled(!umamiDisabled)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            {umamiDisabled ? t.legal.analyticsOptInButton : t.legal.analyticsOptOutButton}
          </button>
        </div>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.userRightsSectionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.userRightsNotice}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
          <a href="/api/account" className="text-teal-600 dark:text-teal-400 underline hover:no-underline">
            {t.legal.exportDataLink}
          </a>
          <Link href="/profile" className="text-teal-600 dark:text-teal-400 underline hover:no-underline">
            {t.legal.accountSettingsLink}
          </Link>
        </div>
      </section>
    </div>
  );
}
