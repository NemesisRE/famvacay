'use client';

import React, { useState, useMemo } from 'react';
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
import { MapPin, ChevronDown, Check, X, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface DestinationOption {
  code: string;
  name: string;
  count: number;
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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const isAllSelected = selectedDestinations.length === 0;

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

  const getButtonLabel = () => {
    if (isAllSelected) {
      return `${t.home.allDestinations} (${totalCount})`;
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
        d.code.toLowerCase().includes(q)
    );
  }, [destinations, searchQuery]);

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
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
          title={t.home.filterByDestination}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span className="truncate">{getButtonLabel()}</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dedicated Quick-Reset X Button */}
        {!isAllSelected && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="p-1.5 text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-950/60 rounded-lg transition cursor-pointer shrink-0"
            title={t.home.clearDestinationFilter}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 99999,
            }}
            {...getFloatingProps()}
            className="w-72 max-h-84 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-100 transition-all duration-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Clear all */}
            <div className="flex items-center justify-between pb-1.5 px-1 border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[11px]">
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
              <div className="relative mb-2 px-0.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.home.filterDestinationsPlaceholder || 'Search destination...'}
                  className="w-full text-xs rounded-lg pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-teal-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

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
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{t.home.allDestinations}</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                ({totalCount})
              </span>
            </button>

            {/* Individual Destinations */}
            <div className="mt-1 space-y-0.5">
              {filteredDestinations.map((dest) => {
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
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{dest.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">
                        ({dest.code})
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1.5 ${
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
        </FloatingPortal>
      )}
    </div>
  );
}

