'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/lib/i18n/types';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:border-slate-300">
        <Globe className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as SupportedLocale)}
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
          aria-label="Select language"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} — {l.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
