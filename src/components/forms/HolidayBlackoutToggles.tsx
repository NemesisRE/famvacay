'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { fetchHolidayBlackoutOptions, type HolidayBlackoutOptionDto } from '@/lib/holidays/holiday-blackout-ids';

interface HolidayBlackoutTogglesProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Home region (ISO 3166-1/-2): its public holidays are offered */
  region: string;
  /** Travel period: the dates are calculated for every year it touches (search form only) */
  earliestDate?: string;
  latestDate?: string;
  /** While adding blackouts every holiday is offered; otherwise only the chosen ones are shown */
  expanded: boolean;
}

/**
 * Year-independent holiday blackouts from the public holidays of the home region - Easter and
 * Christmas in Germany, Eid al-Fitr and Eid al-Adha in Saudi Arabia, Rosh Hashanah in Israel, the
 * Spring Festival in China: the user picks the holiday, the dates are calculated for the travel
 * period. Holidays spanning several days come first; single ones behind "more". Shared by the
 * search form and the profile.
 */
export function HolidayBlackoutToggles({ selected, onChange, region, earliestDate, latestDate, expanded }: HolidayBlackoutTogglesProps) {
  const { t, locale, formatDate } = useI18n();
  const [loaded, setLoaded] = useState<{ key: string; options: HolidayBlackoutOptionDto[] }>({ key: '', options: [] });
  const [showSingles, setShowSingles] = useState(false);
  const hasRange = Boolean(earliestDate && latestDate);
  const requestKey = [region, locale, earliestDate, latestDate, [...selected].sort().join(',')].join('|');

  useEffect(() => {
    if (!region) return;
    let active = true;
    fetchHolidayBlackoutOptions({ region, locale, from: earliestDate, to: latestDate, selected }).then((options) => {
      if (active) setLoaded({ key: requestKey, options });
    });
    return () => {
      active = false;
    };
    // requestKey covers every input of the request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const options = loaded.options;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  const formatRange = (start: string, end: string) =>
    start === end
      ? formatDate(start, { day: '2-digit', month: '2-digit', year: 'numeric' })
      : `${formatDate(start, { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${formatDate(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  // Collapsed: only the chosen holidays (nothing at all when none is chosen) - a cleaner card
  const multiDay = options.filter((o) => o.multiDay);
  const singles = options.filter((o) => !o.multiDay);
  const visible = expanded
    ? [...multiDay, ...singles.filter((o) => showSingles || selected.includes(o.id))]
    : options.filter((o) => selected.includes(o.id));
  const hiddenSingles = expanded && !showSingles ? singles.filter((o) => !selected.includes(o.id)).length : 0;
  if (visible.length === 0 && hiddenSingles === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900/75 dark:text-amber-300/75">
        {t.home.quickSpecialTimes}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((option) => {
          const isSelected = selected.includes(option.id);
          const title = [
            option.names.join(', '),
            ...(hasRange
              ? option.periods.length > 0
                ? option.periods.map((p) => formatRange(p.startDate, p.endDate))
                : [t.home.holidayNotInTravelPeriod]
              : [t.home.holidayBlackoutsHint]),
          ].join('\n');
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              aria-pressed={isSelected}
              title={title}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer max-w-full ${
                isSelected
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs'
              }`}
            >
              <span className="truncate">{option.name}</span>
              {isSelected ? (
                <Check className="w-3 h-3 ml-0.5 shrink-0" />
              ) : (
                <Plus className="w-3 h-3 ml-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
            </button>
          );
        })}
        {expanded && singles.length > 0 && (hiddenSingles > 0 || showSingles) && (
          <button
            type="button"
            onClick={() => setShowSingles((v) => !v)}
            aria-expanded={showSingles}
            className="px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
          >
            {showSingles ? t.home.holidayBlackoutsFewer : t.home.holidayBlackoutsMore.replace('{count}', String(hiddenSingles))}
          </button>
        )}
      </div>
      {expanded && <p className="text-[10px] text-amber-800/75 dark:text-amber-300/70">{t.home.holidayBlackoutsHint}</p>}
    </div>
  );
}
