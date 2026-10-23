'use client';

import { useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import type { DestinationType } from '@/lib/optimizer/types';

export const LONG_RANGE_STYLE_OPTIONS: DestinationType[] = ['BEACH', 'CITY', 'NATURE', 'ALPINE'];

interface LongRangeStylePopoverProps {
  longRangeStyles: DestinationType[];
  onChange: (styles: DestinationType[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
}

/**
 * Inline selector on the long-range tile: which kind of long-haul trip is preferred (beach,
 * city, nature, mountains/ski - any combination; none = any). Multi-select, so it stays open
 * until dismissed.
 */
export function LongRangeStylePopover({ longRangeStyles, onChange, isOpen, onOpenChange, t }: LongRangeStylePopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent | PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const labels: Record<string, string> = {
    BEACH: t.home.vacationKindBeach,
    CITY: t.home.vacationKindCity,
    NATURE: t.home.vacationKindNature,
    ALPINE: t.home.vacationKindAlpine,
  };
  const isAny = longRangeStyles.length === 0;
  const currentLabel = isAny
    ? t.home.longRangeStyleAny
    : longRangeStyles.map((s) => labels[s]).filter(Boolean).join(', ');

  const toggle = (style: DestinationType) => {
    const next = longRangeStyles.includes(style)
      ? longRangeStyles.filter((s) => s !== style)
      : [...longRangeStyles, style];
    // Every kind selected is the same as "any"
    onChange(next.length === LONG_RANGE_STYLE_OPTIONS.length ? [] : next);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`w-full py-0.5 px-1.5 rounded text-[10px] font-bold flex items-center justify-between border cursor-pointer ${
          !isAny
            ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-2xs'
            : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
        }`}
        title={t.home.longRangeStylePreference}
      >
        <span className="flex items-center gap-1 truncate">
          <Globe className={`w-2.5 h-2.5 shrink-0 ${!isAny ? 'text-slate-950' : 'text-teal-200'}`} />
          <span className="truncate">{currentLabel}</span>
        </span>
        <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-80" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.home.longRangeStylePreference}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 z-50 p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-teal-200 dark:border-teal-800/80 w-[240px] max-w-[calc(100vw-32px)] text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-teal-100 dark:border-teal-950/60">
            <span className="text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              {t.home.longRangeStylePreference}
            </span>
            {!isAny && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-[10px] text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-200 font-semibold cursor-pointer underline"
              >
                {t.home.longRangeStyleAny}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-2 leading-tight">{t.home.longRangeStyleHint}</p>
          <div className="flex flex-col gap-1.5">
            {LONG_RANGE_STYLE_OPTIONS.map((style) => {
              const isSelected = longRangeStyles.includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(style);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-2xs font-bold ring-2 ring-teal-500/25'
                      : 'bg-teal-50/70 dark:bg-teal-950/40 text-slate-800 dark:text-slate-200 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200/60 dark:border-teal-800/60'
                  }`}
                >
                  <span className="truncate">{labels[style]}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
