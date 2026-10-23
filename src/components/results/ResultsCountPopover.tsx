'use client';

import { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { ChevronDown, Eye, X } from 'lucide-react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, viewportFit, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { ResultFilterKey } from '@/lib/results/result-filters';

export interface ResultsCountRow {
  key: ResultFilterKey;
  warningKey?: string;
  label: string;
  excluded: number;
}

interface ResultsCountPopoverProps {
  shown: number;
  total: number;
  rows: ResultsCountRow[];
  onInclude: (key: ResultFilterKey, warningKey?: string) => void;
  onIncludeAll: () => void;
}

/**
 * "1155 / 1190 Reisefenster gefunden" with an explanation of the difference: which filter hides
 * how many windows, each with a button to include them again.
 */
export function ResultsCountPopover({ shown, total, rows, onInclude, onIncludeAll }: ResultsCountPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const isSmallScreen = useIsSmallScreen();
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 }), viewportFit()],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context, POPOVER_DISMISS_OPTIONS), useRole(context)]);
  const hidden = total - shown;

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={hidden > 0 ? t.home.resultsBreakdownTitle : undefined}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 text-[11px] hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
      >
        <span>
          {shown} / {total} {t.home.windowsFound}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            className="w-80 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-800 dark:text-slate-100 space-y-2 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.home.resultsBreakdownTitle}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.common.close}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex justify-between font-semibold">
              <span>{t.home.resultsBreakdownFound}</span>
              <span>{total}</span>
            </div>

            {rows.map((row) => (
              <div key={row.warningKey ? `${row.key}:${row.warningKey}` : row.key} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="min-w-0 truncate" title={row.label}>− {row.label}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="tabular-nums text-rose-600 dark:text-rose-400 font-semibold">−{row.excluded}</span>
                  <button
                    type="button"
                    onClick={() => onInclude(row.key, row.warningKey)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    {t.home.resultsBreakdownInclude}
                  </button>
                </span>
              </div>
            ))}

            <div className="flex justify-between font-bold pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span>{t.home.resultsBreakdownShown}</span>
              <span>{shown}</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.resultsBreakdownNoneHidden}</p>
            ) : (
              <>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.home.resultsBreakdownNote}</p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={onIncludeAll}
                    className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                  >
                    {t.home.resultsBreakdownIncludeAll}
                  </button>
                )}
              </>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
