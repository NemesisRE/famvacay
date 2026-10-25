'use client';

import { useState, useMemo } from 'react';
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
import { ChevronDown, Check, Minus, X, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { CONTINENT_ORDER, type Continent } from '@/lib/geo/continents';

export interface DestinationOption {
  code: string;
  name: string;
  count: number;
  /** ISO 3166-1 alpha-2, for grouping */
  countryCode?: string;
  /** Localized country name, shown as the group heading */
  countryName?: string;
  continent?: Continent;
}

type ContinentKey = Continent | 'OTHER';

interface DestinationGroup {
  continent: ContinentKey;
  count: number;
  codes: string[];
  countries: { name: string; count: number; codes: string[]; destinations: DestinationOption[] }[];
}

/** Continent -> country -> destinations, in continent order and alphabetical countries */
function groupDestinations(destinations: DestinationOption[], locale: string): DestinationGroup[] {
  const byContinent = new Map<ContinentKey, Map<string, DestinationOption[]>>();
  for (const d of destinations) {
    const continent = d.continent ?? 'OTHER';
    const countries = byContinent.get(continent) ?? new Map<string, DestinationOption[]>();
    const country = d.countryName || d.countryCode || '';
    countries.set(country, [...(countries.get(country) ?? []), d]);
    byContinent.set(continent, countries);
  }
  return ([...CONTINENT_ORDER, 'OTHER'] as ContinentKey[])
    .filter((c) => byContinent.has(c))
    .map((continent) => {
      const countries = [...byContinent.get(continent)!.entries()]
        .sort(([a], [b]) => a.localeCompare(b, locale))
        .map(([name, list]) => ({
          name,
          count: list.reduce((sum, d) => sum + d.count, 0),
          codes: list.map((d) => d.code),
          destinations: list,
        }));
      return {
        continent,
        count: countries.reduce((sum, c) => sum + c.count, 0),
        codes: countries.flatMap((c) => c.codes),
        countries,
      };
    });
}

function Checkbox({ state }: { state: 'all' | 'some' | 'none' }) {
  return (
    <div
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
        state === 'none'
          ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
          : 'bg-teal-600 border-teal-600 text-white'
      }`}
    >
      {state === 'all' && <Check className="w-3 h-3 stroke-3" />}
      {state === 'some' && <Minus className="w-3 h-3 stroke-3" />}
    </div>
  );
}

export interface DestinationFilterDropdownProps {
  destinations: DestinationOption[];
  selectedDestinations: string[]; // empty array means "ALL"
  onChange: (selected: string[]) => void;
  totalCount: number;
  className?: string;
}

export function DestinationFilterDropdown({
  destinations,
  selectedDestinations,
  onChange,
  totalCount,
  className = '',
}: DestinationFilterDropdownProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      // Height limited to the space available on screen
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

  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const isAllSelected = selectedDestinations.length === 0;
  const allGroups = useMemo(() => groupDestinations(destinations, locale), [destinations, locale]);

  const handleToggleDestination = (code: string) => {
    if (selectedDestinations.includes(code)) {
      onChange(selectedDestinations.filter((c) => c !== code));
    } else {
      onChange([...selectedDestinations, code]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const groupState = (codes: string[]): 'all' | 'some' | 'none' => {
    const selectedCount = codes.filter((c) => selectedDestinations.includes(c)).length;
    return selectedCount === 0 ? 'none' : selectedCount === codes.length ? 'all' : 'some';
  };

  // Selecting a group while everything is shown means "only this group"; otherwise the group is
  // added to or removed from the current selection
  const handleToggleGroup = (codes: string[]) => {
    if (groupState(codes) === 'all') {
      onChange(selectedDestinations.filter((c) => !codes.includes(c)));
    } else {
      onChange([...new Set([...selectedDestinations, ...codes])]);
    }
  };

  const getButtonLabel = () => {
    if (isAllSelected) {
      return `${t.home.allDestinations} (${totalCount})`;
    }
    // A selection that is exactly one country or continent is named after it
    const selectedSet = new Set(selectedDestinations);
    const sameSet = (codes: string[]) => codes.length === selectedSet.size && codes.every((c) => selectedSet.has(c));
    if (selectedDestinations.length > 1) {
      for (const group of allGroups) {
        if (sameSet(group.codes)) return `${t.home.continentNames[group.continent]} (${group.count})`;
        const country = group.countries.find((c) => sameSet(c.codes));
        if (country) return `${country.name} (${country.count})`;
      }
    }
    if (selectedDestinations.length === 1) {
      const match = destinations.find((d) => d.code === selectedDestinations[0]);
      return match ? `${match.name} (${match.count})` : selectedDestinations[0];
    }
    const firstMatch = destinations.find((d) => d.code === selectedDestinations[0]);
    const firstName = firstMatch ? firstMatch.name : selectedDestinations[0];
    return `${firstName} (+${selectedDestinations.length - 1})`;
  };

  const filteredDestinations = useMemo(() => {
    if (!searchQuery.trim()) return destinations;
    const q = searchQuery.toLowerCase();
    return destinations.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.countryName ?? '').toLowerCase().includes(q) ||
        t.home.continentNames[d.continent ?? 'OTHER'].toLowerCase().includes(q)
    );
  }, [destinations, searchQuery, t]);

  const groups = useMemo(() => groupDestinations(filteredDestinations, locale), [filteredDestinations, locale]);
  const showContinents = groups.length > 1;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          ref={refs.setReference}
          {...getReferenceProps()}
          type="button"
          data-testid="destination-filter-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs select-none ${
            !isAllSelected
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold hover:bg-teal-100/70 dark:hover:bg-teal-900/40'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
          title={t.home.filterByDestination}
        >
          <span className="truncate">{getButtonLabel()}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {/* No reset button here: the filter panel row has its own, like every other filter */}
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            style={{
              ...getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999),
              // Only the destination list scrolls; header, search and "Done" stay in place
              maxHeight: isSmallScreen ? '85vh' : 'min(var(--menu-available-height, 24rem), 24rem)',
              overflowY: 'hidden',
            }}
            {...getFloatingProps()}
            className="w-72 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-100 transition-all duration-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Clear all */}
            <div className="shrink-0 flex items-center justify-between pb-1.5 px-1 border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.home.filterByDestination}
              </span>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {t.home.allDestinations}
                </button>
              )}
            </div>

            {/* Search Input when more than 5 destinations */}
            {destinations.length > 5 && (
              <div className="relative mb-2 px-0.5 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full text-xs rounded-lg pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
            {/* "All Destinations" Option */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                isAllSelected
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isAllSelected
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-3" />}
                </div>
                <span>{t.home.allDestinations}</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                ({totalCount})
              </span>
            </button>

            {/* Destinations grouped by continent and country: a group row selects all of it */}
            <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] text-slate-400 dark:text-slate-500">{t.home.destinationGroupHint}</p>
            <div className="mt-0.5 space-y-0.5">
              {groups.map((group) => (
                <div key={group.continent} className="space-y-0.5">
                  {showContinents && (
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group.codes)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 mt-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox state={groupState(group.codes)} />
                        <span>{t.home.continentNames[group.continent]}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium normal-case">({group.count})</span>
                    </button>
                  )}
                  {group.countries.map((country) => {
                    const isCountryGroup = country.destinations.length > 1;
                    return (
                      <div key={country.name} className={showContinents ? 'pl-3' : ''}>
                        {isCountryGroup && (
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(country.codes)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox state={groupState(country.codes)} />
                              <span className="truncate">{country.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0 ml-1.5">({country.count})</span>
                          </button>
                        )}
                        <div className={isCountryGroup ? 'pl-3' : ''}>
                          {country.destinations.map((dest) => {
                            const isSelected = selectedDestinations.includes(dest.code);
                            return (
                              <button
                                key={dest.code}
                                type="button"
                                onClick={() => handleToggleDestination(dest.code)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                                  isSelected
                                    ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate min-w-0">
                                  <Checkbox state={isSelected ? 'all' : 'none'} />
                                  <span className="truncate" title={dest.name}>{dest.name}</span>
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                                    isSelected
                                      ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 font-bold'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {dest.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            </div>

            {/* Clear way out: close the menu once the selection is done */}
            <div className="shrink-0 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                {t.common.done}
                {!isAllSelected && ` (${selectedDestinations.length})`}
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

