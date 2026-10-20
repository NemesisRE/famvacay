'use client';

import React, { useRef, useEffect } from 'react';
import { Thermometer, ChevronDown } from 'lucide-react';

interface BeachTemperaturePopoverProps {
  minBeachTemp: number | undefined;
  onSelect: (temp: number | undefined) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
}

export function BeachTemperaturePopover({
  minBeachTemp,
  onSelect,
  isOpen,
  onOpenChange,
  t,
}: BeachTemperaturePopoverProps) {
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
          minBeachTemp !== undefined
            ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-2xs'
            : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
        }`}
        title={t.home.minBeachTempLabel}
      >
        <span className="flex items-center gap-1 truncate">
          <Thermometer
            className={`w-2.5 h-2.5 flex-shrink-0 ${
              minBeachTemp !== undefined ? 'text-slate-900' : 'text-amber-200'
            }`}
          />
          <span className="truncate">
            {minBeachTemp !== undefined ? `≥ ${minBeachTemp}°C` : t.home.minBeachTempAny}
          </span>
        </span>
        <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.home.minBeachTempLabel}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 z-50 p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-amber-200 dark:border-amber-900/60 w-[240px] max-w-[calc(100vw-32px)] text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-100 dark:border-amber-950/60">
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {t.home.minBeachTempLabel}
            </span>
            {minBeachTemp !== undefined && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(undefined);
                  onOpenChange(false);
                }}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-semibold cursor-pointer underline"
              >
                {t.home.minBeachTempAny}
              </button>
            )}
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mb-2 leading-tight">
            {t.home.minBeachTempHint}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val: undefined, label: t.home.minBeachTempAny },
              { val: 20, label: '≥ 20°C' },
              { val: 22, label: '≥ 22°C' },
              { val: 24, label: '≥ 24°C' },
              { val: 26, label: '≥ 26°C' },
              { val: 28, label: '≥ 28°C' },
            ].map((opt) => {
              const isTempSelected = minBeachTemp === opt.val;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(opt.val);
                    onOpenChange(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition cursor-pointer ${
                    isTempSelected
                      ? 'bg-amber-600 text-white shadow-2xs font-bold ring-2 ring-amber-500/25'
                      : 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
