'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, CloudRain, Waves, Thermometer, Info, Sparkles } from 'lucide-react';
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
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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
    <div
      ref={popoverRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Trigger: Interactive temperature badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200/80 transition-colors cursor-pointer group"
        title="View climate insights & historical weather details"
      >
        <Sun className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-45 transition-transform" />
        <span>{weather.avgTempC}°C</span>
        <Info className="w-3 h-3 text-amber-400 opacity-60 group-hover:opacity-100 ml-0.5" />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute z-50 left-0 bottom-full mb-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
              <Thermometer className="w-4 h-4 text-amber-500" />
              <span>{t.home.climateDetailsTitle || 'Climate & Weather Insights'}</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
              {destinationAirport}
            </span>
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

          {/* Small tooltip arrow */}
          <div className="absolute left-6 top-full -mt-1 w-2.5 h-2.5 bg-white border-b border-r border-slate-200 rotate-45" />
        </div>
      )}
    </div>
  );
}

