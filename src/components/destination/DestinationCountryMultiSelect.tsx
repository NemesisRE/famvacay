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
            ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold hover:bg-blue-100/70'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
        }`}
        title="Filter by destination country"
      >
        <Globe className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
        <span className="truncate max-w-[150px] sm:max-w-[180px]">{getButtonLabel()}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${
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
            className="w-64 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-2 text-slate-800 transition-all duration-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Clear all */}
            <div className="flex items-center justify-between pb-1.5 px-2 border-b border-slate-100 mb-1 text-[11px]">
              <span className="font-bold text-slate-500 uppercase tracking-wider">
                {t.home.countryLabel}
              </span>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
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
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isAllSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{t.home.allCountries}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
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
                        ? 'bg-blue-50/80 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
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
                            ? 'bg-blue-200 text-blue-900 font-bold'
                            : 'bg-slate-100 text-slate-600'
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

