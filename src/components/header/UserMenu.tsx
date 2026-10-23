'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/lib/i18n/types';
import { Settings, Sun, Moon, Globe, Check, Users, LogIn, LogOut } from 'lucide-react';
import { useDarkTheme, useIsClient } from '@/lib/client-stores';

export function UserMenu() {
  const { data: session, status } = useSession();
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // Theme: the class the layout's inline script applied; client flag without an effect
  const [isDark, setDark] = useDarkTheme();
  const mounted = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isOnProfile = pathname?.startsWith('/profile');

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent | PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleTheme = () => setDark(!isDark);

  const currentLocale = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800" />
        <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  const headerButtonClass =
    'h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-2xs flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer';

  // Account action in front of the options menu: sign in -> family profile -> (on the profile
  // page itself) sign out.
  const accountButton =
    status === 'loading' ? (
      <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800" />
    ) : status === 'authenticated' ? (
      isOnProfile ? (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className={headerButtonClass}
          title={`${t.nav.signOut} (${session.user?.name || session.user?.email || ''})`}
          aria-label={t.nav.signOut}
        >
          <LogOut className="w-4 h-4" />
          {/* Written out on phones too: an icon alone is easy to mistake on the profile page */}
          <span>{t.nav.signOut}</span>
        </button>
      ) : (
        <Link
          href="/profile"
          className={headerButtonClass}
          title={`${t.nav.familyProfile} (${session.user?.name || session.user?.email || ''})`}
          aria-label={t.nav.familyProfile}
        >
          <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="sm:hidden">{t.nav.profileShort}</span>
          <span className="hidden sm:inline">{t.nav.familyProfile}</span>
        </Link>
      )
    ) : (
      <Link href="/auth/signin" className={headerButtonClass} title={t.nav.signIn} aria-label={t.nav.signIn}>
        <LogIn className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        <span className="sm:hidden">{t.nav.signInShort}</span>
        <span className="hidden sm:inline">{t.nav.signIn}</span>
      </Link>
    );

  return (
    <div className="flex items-center gap-2">
      {accountButton}
      <div ref={containerRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={t.nav.menu}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-2xs flex items-center justify-center cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            role="menu"
            aria-label={t.nav.menu}
            className="absolute right-0 top-full mt-1.5 z-50 p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[220px] text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-150 space-y-1"
          >
            {/* Theme row */}
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t.nav.theme}
            </div>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
                {isDark ? t.nav.darkMode : t.nav.lightMode}
              </span>
            </button>

            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

            {/* Language rows */}
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {t.nav.language}
            </div>
            {SUPPORTED_LOCALES.map((l) => {
              const isSelected = currentLocale.code === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setLocale(l.code as SupportedLocale);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-medium'
                  }`}
                >
                  <span>{l.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
