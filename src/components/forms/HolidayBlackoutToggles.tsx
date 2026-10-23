'use client';

import { Check, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import {
  SPECIAL_HOLIDAY_IDS,
  getSpecialHolidayMeta,
  resolveSpecialHolidayPeriods,
  type SpecialHolidayId,
} from '@/lib/holidays/special-dates';

interface HolidayBlackoutTogglesProps {
  selected: SpecialHolidayId[];
  onChange: (selected: SpecialHolidayId[]) => void;
  /** Travel period: the dates are calculated for every year it touches (search form only) */
  earliestDate?: string;
  latestDate?: string;
  /** While adding blackouts every holiday is offered; otherwise only the chosen ones are shown */
  expanded: boolean;
}

/**
 * Year-independent holiday blackouts (Easter, Ascension, Pentecost, Corpus Christi, Christmas):
 * the user picks the holiday, the dates are calculated for the chosen travel period. Shared by
 * the search form and the profile.
 */
export function HolidayBlackoutToggles({ selected, onChange, earliestDate, latestDate, expanded }: HolidayBlackoutTogglesProps) {
  const { t, locale, formatDate } = useI18n();
  const hasRange = Boolean(earliestDate && latestDate);

  const toggle = (id: SpecialHolidayId) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const formatRange = (start: string, end: string) =>
    `${formatDate(start, { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${formatDate(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  // Collapsed: only the chosen holidays (nothing at all when none is chosen) - a cleaner card
  const visibleIds = expanded ? SPECIAL_HOLIDAY_IDS : SPECIAL_HOLIDAY_IDS.filter((id) => selected.includes(id));
  if (visibleIds.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900/75 dark:text-amber-300/75">
        {t.home.quickSpecialTimes}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {visibleIds.map((id) => {
          const meta = getSpecialHolidayMeta(id, locale);
          const isSelected = selected.includes(id);
          const periods = hasRange ? resolveSpecialHolidayPeriods([id], earliestDate!, latestDate!, locale) : [];
          const title = [
            meta.description,
            ...(hasRange
              ? periods.length > 0
                ? periods.map((p) => formatRange(p.startDate, p.endDate))
                : [t.home.holidayNotInTravelPeriod]
              : [t.home.holidayBlackoutsHint]),
          ].join('\n');
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              aria-pressed={isSelected}
              title={title}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs'
              }`}
            >
              <span aria-hidden="true">{meta.icon}</span>
              <span>{meta.name}</span>
              {isSelected ? (
                <Check className="w-3 h-3 ml-0.5" />
              ) : (
                <Plus className="w-3 h-3 ml-0.5 text-amber-600 dark:text-amber-400" />
              )}
            </button>
          );
        })}
      </div>
      {expanded && <p className="text-[10px] text-amber-800/75 dark:text-amber-300/70">{t.home.holidayBlackoutsHint}</p>}
    </div>
  );
}
