'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { CONTINENT_ORDER, getCountriesOfContinent } from '@/lib/geo/continents';

let blockedRequest: Promise<string[]> | null = null;
function loadSafetyBlockedCountries(): Promise<string[]> {
  blockedRequest ??= fetch('/api/safety/discovery-blocked')
    .then((r) => (r.ok ? r.json() : { countries: [] }))
    .then((d: { countries?: string[] }) => d.countries ?? [])
    .catch(() => {
      blockedRequest = null;
      return [];
    });
  return blockedRequest;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface CountryExclusionPickerProps {
  /** ISO 3166-1 alpha-2 codes */
  value: string[];
  onChange: (codes: string[]) => void;
  id?: string;
}

export function CountryExclusionPicker({ value, onChange, id }: CountryExclusionPickerProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [safetyBlocked, setSafetyBlocked] = useState<Set<string>>(() => new Set());
  const isSmallScreen = useIsSmallScreen();

  useEffect(() => {
    let active = true;
    loadSafetyBlockedCountries().then((codes) => {
      if (active) setSafetyBlocked(new Set(codes));
    });
    return () => {
      active = false;
    };
  }, []);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (!open) setQuery('');
    },
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ elements, availableHeight }) {
          elements.floating.style.setProperty('--menu-available-height', `${Math.max(200, availableHeight)}px`);
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, POPOVER_DISMISS_OPTIONS),
    useRole(context),
  ]);

  const countryName = useMemo(() => {
    let names: Intl.DisplayNames | undefined;
    try {
      names = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      // Unsupported locale: fall back to the codes
    }
    return (code: string) => names?.of(code) || code;
  }, [locale]);

  const selected = useMemo(() => new Set(value), [value]);

  const groups = useMemo(() => {
    const q = fold(query.trim());
    return CONTINENT_ORDER.map((continent) => ({
      continent,
      countries: getCountriesOfContinent(continent)
        // Already left out by the travel advisories; kept only if the user excluded it before
        .filter((code) => !safetyBlocked.has(code) || selected.has(code))
        .map((code) => ({ code, name: countryName(code) }))
        .filter((c) => !q || fold(c.name).includes(q) || c.code.toLowerCase() === q)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    })).filter((g) => g.countries.length > 0);
  }, [query, countryName, locale, safetyBlocked, selected]);
  const toggle = (code: string) =>
    onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code].sort());

  const label =
    value.length === 0
      ? t.home.excludeCountriesNone
      : (value.length === 1 ? t.home.excludeCountriesCountOne : t.home.excludeCountriesCountOther).replace(
          '{count}',
          String(value.length)
        );

  return (
    <div>
      <button
        id={id}
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        data-testid="country-exclusion-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs select-none ${
          value.length > 0
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-medium text-rose-900 dark:text-rose-200"
            >
              {countryName(code)}
              <button
                type="button"
                onClick={() => toggle(code)}
                aria-label={`${t.home.excludeCountriesRemove}: ${countryName(code)}`}
                className="p-0.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            style={{
              ...getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999),
              maxHeight: isSmallScreen ? '85vh' : 'min(var(--menu-available-height, 24rem), 24rem)',
              overflowY: 'hidden',
            }}
            {...getFloatingProps()}
            className="w-72 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
          >
            <div className="shrink-0 flex items-center justify-between pb-1.5 px-1 border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.home.excludeCountriesLabel}</span>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {t.home.excludeCountriesClear}
                </button>
              )}
            </div>

            <div className="relative mb-2 px-0.5 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus={!isSmallScreen}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.common.search}
                className="w-full text-xs rounded-lg pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {safetyBlocked.size > 0 && (
              <p className="shrink-0 px-1 pb-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                {t.home.excludeCountriesSafetyNote}
              </p>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
              {groups.map((group) => (
                <div key={group.continent}>
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t.home.continentNames[group.continent]}
                  </p>
                  {group.countries.map((c) => {
                    const isExcluded = selected.has(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggle(c.code)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                          isExcluded
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isExcluded ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isExcluded && <Check className="w-3 h-3 stroke-3" />}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="shrink-0 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setQuery('');
                }}
                className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                {t.common.done}
                {value.length > 0 && ` (${value.length})`}
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
