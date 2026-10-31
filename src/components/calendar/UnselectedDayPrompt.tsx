'use client';

import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Shown inside a calendar popover when it is about to close after a month/year change without a
 * day: keep choosing (focused, the safe default) or close without a change.
 */
export function UnselectedDayPrompt({ onKeepChoosing, onDiscard }: { onKeepChoosing: () => void; onDiscard: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role="alertdialog"
      aria-labelledby="calendar-unselected-title"
      aria-describedby="calendar-unselected-body"
      data-testid="calendar-unselected-prompt"
      className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-100 max-w-[18rem] space-y-2"
    >
      <p id="calendar-unselected-title" className="font-bold flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>{t.calendar.noDaySelectedTitle}</span>
      </p>
      <p id="calendar-unselected-body" className="text-[11px] leading-snug">
        {t.calendar.noDaySelectedBody}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          autoFocus
          onClick={onKeepChoosing}
          className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
        >
          {t.calendar.keepChoosing}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-semibold cursor-pointer"
        >
          {t.calendar.closeWithoutChange}
        </button>
      </div>
    </div>
  );
}
