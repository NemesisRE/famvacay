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
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            {t.nav.familyProfile}
          </Link>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title={t.nav.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <Link
          href="/auth/signin"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
        >
          <LogIn className="w-3.5 h-3.5" />
          {t.nav.signIn}
        </Link>
      )}
    </div>
  );
}
