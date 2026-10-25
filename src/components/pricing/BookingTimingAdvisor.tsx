'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlarmClock, BedDouble, Bus, Car, CalendarClock, Hourglass, Lock, Package, Plane, Sparkles, ThumbsUp, Train } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { TranslationDictionary } from '@/lib/i18n/types';
import type { BookingTimingAdvice, BookingTimingStatus, BookingTravelMode } from '@/lib/pricing/booking-timing';

const STATUS_STYLE: Record<BookingTimingStatus, { icon: LucideIcon; pill: string; card: string; accent: string }> = {
  TOO_EARLY_SCHEDULE_LOCKED: {
    icon: Lock,
    pill: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    card: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
    accent: 'text-slate-600 dark:text-slate-300',
  },
  EARLY_BIRD_SWEET_SPOT: {
    icon: Sparkles,
    pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    card: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  OPTIMAL_BOOKING_WINDOW: {
    icon: ThumbsUp,
    pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    card: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  WAIT_FOR_PRICE_DROP: {
    icon: Hourglass,
    pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    card: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  HIGH_URGENCY_SCARCITY: {
    icon: AlarmClock,
    pill: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    card: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60',
    accent: 'text-rose-700 dark:text-rose-300',
  },
  LAST_MINUTE_GAMBLE: {
    icon: Package,
    pill: 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    card: 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/60',
    accent: 'text-orange-700 dark:text-orange-300',
  },
};

const TRANSPORT_ICON: Record<BookingTravelMode, LucideIcon> = { FLIGHT: Plane, TRAIN: Train, BUS: Bus, CAR: Car };

function leadTimeText(t: TranslationDictionary, days: number): string {
  if (days === 0) return t.bookingTiming.leadTimeToday;
  if (days === 1) return t.bookingTiming.leadTimeOne;
  return t.bookingTiming.leadTime.replace('{days}', String(days));
}

function transportText(t: TranslationDictionary, advice: BookingTimingAdvice): string {
  const key =
    advice.transportAction === 'BOOK_NOW' && advice.status === 'OPTIMAL_BOOKING_WINDOW'
      ? 'BOOK_NOW_IN_WINDOW'
      : advice.transportAction;
  const window = advice.transportWindow;
  return t.bookingTiming.transport[key]
    .replace('{minWeeks}', window ? String(Math.round(window.toDaysBefore / 7)) : '')
    .replace('{maxWeeks}', window ? String(Math.round(window.fromDaysBefore / 7)) : '');
}

/** Compact status pill for a result card */
export function BookingTimingBadge({ advice, className = '' }: { advice: BookingTimingAdvice; className?: string }) {
  const { t } = useI18n();
  const style = STATUS_STYLE[advice.status];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${style.pill} ${className}`}
      title={`${t.bookingTiming.title}: ${leadTimeText(t, advice.daysUntilDeparture)}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {t.bookingTiming.statusLabel[advice.status]}
    </span>
  );
}

/** Detailed advice: lead time, why it applies to this trip, and journey vs. accommodation */
export function BookingTimingCard({ advice }: { advice: BookingTimingAdvice }) {
  const { t } = useI18n();
  const style = STATUS_STYLE[advice.status];
  const StatusIcon = style.icon;
  const TransportIcon = TRANSPORT_ICON[advice.travelMode];
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`p-2.5 rounded-lg border text-[11px] space-y-2 ${style.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className={`font-bold flex items-center gap-1 ${style.accent}`}>
          <CalendarClock className="w-3.5 h-3.5" />
          {t.bookingTiming.title}
        </h3>
        <BookingTimingBadge advice={advice} />
      </div>

      <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-start gap-1.5">
        <StatusIcon className={`w-3.5 h-3.5 shrink-0 mt-px ${style.accent}`} />
        <span>
          {leadTimeText(t, advice.daysUntilDeparture)}: {t.bookingTiming.statusSummary[advice.status]}
        </span>
      </p>

      {advice.reasons.length > 0 && (
        <ul className="space-y-1 text-slate-600 dark:text-slate-300 leading-snug list-disc pl-4">
          {advice.reasons.map((reason) => (
            <li key={reason}>{t.bookingTiming.reasons[reason]}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <div className="p-1.5 rounded-md bg-white/70 dark:bg-slate-900/50 border border-white dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TransportIcon className="w-3 h-3" />
            {t.bookingTiming.transportHeading[advice.travelMode]}
          </span>
          <p className="text-slate-700 dark:text-slate-200 leading-snug mt-0.5">{transportText(t, advice)}</p>
        </div>
        <div className="p-1.5 rounded-md bg-white/70 dark:bg-slate-900/50 border border-white dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <BedDouble className="w-3 h-3" />
            {t.bookingTiming.accommodationHeading}
          </span>
          <p className="text-slate-700 dark:text-slate-200 leading-snug mt-0.5">
            {t.bookingTiming.accommodation[advice.accommodationAction]}
          </p>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 dark:text-slate-500">{t.bookingTiming.disclaimer}</p>
    </section>
  );
}
