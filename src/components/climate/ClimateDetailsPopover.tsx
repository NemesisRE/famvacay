'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sun, CloudRain, Waves, Thermometer, Info, Sparkles, X } from 'lucide-react';
import { WeatherAssessment } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';

interface ClimateDetailsPopoverProps {
  destinationAirport: string;
  weather: WeatherAssessment;
  className?: string;
}

export function ClimateDetailsPopover({
  destinationAirport,
  weather,
  className = '',
}: ClimateDetailsPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openAbove: boolean }>({
    top: 0,
    left: 0,
    openAbove: false,
  });
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 32);
    const popoverHeight = 320;

    // Viewport edge detection: open above if not enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    const top = openAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;

    // Horizontal clamping: ensure popover stays within viewport margins
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    setCoords({
      top: Math.max(8, top),
      left,
      openAbove,
    });
  }, []);

  // Update position when opening, scrolling, or resizing
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const maxTemp = weather.maxTempC ?? Math.round(weather.avgTempC + 3.5);
  const minTemp = weather.minTempC ?? Math.round(weather.avgTempC - 4.5);
  const rainyDays = weather.rainyDays ?? Math.max(1, Math.round((weather.precipitationRiskPercent / 100) * 15));
  const sunshineHours = weather.sunshineHoursPerDay ?? 8;

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger: Interactive temperature badge */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200/80 transition-colors cursor-pointer group"
        title="View climate insights & historical weather details"
      >
        <Sun className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-45 transition-transform" />
        <span>{weather.avgTempC}°C</span>
        <Info className="w-3 h-3 text-amber-400 opacity-60 group-hover:opacity-100 ml-0.5" />
      </button>

      {/* Popover Card mounted in React Portal to document.body */}
      {isOpen && mounted && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
              <Thermometer className="w-4 h-4 text-amber-500" />
              <span>{t.home.climateDetailsTitle || 'Climate & Weather Insights'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                {destinationAirport}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 py-3 text-xs">
            {/* Avg Day Temperature */}
            <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-100">
              <span className="text-[10px] font-semibold text-amber-800 flex items-center gap-1 mb-0.5">
                <Sun className="w-3 h-3 text-amber-600" />
                {t.home.climateAvgTemp || 'Ø Temperature'}
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {weather.avgTempC}°C
              </div>
            </div>

            {/* Daily High / Low */}
            <div className="bg-orange-50/70 p-2 rounded-lg border border-orange-100">
              <span className="text-[10px] font-semibold text-orange-800 flex items-center gap-1 mb-0.5">
                <Thermometer className="w-3 h-3 text-orange-600" />
                {t.home.climateMaxTemp || 'Max / Min Air'}
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {maxTemp}° / {minTemp}°C
              </div>
            </div>

            {/* Sea / Water Temperature */}
            <div className="bg-sky-50/70 p-2 rounded-lg border border-sky-100">
              <span className="text-[10px] font-semibold text-sky-800 flex items-center gap-1 mb-0.5">
                <Waves className="w-3 h-3 text-sky-600" />
                {t.home.climateWaterTemp || 'Water / Sea'}
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {weather.waterTempC !== null && weather.waterTempC !== undefined
                  ? `${weather.waterTempC}°C`
                  : <span className="text-[11px] font-medium text-slate-400">{t.home.climateNotApplicable || 'Inland / N/A'}</span>}
              </div>
            </div>

            {/* Rainy Days & Precip Risk */}
            <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-100">
              <span className="text-[10px] font-semibold text-blue-800 flex items-center gap-1 mb-0.5">
                <CloudRain className="w-3 h-3 text-blue-600" />
                {t.home.climateRainyDays || 'Rain Days / Risk'}
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                ~{rainyDays}d <span className="text-[10px] font-normal text-slate-500">({weather.precipitationRiskPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Daily Sunshine Hours */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs border border-slate-100">
            <span className="text-slate-600 font-medium flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {t.home.climateSunshine || 'Daily Sunshine'}
            </span>
            <span className="font-bold text-slate-800 text-xs">
              ~{sunshineHours} h / day
            </span>
          </div>

          {/* Reason / Comfort assessment */}
          {weather.reason && (
            <p className="mt-2.5 text-[10px] leading-tight text-slate-500 italic border-t border-slate-100 pt-2">
              {weather.reason}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
