'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Info, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { countryWeekInfo, countryWeekend, weekdayName } from '@/lib/holidays/workweek';
import { COUNTRIES, getLocalizedCountryName } from '@/lib/regions/subdivisions';

type CalendarView = 'country' | 'personal';

interface CountryDay {
  date: string;
  regionsOnHoliday: number | null;
  publicHoliday?: string;
}
interface PersonalDay {
  date: string;
  onHoliday: string[];
  unknown: string[];
  publicHoliday?: string;
}

interface HolidayCalendarViewProps {
  /** Home region (ISO 3166-1/-2) */
  homeRegion: string;
  /** School regions of the school-age children (empty: the home region) */
  schoolRegions: string[];
  earliestDate: string;
  latestDate: string;
  /** Blackouts of the search, shown in the personal view */
  blackouts: { startDate: string; endDate: string; reason?: string }[];
}

const VIEW_STORAGE_KEY = 'famvac_calendar_view';
const DAY_MS = 86_400_000;

function readStoredView(): CalendarView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'personal' ? 'personal' : 'country';
  } catch {
    return 'country';
  }
}

/** Full months covering the travel period (the chart shows whole months, the period highlighted). */
function monthRange(from: string, to: string): { from: string; to: string; months: string[] } {
  const start = `${from.slice(0, 7)}-01`;
  const [y, m] = to.slice(0, 7).split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const months: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.push(d.toISOString().slice(0, 7));
  }
  return { from: start, to: end, months };
}

/** Buckets like the ADAC chart (0 / 1-4 / 5-9 / 10-16 of 16 states), scaled to the region count. */
function densityBuckets(total: number): { max: number; className: string }[] {
  if (total <= 3) {
    return [
      { max: 0, className: 'bg-emerald-600' },
      { max: total, className: 'bg-red-600' },
    ];
  }
  const low = Math.max(1, Math.round(total * 0.25));
  const mid = Math.max(low + 1, Math.round(total * 0.5625));
  return [
    { max: 0, className: 'bg-emerald-600' },
    { max: low, className: 'bg-yellow-400' },
    { max: mid, className: 'bg-orange-500' },
    { max: total, className: 'bg-red-600' },
  ];
}

const UNKNOWN_CLASS = 'bg-slate-200 dark:bg-slate-700 bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(100,116,139,0.35)_3px_5px)]';
const PERSONAL_CLASSES = {
  blackout: 'bg-slate-600 dark:bg-slate-400',
  allFree: 'bg-teal-600',
  someFree: 'bg-teal-300 dark:bg-teal-700',
  school: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600',
  weekend: 'bg-slate-200 dark:bg-slate-700',
};

/**
 * The "Calendar" results tab: every day of the travel period, either how many school regions of
 * the home country are on holiday (crowds and prices, like the ADAC "Feriendichte" chart) or the
 * family's own situation - their children's school holidays, public holidays at home and their
 * blackouts.
 */
