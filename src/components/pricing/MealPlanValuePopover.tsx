'use client';

import { useId, useState } from 'react';
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
import { Info, Utensils, X } from 'lucide-react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, viewportFit, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';
import { MEAL_PLAN_DAILY_VALUE, MEAL_VALUE_CREDIT_SHARE, type MealPlanRates } from '@/lib/pricing/meal-plan-value';

interface MealPlanValuePopoverProps {
  /** Estimated value of the included meals for the whole stay, in euros */
  mealPlanValue: number;
  /** Length of the trip in days (the stay has one night less) */
  durationDays: number;
  /** Rates at the destination's price level (results from before it existed: the base rates) */
  rates?: MealPlanRates;
  className?: string;
}

/**
 * The catering advantage of an all-inclusive stay as a button that explains it: what the included
 * meals are worth at the destination (per adult and child and night, at the local price level),
 * and how much of it counts for ranking.
 */
export function MealPlanValuePopover({ mealPlanValue, durationDays, rates: localRates, className = '' }: MealPlanValuePopoverProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));
  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip({ fallbackAxisSideDirection: 'end', padding: 12 }), shift({ padding: 12 }), viewportFit()],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-end',
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, POPOVER_DISMISS_OPTIONS),
    useRole(context, { role: 'dialog' }),
  ]);

  const euros = (value: number) => Math.round(value).toLocaleString(locale);
  const countryName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  // Same nights as the pricing (pricing-service): one less than the days of the trip
  const nights = Math.max(1, durationDays - 1);
  const rates = localRates ?? { ...MEAL_PLAN_DAILY_VALUE.ALL_INCLUSIVE, priceFactor: 1 };
  const titleId = useId();

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={t.home.mealValueShowDetails}
        className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 rounded cursor-pointer group hover:text-emerald-800 dark:hover:text-emerald-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Utensils className="w-2.5 h-2.5 shrink-0" />
        <span className="underline decoration-dotted decoration-emerald-500/70 underline-offset-2 group-hover:decoration-solid">
          {t.home.boardTypeSavingsBadge}: ~€{euros(mealPlanValue)}
        </span>
        <Info className="w-2.5 h-2.5 shrink-0 opacity-70 group-hover:opacity-100" aria-hidden="true" />
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            aria-labelledby={titleId}
            className="animate-in fade-in zoom-in-95 w-72 sm:w-80 max-w-[94vw] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 text-slate-800 dark:text-slate-100 text-left"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h4 id={titleId} className="flex items-center gap-1.5 font-bold text-xs">
                <Utensils className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {t.home.boardTypeSavingsBadge}
              </h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.common.close}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="pt-3 space-y-2.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              <p>{t.home.mealValueExplainWhat}</p>
              <p>{t.home.mealValueExplainRates.replace('{adult}', euros(rates.adult)).replace('{child}', euros(rates.child))}</p>
              {/* Compared with the travellers' own country, never with a fixed region */}
              {rates.homeComparison ? (
                <p>
                  {t.home.mealValueExplainLocal
                    .replace('{percent}', String(rates.homeComparison.percent))
                    .replace('{country}', countryName(rates.homeComparison.country))}
                </p>
              ) : (
                rates.priceFactor !== 1 && <p>{t.home.mealValueExplainLocalNeutral}</p>
              )}
              <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 px-2.5 py-2 font-mono text-[11px] text-center text-emerald-900 dark:text-emerald-200">
                {t.home.mealValueExplainTotal
                  .replace('{perNight}', euros(mealPlanValue / nights))
                  .replace('{nights}', String(nights))
                  .replace('{total}', euros(mealPlanValue))}
              </div>
              <p>{t.home.mealValueExplainRanking.replace('{share}', String(Math.round(MEAL_VALUE_CREDIT_SHARE * 100)))}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.home.mealValueExplainPrice}</p>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
