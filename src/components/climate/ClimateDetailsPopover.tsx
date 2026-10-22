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
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop } from '@/components/ui/responsive-popover';
import { Sun, CloudRain, Waves, Thermometer, Info, Sparkles, X, Snowflake } from 'lucide-react';
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

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'top-start',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const maxTemp = weather.maxTempC ?? Math.round(weather.avgTempC + 3.5);
  const minTemp = weather.minTempC ?? Math.round(weather.avgTempC - 4.5);
  const rainyDays = weather.rainyDays ?? Math.max(1, Math.round((weather.precipitationRiskPercent / 100) * 15));
  const sunshineHours = weather.sunshineHoursPerDay ?? 8;

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger Button: Smooth, anchored reference with badge styling */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1 cursor-pointer group shadow-2xs"
        title="View climate insights & historical weather details"
      >
        <Sun className="w-3 h-3 text-amber-500 group-hover:rotate-45 transition-transform flex-shrink-0" />
        <span>{weather.avgTempC}°C</span>
      </button>

      {/* Popover Card anchored via Floating UI FloatingPortal */}
      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            className="animate-in fade-in zoom-in-95 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 text-slate-800 dark:text-slate-100 transition-opacity duration-150 ease-out"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100">
                <Thermometer className="w-4 h-4 text-amber-500" />
                <span>{t.home.climateDetailsTitle || 'Climate & Weather Insights'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-700">
                  {destinationAirport}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 py-3 text-xs">
              {/* Avg Day Temperature */}
              <div className="bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-100 dark:border-amber-800/60">
                <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-0.5">
                  <Sun className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {t.home.climateAvgTemp || 'Ø Temperature'}
                </span>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {weather.avgTempC}°C
                </div>
              </div>

              {/* Daily High / Low */}
              <div className="bg-orange-50/70 dark:bg-orange-950/30 p-2 rounded-lg border border-orange-100 dark:border-orange-800/60">
                <span className="text-[10px] font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1 mb-0.5">
                  <Thermometer className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  {t.home.climateMaxTemp || 'Max / Min Air'}
                </span>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {maxTemp}° / {minTemp}°C
                </div>
              </div>

              {/* Sea / Water Temperature */}
              <div className="bg-sky-50/70 dark:bg-sky-950/30 p-2 rounded-lg border border-sky-100 dark:border-sky-800/60">
                <span className="text-[10px] font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1 mb-0.5">
                  <Waves className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  {t.home.climateWaterTemp || 'Water / Sea'}
                </span>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {weather.waterTempC !== null && weather.waterTempC !== undefined
                    ? `${weather.waterTempC}°C`
                    : <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t.home.climateNotApplicable || 'Inland / N/A'}</span>}
                </div>
              </div>

              {/* Rainy Days & Precip Risk */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-0.5">
                  <CloudRain className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                  {t.home.climateRainyDays || 'Rain Days / Risk'}
                </span>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  ~{rainyDays}d <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">({weather.precipitationRiskPercent}%)</span>
                </div>
              </div>

              {/* Snow & Winter Sports Conditions */}
              {weather.hasSnow && (
                <div className="bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-lg border border-sky-200 dark:border-sky-800/60 col-span-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <Snowflake className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>{t.home.snowGuaranteeBadge || 'Schneegarantie'}</span>
                  </span>
                  <span className="text-xs font-extrabold text-sky-950 dark:text-sky-100">
                    ~{weather.snowDepthCm || 35} cm {t.home.winterSportsLabel || 'Schnee'}
                  </span>
                </div>
              )}
            </div>

            {/* Daily Sunshine Hours */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                {t.home.climateSunshine || 'Daily Sunshine'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                ~{sunshineHours} h / day
              </span>
            </div>

            {/* Reason / Comfort assessment */}
            {weather.reason && (
              <p className="mt-2.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-2">
                {weather.reason}
              </p>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