export function HolidayCalendarView({ homeRegion, schoolRegions, earliestDate, latestDate, blackouts }: HolidayCalendarViewProps) {
  const { t, locale, formatDate } = useI18n();
  const [view, setView] = useState<CalendarView>(readStoredView);
  const country = (homeRegion || '').split('-')[0];
  const range = useMemo(() => monthRange(earliestDate, latestDate), [earliestDate, latestDate]);
  const query = useMemo(() => {
    const params = new URLSearchParams({ view, region: homeRegion, from: range.from, to: range.to, locale });
    if (view === 'personal' && schoolRegions.length > 0) params.set('schoolRegions', schoolRegions.join(','));
    return params.toString();
  }, [view, homeRegion, range, locale, schoolRegions]);
  const [data, setData] = useState<{
    query: string;
    totalRegions?: number;
    schoolRegions?: string[];
    regionsWithoutData?: string[];
    days: (CountryDay | PersonalDay)[];
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/holidays/calendar?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => active && setData({ query, totalRegions: body.totalRegions, schoolRegions: body.schoolRegions, regionsWithoutData: body.regionsWithoutData, days: body.days || [] }))
      .catch(() => active && setData({ query, days: [], failed: true }));
    return () => {
      active = false;
    };
  }, [query]);

  const chooseView = (next: CalendarView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Per-viewer convenience only
    }
  };

  const loading = !data || data.query !== query;
  const byDate = new Map((loading ? [] : data.days).map((d) => [d.date, d]));
  const firstDay = countryWeekInfo(country).firstDay;
  const weekend = countryWeekend(country);
  const weekdays = Array.from({ length: 7 }, (_, i) => ((firstDay - 1 + i) % 7) + 1);
  const countryName = getLocalizedCountryName(country, locale) || country;
  const regionName = (code: string) => COUNTRIES[country]?.subdivisions?.find((s) => s.code === code)?.name || code;
  const totalRegions = data?.totalRegions ?? 0;
  const buckets = densityBuckets(totalRegions);
  const isBlackout = (date: string) => blackouts.some((b) => b.startDate && b.endDate && date >= b.startDate && date <= b.endDate);
  const longDate = (date: string) => formatDate(date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const dayStyle = (date: string): { className: string; label: string } => {
    const day = byDate.get(date);
    if (view === 'country') {
      const d = day as CountryDay | undefined;
      if (!d || d.regionsOnHoliday === null) return { className: UNKNOWN_CLASS, label: t.home.calendarLegendUnknown };
      const bucket = buckets.find((b) => d.regionsOnHoliday! <= b.max) ?? buckets[buckets.length - 1];
      return {
        className: bucket.className,
        label: t.home.calendarRegionsCount.replace('{count}', String(d.regionsOnHoliday)).replace('{total}', String(totalRegions)),
      };
    }
    const d = day as PersonalDay | undefined;
    if (isBlackout(date)) return { className: PERSONAL_CLASSES.blackout, label: t.home.calendarLegendBlackout };
    if (!d || (d.unknown.length > 0 && d.onHoliday.length === 0)) return { className: UNKNOWN_CLASS, label: t.home.calendarLegendUnknown };
    // All of the children's school regions, not only the ones with data that day
    const regions = data?.schoolRegions?.length || 1;
    if (d.onHoliday.length >= regions) return { className: PERSONAL_CLASSES.allFree, label: t.home.calendarLegendAllFree };
    if (d.onHoliday.length > 0) {
      return { className: PERSONAL_CLASSES.someFree, label: `${t.home.calendarLegendSomeFree}: ${d.onHoliday.map(regionName).join(', ')}` };
    }
    // No school on the home country's weekend (Saturday/Sunday, Friday/Saturday...)
    const isoDay = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (weekend.includes(isoDay)) return { className: PERSONAL_CLASSES.weekend, label: t.home.calendarLegendWeekend };
    return { className: PERSONAL_CLASSES.school, label: t.home.calendarLegendSchoolDay };
  };

  const legend =
    view === 'country'
      ? [
          ...buckets.map((b, i) => ({
            className: b.className,
            label: i === 0 ? '0' : `${buckets[i - 1].max + 1}${b.max > buckets[i - 1].max + 1 ? `–${b.max}` : ''}`,
          })),
        ]
      : [
          { className: PERSONAL_CLASSES.allFree, label: t.home.calendarLegendAllFree },
          ...(schoolRegions.length > 1 ? [{ className: PERSONAL_CLASSES.someFree, label: t.home.calendarLegendSomeFree }] : []),
          { className: PERSONAL_CLASSES.school, label: t.home.calendarLegendSchoolDay },
          { className: PERSONAL_CLASSES.weekend, label: t.home.calendarLegendWeekend },
          ...(blackouts.length > 0 ? [{ className: PERSONAL_CLASSES.blackout, label: t.home.calendarLegendBlackout }] : []),
        ];
  const showUnknown = !loading && data.days.some((d) => ('regionsOnHoliday' in d ? d.regionsOnHoliday === null : d.unknown.length > 0));
  const noSchoolData =
    !loading &&
    !data.failed &&
    (view === 'country' ? totalRegions === 0 : (data.regionsWithoutData?.length ?? 0) > 0 && data.regionsWithoutData!.length === (data.schoolRegions?.length ?? 0));

  return (
    <section aria-labelledby="holiday-calendar-title" className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h3 id="holiday-calendar-title" className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            {view === 'country' ? t.home.calendarCountryTitle.replace('{country}', countryName) : t.home.calendarPersonalTitle}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {view === 'country'
              ? t.home.calendarCountryHint
              : t.home.calendarPersonalHint.replace('{regions}', (schoolRegions.length > 0 ? schoolRegions : [homeRegion]).map(regionName).join(', '))}
          </p>
        </div>
        <div role="group" aria-label={t.home.calendarTab} className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
          {(['country', 'personal'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => chooseView(v)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                view === v ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {v === 'country' ? t.home.calendarViewCountry : t.home.calendarViewPersonal}
            </button>
          ))}
        </div>
      </div>

      {noSchoolData && (
        <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-2 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {t.home.calendarNoSchoolData.replace('{country}', countryName)}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-label={t.common.loading} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
          {range.months.map((month) => {
            const [y, m] = month.split('-').map(Number);
            const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
            const firstIso = ((new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7) + 1;
            const offset = (firstIso - firstDay + 7) % 7;
            return (
              <div key={month} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center mb-1.5">
                  {formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}
                </h4>
                <div className="grid grid-cols-7 gap-[3px]" role="list">
                  {weekdays.map((d) => (
                    <span key={`h${d}`} aria-hidden="true" className="text-[9px] text-center text-slate-400 dark:text-slate-500 leading-none pb-0.5">
                      {weekdayName(d, locale).slice(0, 2)}
                    </span>
                  ))}
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`e${i}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
                    const inPeriod = date >= earliestDate && date <= latestDate;
                    const style = dayStyle(date);
                    const holiday = byDate.get(date)?.publicHoliday;
                    const label = [longDate(date), style.label, holiday ? `${t.home.calendarLegendPublicHoliday}: ${holiday}` : ''].filter(Boolean).join(' · ');
                    return (
                      <span
                        key={date}
                        role="listitem"
                        title={label}
                        aria-label={label}
                        className={`relative aspect-square rounded-[3px] ${style.className} ${inPeriod ? '' : 'opacity-30'} ${
                          holiday ? 'ring-2 ring-inset ring-amber-500 dark:ring-amber-400' : ''
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${item.className}`} />
            {item.label}
          </span>
        ))}
        {view === 'country' && totalRegions > 0 && <span>{t.home.calendarRegionsLegend}</span>}
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-3 h-3 rounded-[3px] ring-2 ring-inset ring-amber-500" />
          {t.home.calendarLegendPublicHoliday}
        </span>
        {showUnknown && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${UNKNOWN_CLASS}`} />
            {t.home.calendarLegendUnknown}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.home.calendarSources}</p>
    </section>
  );
}
