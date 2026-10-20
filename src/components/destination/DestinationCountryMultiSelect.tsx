'use client';

import React, { useState } from 'react';
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
import { Globe, ChevronDown, Check, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface DestinationCountryMultiSelectProps {
  availableCountries: string[];
  selectedCountries: string[];
  onChange: (countries: string[]) => void;
  countryCounts?: Record<string, number>;
  className?: string;
}

export function DestinationCountryMultiSelect({
  availableCountries,
  selectedCountries,
  onChange,
  countryCounts = {},
  className = '',
}: DestinationCountryMultiSelectProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(4),
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

  const isAllSelected = selectedCountries.length === 0;

  const handleToggleCountry = (country: string) => {
    if (selectedCountries.includes(country)) {
      onChange(selectedCountries.filter((c) => c !== country));
    } else {
      onChange([...selectedCountries, country]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const getButtonLabel = () => {
    if (isAllSelected) {
      return `${t.home.allCountries} (${availableCountries.length})`;
    }
    if (selectedCountries.length === 1) {
      return selectedCountries[0];
    }
    return `${selectedCountries[0]} (+${selectedCountries.length - 1})`;
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs select-none ${
          !isAllSelected
            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold hover:bg-teal-100/70 dark:hover:bg-teal-900/40'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
        title="Filter by destination country"
      >
        <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
        <span className="truncate max-w-[150px] sm:max-w-[180px]">{getButtonLabel()}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

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
            className="w-64 max-h-80 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-800 dark:text-slate-100 transition-all duration-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Clear all */}
            <div className="flex items-center justify-between pb-1.5 px-2 border-b border-slate-100 dark:border-slate-800 mb-1 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.home.countryLabel}
              </span>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {t.home.allCountries}
                </button>
              )}
            </div>

            {/* "All Countries" Option */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                isAllSelected
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
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
                <span>{t.home.allCountries}</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                ({availableCountries.length})
              </span>
            </button>

            {/* Individual Countries */}
            <div className="mt-1 space-y-0.5">
              {availableCountries.map((c) => {
                const isSelected = selectedCountries.includes(c);
                const count = countryCounts[c];

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleToggleCountry(c)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{c}</span>
                    </div>
                    {count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full flex-shrink-0 ml-1.5 ${
                          isSelected
                            ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    )}
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

