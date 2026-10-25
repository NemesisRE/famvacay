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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://famvacay.us'),
  title: 'FamVacay - Vacation Optimizer',
  description: 'Self-hostable vacation window optimization engine leveraging school holidays, departure savings, weather models, and PTO bridge days.',
  applicationName: 'FamVacay',
  // Installed to the home screen (iOS reads these instead of the web app manifest)
  appleWebApp: { capable: true, title: 'FamVacay', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('famvac_theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased flex flex-col transition-colors">
        <AuthProvider>
          <I18nProvider>
            <ConsentUiProvider>
              <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2">
                      <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                        Fam<span className="text-teal-600 dark:text-teal-400">Vacay</span>
                      </span>
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
