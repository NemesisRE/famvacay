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
                  <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 hidden sm:inline">
                    Multi-User Ready
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <LanguageSelector />
                  <a
                    href="/api/health"
                    target="_blank"
                    className="flex items-center gap-1.5 hover:text-slate-900 font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 hidden md:flex"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Health
                  </a>
                  <NavigationBar />
                </div>
              </div>
            </header>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              FamVacay — Family Vacation & Holiday Arbitrage Engine — Multi-Arch Container Ready
            </footer>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
