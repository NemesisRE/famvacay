'use client';

import { useState } from 'react';
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
import { DayPicker } from 'react-day-picker';
import { de, enUS, es, fr, it } from 'react-day-picker/locale';
import { Calendar, X } from 'lucide-react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { SupportedLocale } from '@/lib/i18n/types';

const RDP_LOCALES: Record<SupportedLocale, typeof enUS> = { en: enUS, de, fr, es, it };

function toISO(date: Date): string {
  // Local date parts: toISOString converts to UTC and shifts the day for timezones ahead of UTC
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromISO(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

export interface DatePickerProps {
  /** ISO yyyy-mm-dd, or '' for none */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  /** Month and year dropdowns, for dates far from today (birth dates) */
  yearDropdown?: boolean;
  /** Allow removing the date (optional fields) */
  clearable?: boolean;
  className?: string;
}

/** Themed single-date picker: replaces the browser's native one, which ignores dark mode */
export function DatePicker({ value, onChange, min, max, id, yearDropdown, clearable, className = '' }: DatePickerProps) {
  const { locale, t, formatDate } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const isSmallScreen = useIsSmallScreen();
  const selected = fromISO(value);
  const minDate = fromISO(min);
  const maxDate = fromISO(max);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, POPOVER_DISMISS_OPTIONS),
    useRole(context, { role: 'dialog' }),
  ]);

  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];
  const now = new Date();

  return (
    <div className={`relative ${className}`}>
      <button
        id={id}
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs hover:border-teal-400 dark:hover:border-teal-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500 transition cursor-pointer text-left"
      >
        <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
        <span className={`flex-1 truncate ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected ? formatDate(selected, { day: '2-digit', month: '2-digit', year: 'numeric' }) : t.home.selectDate}
        </span>
        {clearable && selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t.common.close}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }
            }}
            className="p-0.5 -mr-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            // Phones: a centred dialog as wide as the calendar, not the full-width sheet other popovers use
            style={{ ...getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999), ...(isSmallScreen ? { width: 'auto' } : {}) }}
            {...getFloatingProps()}
            className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (!date) return;
                onChange(toISO(date));
                setIsOpen(false);
              }}
              locale={RDP_LOCALES[locale] || enUS}
              disabled={disabled.length > 0 ? disabled : undefined}
              defaultMonth={selected || minDate || maxDate}
              captionLayout={yearDropdown ? 'dropdown' : 'label'}
              // Always six week rows: the popup keeps its height and buttons stay put between months
              fixedWeeks
              startMonth={yearDropdown ? minDate ?? new Date(now.getFullYear() - 100, 0) : minDate}
              endMonth={yearDropdown ? maxDate ?? new Date(now.getFullYear() + 15, 11) : maxDate}
              className={isSmallScreen ? 'rdp-themed rdp-touch' : 'rdp-themed'}
            />
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
