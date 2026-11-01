'use client';

import { Briefcase } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { ALL_WEEKDAYS, countryWeekInfo, defaultWorkweek, normalizeWorkweek, weekdayName } from '@/lib/holidays/workweek';

interface WorkdaysSelectorProps {
  /** The family's own workdays (ISO weekdays), or null for their country's usual week */
  value: number[] | null;
  /** Home country (ISO 3166 alpha-2): sets the usual week and the order of the days */
  country: string;
  onChange: (days: number[] | null) => void;
  idPrefix?: string;
}

/**
 * The workdays the PTO numbers count, shared by the search form and the profile. Preset to the
 * home country's usual week (Monday-Friday, Sunday-Thursday, Saturday-Thursday...); changing
 * it keeps the user's own days until they go back to the usual week.
 */
export function WorkdaysSelector({ value, country, onChange, idPrefix = 'workdays' }: WorkdaysSelectorProps) {
  const { t, locale } = useI18n();
  const usual = defaultWorkweek(country);
  const days = normalizeWorkweek(value) ?? usual;
  const firstDay = countryWeekInfo(country).firstDay;
  const ordered = ALL_WEEKDAYS.map((_, i) => ((firstDay - 1 + i) % 7) + 1);
  const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));
  const countryName = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country;
    } catch {
      return country;
    }
  })();

  const toggle = (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
    // At least one workday: a week without any would make every trip free
    if (next.length === 0) return;
    onChange(sameDays(next, usual) ? null : next);
  };

  return (
    <div role="group" aria-labelledby={`${idPrefix}-label`} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span id={`${idPrefix}-label`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          {t.home.workdaysLabel}
        </span>
        {value !== null && !sameDays(days, usual) && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer text-right"
          >
            {t.home.workdaysReset.replace('{country}', countryName)}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.workdaysHint}</p>
      <div className="grid grid-cols-7 gap-1">
        {ordered.map((day) => {
          const active = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={active}
              title={weekdayName(day, locale, 'long')}
              onClick={() => toggle(day)}
              className={`py-1.5 rounded-lg border text-[11px] font-semibold text-center transition cursor-pointer min-w-0 truncate ${
                active
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
              }`}
            >
              {weekdayName(day, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
