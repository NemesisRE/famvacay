'use client';

import React, { useId, useState } from 'react';
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
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, viewportFit, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import {
  Info,
  X,
  Award,
  Zap,
  DollarSign,
  Calendar,
  Sun,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Utensils,
  Sparkles,
} from 'lucide-react';
import { CandidateWindow } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';
import { getSafetyTexts } from '@/components/destination/DestinationSafetyPopover';
import { workweekLabel } from '@/lib/holidays/workweek';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

interface MetricExplanationPopoverProps {
  window: CandidateWindow;
  className?: string;
  trigger?: 'score' | 'ptoRatio' | 'button';
  children?: React.ReactNode;
}

export function MetricExplanationPopover({
  window: win,
  className = '',
  trigger = 'button',
  children,
}: MetricExplanationPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      viewportFit(),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'top',
  });

  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const pricePct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown?.priceIndex ?? 50)));
  const ptoPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown?.ptoEfficiencyIndex ?? 50)));
  const weatherPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown?.weatherIndex ?? 50)));
  const frictionPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown?.travelFrictionIndex ?? 50)));

  const safety = win.destinationSafety || win.safetyAssessment;

  return (
    <div className={`inline-block ${className}`}>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {children ? (
          children
        ) : (
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
            title={t.home.metricExplainTitle}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999)}
            {...getFloatingProps()}
            className="w-80 sm:w-96 max-w-[94vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 text-slate-800 dark:text-slate-100 transition-all duration-150 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                  trigger === 'ptoRatio' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400'
                }`}>
                  {trigger === 'ptoRatio' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Award className="w-4 h-4" />
                  )}
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                  {trigger === 'ptoRatio' ? t.home.vacationFactorExplainTitle : t.home.scoreExplainTitle}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="font-extrabold text-sm whitespace-nowrap text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50">
                  {trigger === 'ptoRatio' ? `${win.ptoEfficiencyRatio}x` : `${win.finalScore} / 100`}
                </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              </div>
            </div>

            <div className="py-3.5 space-y-4 text-xs">
              {/* 1. Vacation Factor Explanation (shown for ptoRatio or generic button) */}
              {(trigger === 'ptoRatio' || trigger === 'button') && (
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-100 dark:border-slate-700/80 space-y-2">
                  <div className="bg-white dark:bg-slate-900/70 rounded-lg p-2 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px] text-center">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{win.durationDays} {t.home.days}</span>
                    {' ÷ '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{win.ptoDaysConsumed} {t.home.ptoConsumed}</span>
                    {' = '}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{win.ptoEfficiencyRatio}x</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.home.vacationFactorExplainDesc}
                  </p>
                  {win.workweekDays || win.sixDayWorkweek ? (
                    <WorkweekComparison window={win} />
                  ) : win.publicHolidaysCount > 0 && (
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/40 rounded-lg p-2 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-between text-[11px] text-emerald-900 dark:text-emerald-200 mt-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t.home.ptoSaved}</span>
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-700">
                        {win.publicHolidaysCount} {t.home.days}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Overall Score Breakdown (shown for score or generic button) */}
              {(trigger === 'score' || trigger === 'button') && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.home.scoreExplainDesc}
                  </p>

                  {/* 4 Pillars Progress Bars */}
                  <div className="space-y-2 pt-1">
                    {/* Pillar 1: Price & Dining Value (40%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          {t.home.scorePillarPrice}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{pricePct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${pricePct}%` }}
                        />
                      </div>
                      {win.mealPlanValue && win.mealPlanValue > 0 ? (
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <Utensils className="w-2.5 h-2.5" />
                          <span>
                            {t.home.boardTypeSavingsBadge}: +{win.mealPlanValue} €
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Pillar 2: PTO Efficiency (30%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          {t.home.scorePillarPto}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ptoPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all duration-300"
                          style={{ width: `${ptoPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Pillar 3: Weather & Climate (20%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                          <Sun className="w-3 h-3 text-amber-500" />
                          {t.home.scorePillarWeather}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{weatherPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${weatherPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Pillar 4: Travel Proximity (10%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          {t.home.scorePillarFriction}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{frictionPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${frictionPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Active Environmental & Seasonal Warning Penalty Notice */}
                    {win.seasonalWarningImpact && (
                      <div className="text-[10px] text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/90 dark:border-rose-900/50 rounded-lg p-2 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          {t.home.seasonalPenaltyNotice}: {win.seasonalWarningImpact.reason}
                        </span>
                        <span className="font-extrabold text-rose-700 dark:text-rose-300 shrink-0 ml-1">
                          -{win.seasonalWarningPenalty || win.seasonalWarningImpact.overallScorePenalty} {t.home.pointsShort}
                        </span>
                      </div>
                    )}

                    {/* Layover / Connection Transfer Penalty Notice */}
                    {win.flightStops !== undefined && win.flightStops > 0 && (
                      <div className="text-[10px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/50 rounded-lg p-2 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          {t.home.layoverPenaltyNotice} ({win.flightStops === 1 ? t.home.oneStopFlight : t.home.multipleStopsFlight.replace('{stops}', String(win.flightStops))})
                        </span>
                        <span className="font-extrabold text-amber-800 dark:text-amber-300 shrink-0 ml-1">
                          -{win.layoverPenalty || (win.flightStops === 1 ? 5 : 12)} {t.home.pointsShort}
                        </span>
                      </div>
                    )}

                    {/* Off-Peak Bonus Notice */}
                    {win.offPeakBonus && win.offPeakBonus > 0 && (
                      <div className="text-[10px] text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/90 dark:border-teal-900/50 rounded-lg p-2 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          {t.home.offPeakBonusBadge}: {t.home.offPeakBonusDesc}
                        </span>
                        <span className="font-extrabold text-teal-700 dark:text-teal-300 shrink-0 ml-1">
                          +{win.offPeakBonus} {t.home.pointsShort}
                        </span>
                      </div>
                    )}

                    {/* Value-for-Money / Duration Bonus Notice */}
                    {win.valueForMoneyBonus && win.valueForMoneyBonus > 0 && (
                      <div className="text-[10px] text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/90 dark:border-teal-900/50 rounded-lg p-2 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          {t.home.valueForMoneyBadge}: {t.home.valueForMoneyDesc}
                        </span>
                        <span className="font-extrabold text-teal-700 dark:text-teal-300 shrink-0 ml-1">
                          +{win.valueForMoneyBonus} {t.home.pointsShort}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Safety Detail Footer (shown for score or generic button) */}
              {(trigger === 'score' || trigger === 'button') && safety && (
                <div
                  className={`rounded-xl p-2.5 text-[11px] border flex items-start gap-2 ${
                    safety.isSafe
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {safety.isSafe ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold block">
                      {getSafetyTexts(safety, t).badgeLabel} · {t.home.safetyUsLevelChip.replace('{level}', String(safety.advisoryLevel || safety.usStateDeptLevel || 1))}: {getSafetyTexts(safety, t).usLevelText}
                    </span>
                    <span className="text-[10px] block opacity-80">
                      {t.home.safetySourcesShort}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

interface WorkweekColumn {
  days: number[];
  ptoDaysConsumed: number;
  publicHolidaysCount: number;
  ptoEfficiencyRatio: number;
}

/**
 * PTO days of the trip for the family's workweek (their own or their country's usual one, e.g.
 * Sunday-Thursday) and the six-day weeks next to it: the extra workday costs PTO, and a public
 * holiday on it saves one. Columns are labelled with the actual weekdays.
 */
function WorkweekComparison({ window: win }: { window: CandidateWindow }) {
  const { t, locale } = useI18n();
  const titleId = useId();
  // Results from before the workweek was stored: Monday-Friday next to Monday-Saturday
  const ownDays = win.workweekDays ?? [1, 2, 3, 4, 5];
  const variants = win.workweekVariants ?? (win.sixDayWorkweek ? [{ days: [1, 2, 3, 4, 5, 6], ...win.sixDayWorkweek }] : []);
  const columns: WorkweekColumn[] = [
    { days: ownDays, ptoDaysConsumed: win.ptoDaysConsumed, publicHolidaysCount: win.publicHolidaysCount, ptoEfficiencyRatio: win.ptoEfficiencyRatio },
    ...variants,
  ];
  const rows: { label: string; value: (c: WorkweekColumn) => string; highlight?: boolean }[] = [
    { label: t.home.ptoConsumed, value: (c) => `${c.ptoDaysConsumed}`, highlight: true },
    { label: t.home.workweekHolidaysSaved, value: (c) => `${c.publicHolidaysCount}` },
    { label: t.home.workweekFactor, value: (c) => `${c.ptoEfficiencyRatio}x` },
  ];
  const cell = 'text-right tabular-nums px-2 py-1 border-t border-slate-100 dark:border-slate-800 whitespace-nowrap';
  return (
    <div className="space-y-1.5 pt-1">
      <p id={titleId} className="font-semibold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        {t.home.workweekComparisonTitle}
      </p>
      <table
        aria-labelledby={titleId}
        className="w-full text-[11px] border-separate border-spacing-0 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700"
      >
        <thead>
          <tr className="bg-white dark:bg-slate-900/70 text-slate-500 dark:text-slate-400">
            <td />
            {columns.map((c, i) => (
              <th key={c.days.join()} scope="col" className="text-right font-semibold px-2 py-1 whitespace-nowrap">
                {workweekLabel(c.days, locale)}
                {i === 0 && variants.length > 0 && <span className="sr-only"> ({t.home.workweekYours})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="bg-white dark:bg-slate-900/70">
              <th scope="row" className="text-left font-medium text-slate-600 dark:text-slate-300 px-2 py-1 border-t border-slate-100 dark:border-slate-800">
                {row.label}
              </th>
              {columns.map((c) => (
                <td
                  key={c.days.join()}
                  className={`${cell} ${row.highlight ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-semibold text-slate-800 dark:text-slate-100'}`}
                >
                  {row.value(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {variants.length > 0 ? t.home.workweekSixDayHint : t.home.workweekOwnHint}
      </p>
    </div>
  );
}
