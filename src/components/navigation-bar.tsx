'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { Users, LogIn, LogOut } from 'lucide-react';

export function NavigationBar() {
  const { data: session, status } = useSession();
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3">
      {status === 'authenticated' ? (
        <>
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
          >
            <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            {t.nav.familyProfile}
          </Link>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={t.nav.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <Link
          href="/auth/signin"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition"
        >
          <LogIn className="w-3.5 h-3.5" />
          {t.nav.signIn}
        </Link>
      )}
    </div>
  );
}
