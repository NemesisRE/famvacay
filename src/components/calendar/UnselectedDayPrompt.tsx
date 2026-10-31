'use client';

import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Shown over a calendar popover when it is about to close after a month/year change without a
 * day: keep choosing (focused, the safe default) or close without a change. An overlay inside the
 * (positioned) popover, so the popover keeps its size and position.
 */
export function UnselectedDayPrompt({ onKeepChoosing, onDiscard }: { onKeepChoosing: () => void; onDiscard: () => void }) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-3 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-[2px] animate-in fade-in">
      <div
        role="alertdialog"
        aria-labelledby="calendar-unselected-title"
        aria-describedby="calendar-unselected-body"
        data-testid="calendar-unselected-prompt"
        className="w-full max-w-[16rem] p-3 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/60 shadow-lg text-xs text-amber-900 dark:text-amber-100 space-y-2"
      >
        <p id="calendar-unselected-title" className="font-bold flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{t.calendar.noDaySelectedTitle}</span>
        </p>
        <p id="calendar-unselected-body" className="text-[11px] leading-snug">
          {t.calendar.noDaySelectedBody}
        </p>
        {/* Stacked, equally wide, centered */}
        <div className="grid grid-cols-1 gap-1.5 pt-0.5">
          <button
            type="button"
            autoFocus
            onClick={onKeepChoosing}
            className="w-full px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-center cursor-pointer"
          >
            {t.calendar.keepChoosing}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white/60 dark:bg-transparent hover:bg-amber-100 dark:hover:bg-amber-900/40 font-semibold text-center cursor-pointer"
          >
            {t.calendar.closeWithoutChange}
          </button>
        </div>
      </div>
    </div>
  );
}
