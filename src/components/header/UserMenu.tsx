'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/lib/i18n/types';
import { Settings, Sun, Moon, Globe, Check, Users, LogIn, LogOut } from 'lucide-react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('famvac_theme');
      if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
      } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('famvac_theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // Storage error
    }
  };

  const currentLocale = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  if (!mounted) {
    return <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800" />;
  }

  return (
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
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              {theme === 'dark' ? t.nav.darkMode : t.nav.lightMode}
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
                onClick={() => setLocale(l.code as SupportedLocale)}
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

          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

          {/* Auth rows */}
          {status === 'authenticated' ? (
            <>
              <div className="px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {session.user?.name || session.user?.email}
              </div>
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              >
                <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {t.nav.familyProfile}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                {t.nav.signOut}
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors bg-teal-600 hover:bg-teal-700 text-white"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t.nav.signIn}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
