import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { UserMenu } from '@/components/header/UserMenu';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://famvacay.us'),
  title: 'FamVacay - Vacation Optimizer',
  description: 'Self-hostable vacation window optimization engine leveraging school holidays, departure savings, weather models, and PTO bridge days.',
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
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <SiteFooter />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
