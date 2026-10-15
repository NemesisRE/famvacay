import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { NavigationBar } from '@/components/navigation-bar';
import { LanguageSelector } from '@/components/language-selector';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FamVacay - Family Vacation Optimizer',
  description: 'Self-hostable vacation window optimization engine leveraging school holiday arbitrage, weather models, and PTO bridge days.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased flex flex-col">
        <AuthProvider>
          <I18nProvider>
            <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="font-bold text-xl tracking-tight text-slate-900">
                      Fam<span className="text-blue-600">Vacay</span>
                    </span>
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <LanguageSelector />
                  <NavigationBar />
                </div>
              </div>
            </header>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <span>FamVacay — Family Vacation &amp; Holiday Arbitrage Engine</span>
                <span className="hidden sm:inline">•</span>
                <a
                  href="https://github.com/example/famvac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate-800 transition-colors"
                >
                  Source code (AGPL-3.0)
                </a>
              </div>
            </footer>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
