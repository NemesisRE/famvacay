'use client';

import { useEffect, useRef } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { de, enUS, es, fr, it } from 'react-day-picker/locale';
import { Calendar } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SupportedLocale } from '@/lib/i18n/types';
import { useCalendarGuard } from './dismiss-guard';
import { UnselectedDayPrompt } from './UnselectedDayPrompt';

const RDP_LOCALES: Record<SupportedLocale, typeof enUS> = { en: enUS, de, fr, es, it };

interface DateRangePickerProps {
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  minDate?: string;
  className?: string;
}

function toISO(date: Date): string {
  // Use local date parts (not toISOString, which converts to UTC and shifts
  // the day backwards for any timezone ahead of UTC, e.g. Europe).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromISO(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

export function DateRangePicker({ startDate, endDate, onChange, minDate, className = '' }: DateRangePickerProps) {
  const { locale, t, formatDate } = useI18n();
  // Open state with the guard against dropping a navigated month (see dismiss-guard.ts)
  const [guard, dispatch] = useCalendarGuard();
  const isOpen = guard.open;
  const containerRef = useRef<HTMLDivElement>(null);
  const minDateObj = fromISO(minDate);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent | PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        dispatch({ type: 'requestClose' });
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dispatch({ type: 'requestClose' });
    }

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dispatch]);

  const range: DateRange | undefined = {
    from: fromISO(startDate),
    to: fromISO(endDate),
  };

  const handleSelect = (next: DateRange | undefined) => {
    if (!next?.from) {
      onChange('', '');
      return;
    }

    // react-day-picker's addToRange() collapses the very first click of a
    // fresh (empty) range straight into a "complete" single-day range
    // ({from: X, to: X}) instead of leaving `to` unset. Left as-is, that
    // reads as "selection finished" and the next click starts a brand-new
    // range instead of extending the end date. Override that one case so a
    // fresh first click always waits for a second click.
    const hadPriorFrom = Boolean(range.from);
    const isFreshSingleDayClick =
      !hadPriorFrom && next.to && next.from.getTime() === next.to.getTime();
    const to = !isFreshSingleDayClick && next.to ? next.to : undefined;

    const from = toISO(next.from);
    const toStr = to ? toISO(to) : '';
    onChange(from, toStr);
    // A day was picked: closes on the end date; after the start date it stays open, but a close
    // needs no confirmation any more (nothing navigated is lost)
    dispatch({ type: to ? 'select' : 'open' });
  };

  const shortLabel = range.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${formatDate(range.from, { day: 'numeric', month: 'numeric' })}–${formatDate(range.to, { day: 'numeric', month: 'numeric' })}`
      : formatDate(range.from, { day: 'numeric', month: 'numeric' })
    : null;

  const fullLabel = range.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${formatDate(range.from, { day: '2-digit', month: 'short', year: 'numeric' })} → ${formatDate(range.to, { day: '2-digit', month: 'short', year: 'numeric' })}`
      : formatDate(range.from, { day: '2-digit', month: 'short', year: 'numeric' })
    : t.home.selectDateRange;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => dispatch({ type: 'toggle' })}
        title={fullLabel}
        className="w-full flex items-center gap-1 text-xs rounded border border-slate-300 dark:border-slate-700 px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition"
      >
        <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className={`truncate ${shortLabel ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {shortLabel || t.home.selectDateRange}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            locale={RDP_LOCALES[locale] || enUS}
            disabled={minDateObj ? { before: minDateObj } : undefined}
            defaultMonth={range.from || minDateObj}
            // Always six week rows: the popup keeps its height between months
            fixedWeeks
            className="rdp-themed"
            onMonthChange={() => dispatch({ type: 'navigate' })}
          />
          {guard.confirming && (
            <UnselectedDayPrompt
              onKeepChoosing={() => dispatch({ type: 'keepChoosing' })}
              onDiscard={() => dispatch({ type: 'discard' })}
            />
          )}
        </div>
      )}
    </div>
  );
}
