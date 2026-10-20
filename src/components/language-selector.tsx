'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/lib/i18n/types';
import { Globe, ChevronDown, Check } from 'lucide-react';

export function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or tap
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

  const current = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20"
      >
        <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200 tracking-wide">
          {current.code.toUpperCase()}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Language selection"
          className="absolute right-0 top-full mt-1.5 z-50 p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[170px] text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-150 space-y-0.5"
        >
          {SUPPORTED_LOCALES.map((l) => {
            const isSelected = locale === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={isSelected}
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
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-slate-100">{l.name}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                    ({l.code.toUpperCase()})
                  </span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

