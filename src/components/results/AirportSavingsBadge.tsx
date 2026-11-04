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
import { Sparkles, X } from 'lucide-react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, viewportFit, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

interface AirportSavingsBadgeProps {
  originAirport: string;
  /** City of the departure airport, used in the texts instead of the bare IATA code */
  originCity?: string;
  /** The airport was picked automatically (shown with the "best airport" wording) */
  autoSelected?: boolean;
  /** gold: fare advantage; green: plain automatic pick */
  variant?: 'gold' | 'green';
}

/**
 * Gold variant of the "best airport" badge for departure airports with a fare advantage (the home
 * region is on school holiday, the airport's region is not). It replaces the full-width banner,
 * which pushed the card content down and broke the row alignment between neighbouring cards.
 */
export function AirportSavingsBadge({ originAirport, originCity, autoSelected, variant = 'gold' }: AirportSavingsBadgeProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));
  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(8), flip({ fallbackAxisSideDirection: 'end', padding: 12 }), shift({ padding: 12 }), viewportFit()],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const isGold = variant === 'gold';
  const label = autoSelected || !isGold ? t.home.autoOriginBadge : t.home.arbitrageBadge;
  const city = originCity || originAirport;
  const explain = isGold ? t.home.arbitrageExplain.replace('{city}', city) : t.home.autoOriginExplain;
  const heading = `${label} · ${originCity ? `${originCity} (${originAirport})` : originAirport}`;
  const tone = isGold
    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-500 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'
    : 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
  const iconTone = isGold ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`group text-[11px] font-bold px-2 py-0.5 rounded-full border border-dashed flex items-center gap-1 cursor-pointer transition select-none ${tone}`}
        title={heading}
      >
        <Sparkles className={`w-3 h-3 ${iconTone}`} />
        {label} · {originAirport}
        <span className="opacity-60 group-hover:opacity-100 text-[10px] font-normal transition-opacity">ℹ</span>
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            onClick={(e) => e.stopPropagation()}
            className="z-50 w-[92vw] max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-600 dark:ring-1 dark:ring-white/10 dark:shadow-black/70 text-slate-800 dark:text-slate-100 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 focus:outline-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                {heading}
              </h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                title={t.common.close}
                aria-label={t.common.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{explain}</p>
            {isGold && autoSelected && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.autoOriginExplain}</p>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
