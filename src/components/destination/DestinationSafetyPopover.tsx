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
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  X,
  Shield,
  Info,
  ExternalLink,
} from 'lucide-react';
import { DestinationSafetyAssessment } from '@/lib/safety/safety-service';
import { useI18n } from '@/lib/i18n/i18n-context';

interface DestinationSafetyPopoverProps {
  safety?: DestinationSafetyAssessment;
  destinationName?: string;
  countryName?: string;
  className?: string;
  compact?: boolean;
}

export function DestinationSafetyPopover({
  safety,
  destinationName,
  countryName,
  className = '',
  compact = false,
}: DestinationSafetyPopoverProps) {
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
    placement: 'bottom-start',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  if (!safety) return null;

  const isSafe = safety.isSafe ?? safety.isSafeForFamilies ?? true;
  const advisoryLevel = safety.advisoryLevel || safety.usStateDeptLevel || 1;
  const score = Math.round(safety.score || (isSafe ? 90 : 35));

  // Badge styling based on safety level
  const badgeStyle = isSafe
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
    : safety.level === 'WARNING'
    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
    : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100';

  // Badge label
  const badgeLabel = isSafe
    ? t.home.safeDestinationBadge
    : safety.advisoryTitle || safety.safetyLabel || t.home.safetyStatusWarning;

  const scoreBadgeBg =
    score >= 75
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : score >= 50
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-rose-100 text-rose-800 border-rose-200';

  // Determine US State Dept Level color
  const usLevelBg =
    advisoryLevel === 1
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : advisoryLevel === 2
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : advisoryLevel === 3
      ? 'bg-orange-50 text-orange-800 border-orange-200'
      : 'bg-rose-50 text-rose-800 border-rose-200';

  // German AA Status
  const germanStatus = safety.hasGermanWarning
    ? { text: t.home.safetyGermanFullWarning, color: 'bg-rose-50 text-rose-800 border-rose-200' }
    : safety.hasGermanPartialWarning
    ? { text: t.home.safetyGermanPartialWarning, color: 'bg-amber-50 text-amber-800 border-amber-200' }
    : { text: t.home.safetyGermanNoWarning, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };

  const displayName = destinationName || safety.countryName || countryName || 'Destination';

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger Pill Badge */}
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold shadow-2xs cursor-pointer transition select-none ${badgeStyle}`}
        title={`${badgeLabel} — Details anzeigen`}
      >
        {isSafe ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : safety.level === 'WARNING' ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        )}
        <span className="truncate max-w-[200px] sm:max-w-[280px]">{badgeLabel}</span>
        <span className="opacity-60 group-hover:opacity-100 text-[10px] font-normal transition-opacity ml-0.5">
          ℹ
        </span>
      </button>

      {/* Floating Popout Modal */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            onClick={(e) => e.stopPropagation()}
            className="z-50 w-[92vw] max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
          >
            {/* Popout Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSafe ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isSafe ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                    {displayName}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {t.home.safetyPopoutSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${scoreBadgeBg}`}
                  title={`${t.home.safetyScoreLabel}: ${score} / 100`}
                >
                  {score}/100
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contextual Travel Advisory Breakdown */}
            <div className="space-y-3">
              {/* 1. Auswärtiges Amt Status */}
              <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    {t.home.safetyGermanWarning}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${germanStatus.color}`}>
                    {safety.hasGermanWarning
                      ? 'Reisewarnung'
                      : safety.hasGermanPartialWarning
                      ? 'Teilreisewarnung'
                      : 'Sicher'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {germanStatus.text}
                </p>
              </div>

              {/* 2. US State Department Advisory */}
              <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    {t.home.safetyUsLevel}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${usLevelBg}`}>
                    Level {advisoryLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  {safety.advisoryTitle || `Level ${advisoryLevel}: Exercise Normal Precautions`}
                </p>
              </div>

              {/* 3. Specific Risks & Contextual Notes (if any) */}
              {(safety.warningDetails || (!isSafe && safety.advisoryTitle)) && (
                <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-xl p-3 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 space-y-1">
                  <span className="text-[11px] font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    {t.home.safetySpecificRisks}
                  </span>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-medium">
                    {safety.warningDetails || safety.advisoryTitle}
                  </p>
                </div>
              )}
            </div>

            {/* Footer with Source & Verification */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{t.home.safetyDataSource}</span>
              </span>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

