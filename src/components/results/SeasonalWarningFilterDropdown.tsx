'use client';

import { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import {
  useIsSmallScreen,
  getResponsivePopoverStyle,
  PopoverBackdrop,
  POPOVER_DISMISS_OPTIONS,
} from '@/components/ui/responsive-popover';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

export interface SeasonalWarningOption {
  key: string;
  label: string;
  count: number;
}

export interface SeasonalWarningFilterDropdownProps {
  warningOptions: SeasonalWarningOption[];
  warningFilter: 'CLEAN_ONLY' | 'ALL';
  allowedWarnings: string[];
  onChange: (nextFilter: 'CLEAN_ONLY' | 'ALL', nextAllowed: string[]) => void;
  cleanCount: number;
  totalCount: number;
  className?: string;
}

export function SeasonalWarningFilterDropdown({
  warningOptions,
  warningFilter,
  allowedWarnings,
  onChange,
  cleanCount,
  totalCount,
  className = '',
}: SeasonalWarningFilterDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ elements, availableHeight }) {
          elements.floating.style.setProperty('--menu-available-height', `${Math.max(200, availableHeight)}px`);
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });

  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const allKeys = warningOptions.map((o) => o.key);
  const effectiveAllowed =
    warningFilter === 'ALL'
      ? allKeys
      : allowedWarnings.filter((k) => allKeys.includes(k) || warningOptions.length === 0);

  const isDefaultClean = warningFilter === 'CLEAN_ONLY' && effectiveAllowed.length === 0;
  const isAllShown = warningFilter === 'ALL' || (allKeys.length > 0 && allKeys.every((k) => effectiveAllowed.includes(k)));

  const handleToggleWarningKey = (key: string) => {
    const currentlyChecked = warningFilter === 'ALL' || effectiveAllowed.includes(key);
    if (currentlyChecked) {
      const next = (warningFilter === 'ALL' ? allKeys : effectiveAllowed).filter((k) => k !== key);
      onChange('CLEAN_ONLY', next);
    } else {
      const next = Array.from(new Set([...effectiveAllowed, key]));
      if (allKeys.length > 0 && allKeys.every((k) => next.includes(k))) {
        onChange('ALL', next);
      } else {
        onChange('CLEAN_ONLY', next);
      }
    }
  };

  const getButtonLabel = () => {
    if (isAllShown) {
      return `${t.home.warningsFilterAll} (${totalCount})`;
    }
    if (effectiveAllowed.length === 0) {
      return `${t.home.warningsFilterCleanOnly} (${cleanCount})`;
    }
    if (effectiveAllowed.length === 1) {
      const match = warningOptions.find((o) => o.key === effectiveAllowed[0]);
      return match ? `${match.label} (${match.count})` : effectiveAllowed[0];
    }
    const firstMatch = warningOptions.find((o) => o.key === effectiveAllowed[0]);
    const firstName = firstMatch ? firstMatch.label : effectiveAllowed[0];
    return `${firstName} (+${effectiveAllowed.length - 1})`;
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          ref={refs.setReference}
          {...getReferenceProps()}
          type="button"
          data-testid="seasonal-warning-filter-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs select-none ${
            !isDefaultClean
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold hover:bg-teal-100/70 dark:hover:bg-teal-900/40'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
          title={t.home.filterByWarnings}
        >
          <span className="truncate">{getButtonLabel()}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            style={{
              ...getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999),
              maxHeight: isSmallScreen ? '85vh' : 'min(var(--menu-available-height, 26rem), 26rem)',
              overflowY: 'hidden',
            }}
            {...getFloatingProps()}
            className="w-80 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-100 transition-all duration-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-1.5 px-1 border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.home.filterByWarnings}
              </span>
              {!isDefaultClean && (
                <button
                  type="button"
                  onClick={() => onChange('CLEAN_ONLY', [])}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {t.home.warningsFilterCleanOnly}
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 space-y-0.5">
              {/* Hide all warnings */}
              <button
                type="button"
                onClick={() => onChange('CLEAN_ONLY', [])}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                  isDefaultClean
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isDefaultClean
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {isDefaultClean && <Check className="w-3 h-3 stroke-3" />}
                  </div>
                  <span>{t.home.warningsFilterCleanOnly}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  ({cleanCount})
                </span>
              </button>

              {/* Show all warnings */}
              <button
                type="button"
                onClick={() => onChange('ALL', allKeys)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                  isAllShown
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isAllShown
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {isAllShown && <Check className="w-3 h-3 stroke-3" />}
                  </div>
                  <span>{t.home.warningsFilterAll}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  ({totalCount})
                </span>
              </button>

              {/* Individual Warning Types */}
              {warningOptions.length > 0 && (
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                  {warningOptions.map((opt) => {
                    const isSelected = warningFilter === 'ALL' || effectiveAllowed.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleToggleWarningKey(opt.key)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-3" />}
                          </div>
                          <span className="truncate" title={opt.label}>
                            {opt.label}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                            isSelected
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Done button */}
            <div className="shrink-0 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                {t.common.done}
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

