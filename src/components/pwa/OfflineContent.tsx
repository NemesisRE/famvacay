'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export function OfflineContent() {
  const { t } = useI18n();
  return (
    <div className="max-w-md mx-auto text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-4 my-8">
      <WifiOff className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500" aria-hidden="true" />
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.offline.title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.offline.body}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold cursor-pointer"
        >
          {t.offline.retry}
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t.offline.home}
        </Link>
      </div>
    </div>
  );
}
