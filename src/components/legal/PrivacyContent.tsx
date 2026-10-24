'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { LegalConfig } from '@/lib/config/legal';
import { useUmamiDisabled, setUmamiDisabled } from '@/lib/consent/cookie-consent-context';

const sectionTitleClass = 'font-semibold text-slate-800 dark:text-slate-200 mb-1';
const sectionBodyClass = 'text-sm text-slate-600 dark:text-slate-400 leading-relaxed';

interface PrivacyContentProps {
  legal: LegalConfig;
  /** Umami configured on this deployment (runtime). Without it there is no analytics section. */
  analyticsEnabled: boolean;
  /** Third-party sign-in providers actually configured (runtime), e.g. ['Google']. */
  oauthProviders: string[];
}

/**
 * Datenschutzerklärung per Art. 13 GDPR. Every section only states what this deployment really
 * does - optional features (analytics, OAuth, DPA) appear only when configured.
 */
export function PrivacyContent({ legal, analyticsEnabled, oauthProviders }: PrivacyContentProps) {
  const { t } = useI18n();
  const umamiDisabled = useUmamiDisabled();

  const section = (title: string, ...paragraphs: string[]) => (
    <section>
      <h2 className={sectionTitleClass}>{title}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className={`${sectionBodyClass} ${i > 0 ? 'mt-2' : ''}`}>
          {p}
        </p>
      ))}
    </section>
  );

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
        <p className={sectionBodyClass}>
          {legal.hostingProviderName}
          <br />
          {legal.hostingProviderAddress}
        </p>
        <p className={`${sectionBodyClass} mt-2`}>
          {legal.dpaConcluded ? t.legal.hostingDpaNotice : t.legal.hostingNoDpaNotice}
        </p>
      </section>

      {section(t.legal.accountDataSectionTitle, t.legal.accountDataNotice)}
      {section(t.legal.passkeysSectionTitle, t.legal.passkeysNotice)}
      {oauthProviders.length > 0 &&
        section(`${t.legal.oauthSectionTitle.replace(/\(.*\)/, '').trim()} (${oauthProviders.join(' / ')})`, t.legal.oauthNotice)}
      {section(t.legal.proxyingSectionTitle, t.legal.proxyingNotice)}
      {section(t.legal.sharedLinksSectionTitle, t.legal.sharedLinksNotice)}

      {analyticsEnabled && (
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
      )}

      {section(t.legal.storageSectionTitle, t.legal.storageNotice)}
      {section(t.legal.retentionSectionTitle, t.legal.retentionNotice)}

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
        <p className={`${sectionBodyClass} mt-2`}>{t.legal.consentWithdrawalNotice}</p>
        <p className={`${sectionBodyClass} mt-2`}>{t.legal.complaintNotice}</p>
        <p className={`${sectionBodyClass} mt-2`}>{t.legal.automatedDecisionNotice}</p>
      </section>
    </div>
  );
}
