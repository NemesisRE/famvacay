'use client';

import { useI18n } from '@/lib/i18n/i18n-context';
import type { LegalConfig } from '@/lib/config/legal';

const sectionTitleClass = 'font-semibold text-slate-800 dark:text-slate-200 mb-1';
const sectionBodyClass = 'text-sm text-slate-600 dark:text-slate-400 leading-relaxed';

export function ImprintContent({ legal }: { legal: LegalConfig }) {
  const { t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.legal.imprintTitle}</h1>

      {legal.operationMode === 'private' && (
        <p className="text-sm rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-teal-800 dark:text-teal-300 p-3">
          {t.legal.privateModeNotice}
        </p>
      )}

      <section>
        <h2 className={sectionTitleClass}>{t.legal.operatorSectionTitle}</h2>
        <p className={sectionBodyClass}>
          {legal.operatorName}
          <br />
          {legal.operatorStreet}
          <br />
          {legal.operatorPostalCity}
          <br />
          {legal.operatorCountry}
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.contactSectionTitle}</h2>
        <p className={sectionBodyClass}>
          {t.legal.contactEmailLabel}: {legal.contactEmail}
          {legal.contactPhone && (
            <>
              <br />
              {t.legal.contactPhoneLabel}: {legal.contactPhone}
            </>
          )}
          {legal.vatId && (
            <>
              <br />
              {t.legal.vatIdLabel}: {legal.vatId}
            </>
          )}
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.hostingSectionTitle}</h2>
        <p className={sectionBodyClass}>
          {legal.hostingProviderName}
          <br />
          {legal.hostingProviderAddress}
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.disputeResolutionTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.disputeResolutionNotice}</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>{t.legal.liabilityTitle}</h2>
        <p className={sectionBodyClass}>{t.legal.liabilityNotice}</p>
      </section>
    </div>
  );
}
