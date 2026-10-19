'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { CandidateWindow } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';

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

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'top',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const pricePct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown.priceIndex)));
  const ptoPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown.ptoEfficiencyIndex)));
  const weatherPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown.weatherIndex)));
  const frictionPct = Math.min(100, Math.max(0, Math.round(win.scoreBreakdown.travelFrictionIndex)));

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
            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
            title={t.home.metricExplainTitle}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 99999,
            }}
            {...getFloatingProps()}
            className="w-80 sm:w-96 max-w-[94vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 text-slate-800 transition-all duration-150 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 leading-tight">
                    {t.home.metricExplainTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {t.home.metricExplainSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3.5 space-y-4 text-xs">
              {/* 1. Vacation Factor Explanation */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    {t.home.vacationFactorExplainTitle}
                  </span>
                  <span className="font-extrabold text-sm text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-xs">
                    {win.ptoEfficiencyRatio}x
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200/70 text-slate-700 font-mono text-[11px] text-center">
                  <span className="font-semibold text-slate-900">{win.durationDays} {t.home.days}</span>
                  {' ÷ '}
                  <span className="font-semibold text-indigo-600">{win.ptoDaysConsumed} {t.home.ptoConsumed}</span>
                  {' = '}
                  <span className="font-bold text-emerald-600">{win.ptoEfficiencyRatio}x Free Time</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {t.home.vacationFactorExplainDesc}
                </p>
              </div>

              {/* 2. Overall Score Breakdown */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    {t.home.scoreExplainTitle}
                  </span>
                  <span className="font-extrabold text-indigo-900 text-sm">
                    {win.finalScore} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {t.home.scoreExplainDesc}
                </p>

                {/* 4 Pillars Progress Bars */}
                <div className="space-y-2 pt-1">
                  {/* Pillar 1: Price & Dining Value (40%) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        {t.home.scorePillarPrice}
                      </span>
                      <span className="font-bold text-slate-800">{pricePct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${pricePct}%` }}
                      />
                    </div>
                    {win.mealPlanValue && win.mealPlanValue > 0 ? (
                      <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                        <Utensils className="w-2.5 h-2.5" />
                        <span>
                          {t.home.boardTypeSavingsBadge}: +€{win.mealPlanValue} credit
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Pillar 2: PTO Efficiency (30%) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-blue-600" />
                        {t.home.scorePillarPto}
                      </span>
                      <span className="font-bold text-slate-800">{ptoPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${ptoPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Pillar 3: Weather & Climate (20%) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-500" />
                        {t.home.scorePillarWeather}
                      </span>
                      <span className="font-bold text-slate-800">{weatherPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${weatherPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Pillar 4: Travel Proximity (10%) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-indigo-600" />
                        {t.home.scorePillarFriction}
                      </span>
                      <span className="font-bold text-slate-800">{frictionPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${frictionPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Safety Detail Footer */}
              {safety && (
                <div
                  className={`rounded-xl p-2.5 text-[11px] border flex items-start gap-2 ${
                    safety.isSafe
                      ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {safety.isSafe ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold block">
                      {safety.advisoryTitle || safety.safetyLabel}
                    </span>
                    <span className="text-[10px] block opacity-80">
                      {safety.source || 'Auswärtiges Amt & US State Dept'}
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
