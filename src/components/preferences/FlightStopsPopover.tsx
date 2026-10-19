'use client';

import React, { useRef, useEffect } from 'react';
import { Plane, ChevronDown, Check } from 'lucide-react';

interface FlightStopsPopoverProps {
  maxFlightStops: number | undefined;
  onSelect: (stops: number | undefined) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
}

export function FlightStopsPopover({
  maxFlightStops,
  onSelect,
  isOpen,
  onOpenChange,
  t,
}: FlightStopsPopoverProps) {
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

  const currentLabel =
    maxFlightStops === 0
      ? t.home.nonStopFlight
      : maxFlightStops === 1
      ? t.home.flightStopsMax1
      : t.home.flightStopsAny;

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
          maxFlightStops !== undefined
            ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-2xs'
            : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
        }`}
        title={t.home.flightTransitPreference}
      >
        <span className="flex items-center gap-1 truncate">
          <Plane
            className={`w-2.5 h-2.5 flex-shrink-0 ${
              maxFlightStops !== undefined ? 'text-slate-950' : 'text-blue-200'
            }`}
          />
          <span className="truncate">{currentLabel}</span>
        </span>
        <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.home.flightTransitPreference}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 p-2.5 bg-white rounded-xl shadow-xl border border-blue-200 w-[270px] max-w-[calc(100vw-32px)] text-slate-800 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-blue-100">
            <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-blue-600" />
              {t.home.flightTransitPreference}
            </span>
            {maxFlightStops !== undefined && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(undefined);
                  onOpenChange(false);
                }}
                className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold cursor-pointer underline"
              >
                {t.home.flightStopsAny}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-600 mb-2 leading-tight">
            {t.home.directFlightPremiumDesc}
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { val: undefined, label: t.home.flightStopsAny },
              { val: 0, label: t.home.flightStopsDirectOnly },
              { val: 1, label: t.home.flightStopsMax1 },
            ].map((opt) => {
              const isSelected = maxFlightStops === opt.val;
              return (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(opt.val);
                    onOpenChange(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs font-bold ring-2 ring-blue-500/25'
                      : 'bg-blue-50/70 text-slate-800 hover:bg-blue-100 border border-blue-200/60'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

