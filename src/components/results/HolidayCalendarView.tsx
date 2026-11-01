'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Info, Loader2, Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { countryWeekInfo, countryWeekend, weekdayName } from '@/lib/holidays/workweek';
import { COUNTRIES, getLocalizedCountryName } from '@/lib/regions/subdivisions';
import { findBestStretches, findQuietStretches } from '@/lib/holidays/best-holiday-days';

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
  otherRegionsOnHoliday: number | null;
  publicHoliday?: string;
}

interface CalendarData {
  view: CalendarView;
  query: string;
  failed?: boolean;
  /** Country view: regions in the data */
  totalRegions?: number;
  /** Personal view */
  schoolRegions?: string[];
  regionsWithoutData?: string[];
  otherRegionsTotal?: number;
  days: (CountryDay | PersonalDay)[];
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

interface Swatch {
  /** Background (and border) of the day square */
  className: string;
  /** Day number colour readable on it */
  textClassName: string;
}

/** Buckets like the ADAC chart (0 / 1-4 / 5-9 / 10-16 of 16 states), scaled to the region count. */
function densityBuckets(total: number): (Swatch & { max: number })[] {
  const green = { className: 'bg-emerald-600', textClassName: 'text-white' };
  const red = { className: 'bg-red-600', textClassName: 'text-white' };
  if (total <= 3) return [{ max: 0, ...green }, { max: Math.max(1, total), ...red }];
  const low = Math.max(1, Math.round(total * 0.25));
  const mid = Math.max(low + 1, Math.round(total * 0.5625));
  return [
    { max: 0, ...green },
    { max: low, className: 'bg-yellow-400', textClassName: 'text-slate-900' },
    { max: mid, className: 'bg-orange-500', textClassName: 'text-white' },
    { max: total, ...red },
  ];
}

const bucketLabel = (buckets: { max: number }[], i: number) =>
  i === 0 ? '0' : `${buckets[i - 1].max + 1}${buckets[i].max > buckets[i - 1].max + 1 ? `–${buckets[i].max}` : ''}`;

const UNKNOWN: Swatch = {
  className: 'bg-slate-200 dark:bg-slate-700 bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(100,116,139,0.35)_3px_5px)]',
  textClassName: 'text-slate-600 dark:text-slate-300',
};
const NO_DATA: Swatch = {
  className: 'bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600',
  textClassName: 'text-slate-500 dark:text-slate-400',
};
const PERSONAL = {
  blackout: { className: 'bg-slate-600 dark:bg-slate-400', textClassName: 'text-white dark:text-slate-900' },
  free: { className: 'bg-teal-600', textClassName: 'text-white' },
  school: { className: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600', textClassName: 'text-slate-500 dark:text-slate-400' },
  weekend: { className: 'bg-slate-200 dark:bg-slate-700', textClassName: 'text-slate-500 dark:text-slate-400' },
} satisfies Record<string, Swatch>;

/**
 * The "Calendar" results tab: every day of the travel period, either how many school regions of
 * the home country are on holiday (crowds and prices, like the ADAC "Feriendichte" chart) or the
 * family's own view - the days all their children are off, rated the same way by how many *other*
 * regions are off at the same time (early August in Baden-Württemberg is crowded, early September
 * quiet), public holidays at home and their blackouts.
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
  const [data, setData] = useState<CalendarData | null>(null);

  useEffect(() => {
    let active = true;
    const requestedView = view;
    fetch(`/api/holidays/calendar?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => active && setData({ ...body, view: requestedView, query, days: body.days || [] }))
      .catch(() => active && setData({ view: requestedView, query, days: [], failed: true }));
    return () => {
      active = false;
    };
    // query covers every input, including the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const chooseView = (next: CalendarView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Per-viewer convenience only
    }
  };

  // While the other view loads, the previous one stays in place (faded) instead of collapsing to a
  // spinner, so switching does not move the page around
  const updating = !data || data.query !== query;
  const shownView = data?.view ?? view;
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));
  const firstDay = countryWeekInfo(country).firstDay;
  const weekend = countryWeekend(country);
  const weekdays = Array.from({ length: 7 }, (_, i) => ((firstDay - 1 + i) % 7) + 1);
  const countryName = getLocalizedCountryName(country, locale) || country;
  const regionName = (code: string) => COUNTRIES[country]?.subdivisions?.find((s) => s.code === code)?.name || code;
  const totalRegions = data?.totalRegions ?? 0;
  const countryBuckets = densityBuckets(totalRegions);
  const otherTotal = data?.otherRegionsTotal ?? 0;
  const personalBuckets = densityBuckets(otherTotal);
  const isBlackout = (date: string) => blackouts.some((b) => b.startDate && b.endDate && date >= b.startDate && date <= b.endDate);
  const longDate = (date: string) => formatDate(date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const withoutData = data?.regionsWithoutData ?? [];
  // No school-age children: not tied to any holidays, so every day is possible and rated by all
  // regions on holiday - the best times are outside the school holidays
  const noKids = shownView === 'personal' && !!data && !data.failed && (data.schoolRegions?.length ?? 0) === 0;

  const dayStyle = (date: string): Swatch & { label: string } => {
    const day = byDate.get(date);
    if (shownView === 'country') {
      const d = day as CountryDay | undefined;
      // Countries without school data at all: nothing will be published, so not "unknown"
      if (totalRegions === 0) return { ...NO_DATA, label: t.home.calendarLegendNoData };
      if (!d || d.regionsOnHoliday === null) return { ...UNKNOWN, label: t.home.calendarLegendUnknown };
      const bucket = countryBuckets.find((b) => d.regionsOnHoliday! <= b.max) ?? countryBuckets[countryBuckets.length - 1];
      return {
        ...bucket,
        label: t.home.calendarRegionsCount.replace('{count}', String(d.regionsOnHoliday)).replace('{total}', String(totalRegions)),
      };
    }
    const d = day as PersonalDay | undefined;
    if (isBlackout(date)) return { ...PERSONAL.blackout, label: t.home.calendarLegendBlackout };
    if (noKids) {
      if (otherTotal === 0) return { ...NO_DATA, label: t.home.calendarLegendNoData };
      if (!d || d.otherRegionsOnHoliday === null) return { ...UNKNOWN, label: t.home.calendarLegendUnknown };
      const bucket = personalBuckets.find((b) => d.otherRegionsOnHoliday! <= b.max) ?? personalBuckets[personalBuckets.length - 1];
      return {
        ...bucket,
        label: t.home.calendarRegionsCount.replace('{count}', String(d.otherRegionsOnHoliday)).replace('{total}', String(otherTotal)),
      };
    }
    if (d && d.onHoliday.length === 0 && d.unknown.length > 0 && d.unknown.every((r) => withoutData.includes(r))) {
      return { ...NO_DATA, label: t.home.calendarLegendNoData };
    }
    if (!d || (d.unknown.length > 0 && d.onHoliday.length === 0)) return { ...UNKNOWN, label: t.home.calendarLegendUnknown };
    // All of the children's school regions, not only the ones with data that day
    const regions = data?.schoolRegions?.length || 1;
    if (d.onHoliday.length >= regions) {
      // Free for everyone: rated by the other regions on holiday at the same time
      if (d.otherRegionsOnHoliday === null || otherTotal === 0) return { ...PERSONAL.free, label: t.home.calendarLegendAllFree };
      const bucket = personalBuckets.find((b) => d.otherRegionsOnHoliday! <= b.max) ?? personalBuckets[personalBuckets.length - 1];
      return {
        ...bucket,
        label: t.home.calendarOtherRegionsCount.replace('{count}', String(d.otherRegionsOnHoliday)).replace('{total}', String(otherTotal)),
      };
    }
    // A trip needs every child to be off: days only some of them are off look like any other day
    // (the tooltip still names who is off)
    const partly = d.onHoliday.length > 0 ? ` · ${t.home.calendarLegendSomeFree}: ${d.onHoliday.map(regionName).join(', ')}` : '';
    // No school on the home country's weekend (Saturday/Sunday, Friday/Saturday...)
    const isoDay = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (weekend.includes(isoDay)) return { ...PERSONAL.weekend, label: t.home.calendarLegendWeekend + partly };
    return { ...PERSONAL.school, label: t.home.calendarLegendSchoolDay + partly };
  };

  // Personal view: the best stretch of every block of shared holiday days in the travel period (the
  // fewest other regions off), marked with a star and listed below the calendar
  const bestStretches =
    shownView === 'personal' && data && !noKids && otherTotal > 0
      ? findBestStretches(
          (data.days as PersonalDay[])
            .filter(
              (d) =>
                d.date >= earliestDate &&
                d.date <= latestDate &&
                !isBlackout(d.date) &&
                d.onHoliday.length > 0 &&
                d.onHoliday.length >= (data.schoolRegions?.length || 1)
            )
            .map((d) => ({ date: d.date, otherRegions: d.otherRegionsOnHoliday }))
        )
      : [];
  // Stars only where part of a break stands out; a break that is equally busy throughout gets none
  const quietStretches =
    noKids && data && otherTotal > 0
      ? findQuietStretches(
          (data.days as PersonalDay[])
            .filter((d) => d.date >= earliestDate && d.date <= latestDate && !isBlackout(d.date))
            .map((d) => ({ date: d.date, otherRegions: d.otherRegionsOnHoliday }))
        )
      : [];
  const isBestDay = (date: string) =>
    bestStretches.some((b) => (b.start !== b.blockStart || b.end !== b.blockEnd) && date >= b.start && date <= b.end);
  // "1.–11. Sept. 2027", "Sep 1 – 11, 2027": the year and month only once, per the user's language
  const rangeFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateRange = (start: string, end: string) => rangeFormat.formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`));

  const noSchoolData =
    !!data &&
    !data.failed &&
    (shownView === 'country'
      ? totalRegions === 0
      : noKids
        ? otherTotal === 0
        : withoutData.length > 0 && withoutData.length === (data.schoolRegions?.length ?? 0));
  const showUnknown =
    !!data &&
    data.days.some((d) =>
      'regionsOnHoliday' in d ? totalRegions > 0 && d.regionsOnHoliday === null : d.unknown.some((r) => !withoutData.includes(r))
    );
  const scale = shownView === 'country' ? countryBuckets : otherTotal > 0 ? personalBuckets : [];
  const extraLegend: (Swatch & { label: string })[] =
    shownView === 'country'
      ? []
      : noKids
        ? [...(blackouts.length > 0 ? [{ ...PERSONAL.blackout, label: t.home.calendarLegendBlackout }] : [])]
      : [
          ...(otherTotal === 0 ? [{ ...PERSONAL.free, label: t.home.calendarLegendAllFree }] : []),
          { ...PERSONAL.school, label: t.home.calendarLegendSchoolDay },
          { ...PERSONAL.weekend, label: t.home.calendarLegendWeekend },
          ...(blackouts.length > 0 ? [{ ...PERSONAL.blackout, label: t.home.calendarLegendBlackout }] : []),
        ];

  return (
    <section aria-labelledby="holiday-calendar-title" aria-busy={updating} className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Fixed heights: the two views' texts differ in length and must not move the calendar */}
        <div className="space-y-0.5 min-w-0 flex-1 basis-64">
          <h3 id="holiday-calendar-title" className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0">
            <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate">
              {view === 'country'
                ? t.home.calendarCountryTitle.replace('{country}', countryName)
                : schoolRegions.length === 0
                  ? t.home.calendarPersonalTitleNoKids
                  : t.home.calendarPersonalTitle}
            </span>
          </h3>
          {/* Both hints share one grid cell, the other one invisible: the box always fits the longer
              text, so switching views neither cuts it off nor moves the calendar */}
          <div className="grid text-[11px] text-slate-500 dark:text-slate-400">
            {(['country', 'personal'] as const).map((v) => (
              <p key={v} className={`[grid-area:1/1] ${view === v ? '' : 'invisible'}`} aria-hidden={view !== v}>
                {v === 'country'
                  ? t.home.calendarCountryHint
                  : schoolRegions.length === 0
                    ? t.home.calendarPersonalHintNoKids
                    : t.home.calendarPersonalHint.replace('{regions}', schoolRegions.map(regionName).join(', '))}
              </p>
            ))}
          </div>
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

