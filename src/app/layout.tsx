import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { UserMenu } from '@/components/header/UserMenu';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MainContent } from '@/components/layout/MainContent';
import { ConsentUiProvider } from '@/lib/consent/cookie-consent-context';
import { CookiePrivacyBanner } from '@/components/consent/CookiePrivacyBanner';
import { UmamiAnalytics } from '@/components/analytics/UmamiAnalytics';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { ThemeSync } from '@/components/theme/ThemeSync';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { getRequestLocale } from '@/lib/i18n/server-locale';
import localFont from 'next/font/local';
import { dictionaries } from '@/lib/i18n/dictionaries';
import type { SupportedLocale } from '@/lib/i18n/types';
import { getSiteUrl, jsonLdString } from '@/lib/seo/site';

// Brand typeface (SIL OFL), self-hosted: the CSP allows fonts from our own origin only
const outfit = localFont({
  src: './fonts/outfit-variable.woff2',
  variable: '--font-outfit',
  weight: '100 900',
  display: 'swap',
});

const OG_IMAGE = { url: '/brand/fv-og-1200x630.png', width: 1200, height: 630, alt: 'FamVacay' };
const OG_LOCALES: Record<SupportedLocale, string> = { en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', it: 'it_IT' };

/** Titles and descriptions in the visitor's language (crawlers without a cookie get Accept-Language, else English) */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const { seo } = dictionaries[locale];
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: seo.homeTitle, template: '%s | FamVacay' },
    description: seo.homeDescription,
    applicationName: 'FamVacay',
    // One URL per page whatever the language (it is chosen by cookie), so no hreflang alternates
    alternates: { canonical: '/' },
    // Installed to the home screen (iOS reads these instead of the web app manifest)
    appleWebApp: { capable: true, title: 'FamVacay', statusBarStyle: 'default' },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '32x32' },
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
    // The app is translated itself: browser translation would rewrite React-managed text nodes
    // (wrapping them in <font>) and crash the next DOM update with removeChild/insertBefore errors
    other: { google: 'notranslate' },
    openGraph: {
      type: 'website',
      siteName: 'FamVacay',
      title: seo.homeTitle,
      description: seo.homeDescription,
      url: '/',
      locale: OG_LOCALES[locale],
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: seo.homeTitle, description: seo.homeDescription, images: [OG_IMAGE.url] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rendered in the visitor's language from the first byte (cookie, otherwise Accept-Language)
  const locale = await getRequestLocale();
  const { seo } = dictionaries[locale];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'FamVacay',
    url: getSiteUrl(),
    description: seo.homeDescription,
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: locale,
    image: `${getSiteUrl()}/brand/fv-og-1200x630.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return (
    <html lang={locale} translate="no" className={`notranslate ${outfit.variable}`} suppressHydrationWarning>
      <head>
        {/* Theme before first paint (no flash); ThemeSync keeps it once React has taken over */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(structuredData) }} />
      </head>
      <body className="min-h-screen bg-brand-light dark:bg-slate-950 text-brand-slate dark:text-slate-100 antialiased flex flex-col transition-colors">
        <ThemeSync />
        <AuthProvider>
          <I18nProvider initialLocale={locale}>
            <ConsentUiProvider>
              <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-brand-slate/80 backdrop-blur-sm sticky top-0 z-50 transition-colors">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center" aria-label="FamVacay">
                      {/* Phones: the animated mark (builds up once, static with reduced motion) next to the outlined wordmark */}
                      <span className="flex items-center gap-1.5 sm:hidden" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/fv-mark-animated.svg" alt="" width={34} height={36} className="h-9 w-auto dark:hidden" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/fv-mark-animated-dark.svg" alt="" width={34} height={36} className="hidden h-9 w-auto dark:block" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/fv-wordmark.svg" alt="" width={94} height={21} className="h-[21px] w-auto dark:hidden" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/fv-wordmark-dark.svg" alt="" width={94} height={21} className="hidden h-[21px] w-auto dark:block" />
                      </span>
                      {/* Brand lockup (wordmark is outlined, so it needs no font); one file per theme */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/fv-lockup.svg" alt="FamVacay" width={132} height={36} className="hidden h-9 w-auto sm:block dark:sm:hidden" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/fv-lockup-dark.svg" alt="" aria-hidden="true" width={132} height={36} className="hidden h-9 w-auto dark:sm:block" />
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <UserMenu />
                  </div>
                </div>
              </header>
              <MainContent>{children}</MainContent>
              <SiteFooter />
              <CookiePrivacyBanner />
              <UmamiAnalytics />
              <ServiceWorkerRegistration />
            </ConsentUiProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