      <div className="relative">
        {updating && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 pointer-events-none">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" aria-label={t.common.loading} />
          </div>
        )}
        <div className={`grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3 transition-opacity ${updating ? 'opacity-40' : ''}`}>
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
                    const best = isBestDay(date);
                    const label = [longDate(date), style.label, best ? t.home.calendarBestDays : '', holiday ? `${t.home.calendarLegendPublicHoliday}: ${holiday}` : '']
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <span
                        key={date}
                        role="listitem"
                        title={label}
                        aria-label={label}
                        className={`relative aspect-square rounded-[3px] flex items-center justify-center text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none select-none ${style.className} ${style.textClassName} ${
                          inPeriod ? '' : 'opacity-30'
                        } ${holiday ? 'ring-2 ring-inset ring-amber-500 dark:ring-amber-400' : ''}`}
                      >
                        <span aria-hidden="true">{i + 1}</span>
                        {best && (
                          <Star aria-hidden="true" className="absolute -top-1 -right-1 w-2.5 h-2.5 fill-white stroke-emerald-700 dark:stroke-emerald-300 stroke-[2.5]" />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bestStretches.length > 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 space-y-1.5">
          <h4 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <Star aria-hidden="true" className="w-3.5 h-3.5 fill-white stroke-emerald-700 dark:stroke-emerald-300 stroke-[2.5]" />
            {t.home.calendarBestTitle}
          </h4>
          <ul className="space-y-1 text-[11px] text-emerald-950 dark:text-emerald-100">
            {bestStretches.map((b) => (
              <li key={b.start}>
                <span className="font-semibold">{dateRange(b.start, b.end)}</span>
                {' · '}
                {t.home.calendarBestOthers
                  .replace('{count}', b.maxOtherRegions > b.otherRegions ? `${b.otherRegions}–${b.maxOtherRegions}` : String(b.otherRegions))
                  .replace('{total}', String(otherTotal))}
                <span className="text-emerald-800/70 dark:text-emerald-300/70"> ({t.home.calendarBestBlock.replace('{range}', dateRange(b.blockStart, b.blockEnd))})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quietStretches.length > 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 space-y-1.5">
          <h4 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <Star aria-hidden="true" className="w-3.5 h-3.5 fill-white stroke-emerald-700 dark:stroke-emerald-300 stroke-[2.5]" />
            {t.home.calendarQuietTitle}
          </h4>
          <ul className="space-y-1 text-[11px] text-emerald-950 dark:text-emerald-100">
            {quietStretches.map((q) => (
              <li key={q.start}>
                <span className="font-semibold">{dateRange(q.start, q.end)}</span>
                {' · '}
                {t.home.calendarRegionsCount.replace('{count}', String(q.regions)).replace('{total}', String(otherTotal))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 min-h-[2.75rem] content-start">
        {scale.length > 0 && (
          <span className="font-semibold">{shownView === 'country' || noKids ? t.home.calendarRegionsLegend : t.home.calendarPersonalLegend}</span>
        )}
        {scale.map((b, i) => (
          <span key={`s${i}`} className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${b.className}`} />
            {bucketLabel(scale, i)}
          </span>
        ))}
        {bestStretches.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden="true" className="w-3 h-3 fill-white stroke-emerald-700 dark:stroke-emerald-300 stroke-[2.5]" />
            {t.home.calendarBestDays}
          </span>
        )}
        {extraLegend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${item.className}`} />
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="w-3 h-3 rounded-[3px] ring-2 ring-inset ring-amber-500" />
          {t.home.calendarLegendPublicHoliday}
        </span>
        {noSchoolData && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${NO_DATA.className}`} />
            {t.home.calendarLegendNoData}
          </span>
        )}
        {showUnknown && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`w-3 h-3 rounded-[3px] ${UNKNOWN.className}`} />
            {t.home.calendarLegendUnknown}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.home.calendarSources}</p>
    </section>
  );
}
