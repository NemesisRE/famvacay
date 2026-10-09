'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Compass, Search, X, Plus, Sparkles, Globe, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import {
  CANONICAL_DESTINATIONS,
  getDestinationEntity,
  getLocalizedDestinationName,
  getLocalizedCategoryName,
  validateDestinationInput,
  DestinationCategory,
} from '@/lib/optimizer/destinations';

export interface DisplayDestinationSuggestion {
  id: string;
  name: string;
  category: DestinationCategory;
  categoryLabel: string;
  code?: string;
  country?: string;
}

interface MultiDestinationInputProps {
  selectedDestinations: string[];
  onChange: (destinations: string[]) => void;
  className?: string;
}

export function MultiDestinationInput({
  selectedDestinations,
  onChange,
  className = '',
}: MultiDestinationInputProps) {
  const { locale, t } = useI18n();

  const [inputVal, setInputVal] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<DisplayDestinationSuggestion[]>([]);
  const [destinationWarning, setDestinationWarning] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate localized destination recommendations based on current locale & query
  useEffect(() => {
    const loc = locale || 'de';
    const q = inputVal.trim().toLowerCase();

    const allSuggestions: DisplayDestinationSuggestion[] = CANONICAL_DESTINATIONS.map((d) => {
      const locKey = (loc.slice(0, 2) as keyof typeof d.countryNames) || 'de';
      return {
        id: d.id,
        name: getLocalizedDestinationName(d, loc),
        category: d.category,
        categoryLabel: getLocalizedCategoryName(d.category, loc),
        code: d.code,
        country: d.countryNames[locKey] || d.countryNames.de,
      };
    });

    if (!q) {
      setSearchResults(allSuggestions.slice(0, 8));
      return;
    }

    const matched = allSuggestions.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.country && d.country.toLowerCase().includes(q)) ||
        (d.code && d.code.toLowerCase().includes(q))
    );

    setSearchResults(matched.slice(0, 8));
  }, [inputVal, locale]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addDestination = async (destInput: string) => {
    const clean = destInput.trim();
    if (!clean) return;

    setIsValidating(true);
    setDestinationWarning(null);

    try {
      const validation = await validateDestinationInput(clean, locale);

      if (!validation.isValid || !validation.resolvedName) {
        setDestinationWarning(
          t.home.destinationUnverifiedWarning.replace('{name}', clean)
        );
        return;
      }

      const canonicalName = validation.resolvedName;

      // Check for duplicates
      const alreadySelected = selectedDestinations.some((d) => {
        if (d.toLowerCase() === canonicalName.toLowerCase()) return true;
        const e1 = getDestinationEntity(d, locale);
        const e2 = validation.entity;
        return e1 && e2 && e1.id === e2.id;
      });

      if (!alreadySelected) {
        onChange([...selectedDestinations, canonicalName]);
      }

      setInputVal('');
      setDestinationWarning(null);
      setDropdownOpen(false);
    } catch (err) {
      console.error('Error validating destination:', err);
      setDestinationWarning(
        t.home.destinationUnverifiedWarning.replace('{name}', clean)
      );
    } finally {
      setIsValidating(false);
    }
  };

  const removeDestination = (dest: string) => {
    onChange(selectedDestinations.filter((d) => d !== dest));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputVal.trim()) {
        addDestination(inputVal.trim());
      }
    }
  };

  // Helper to resolve entity details for selected chips
  const getChipDetails = (tag: string) => {
    const entity = getDestinationEntity(tag, locale);
    if (entity) {
      return {
        displayName: getLocalizedDestinationName(entity, locale),
        categoryLabel: getLocalizedCategoryName(entity.category, locale),
        code: entity.code,
      };
    }

    const upper = tag.trim().toUpperCase();
    if (upper.length === 3) {
      return {
        displayName: tag,
        categoryLabel: getLocalizedCategoryName('airport', locale),
        code: upper,
      };
    }

    return {
      displayName: tag,
      categoryLabel: getLocalizedCategoryName('region', locale),
    };
  };

  return (
    <div ref={containerRef} className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          {t.home.destinationsLabel}
        </label>
        {selectedDestinations.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-blue-600 hover:underline cursor-pointer"
          >
            {t.home.allDestinationsOption}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">{t.home.destinationsHint}</p>

      {/* Selected Destination Chips with Entity Metadata Badges */}
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-slate-50/80 rounded-xl border border-slate-200">
        {selectedDestinations.length === 0 ? (
          <span className="text-xs text-blue-700 font-medium inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
            <Sparkles className="w-3 h-3 text-blue-500" />
            {t.home.allDestinationsOption}
          </span>
        ) : (
          selectedDestinations.map((dest) => {
            const chip = getChipDetails(dest);
            return (
              <span
                key={dest}
                className="inline-flex items-center gap-2 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-lg bg-blue-600 text-white shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" />
                <span>{chip.displayName}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/50 text-blue-100 px-1.5 py-0.5 rounded border border-blue-400/40">
                  {chip.categoryLabel}
                </span>
                <button
                  type="button"
                  onClick={() => removeDestination(dest)}
                  className="hover:bg-blue-700 p-0.5 rounded-full transition-colors text-blue-200 hover:text-white cursor-pointer ml-0.5"
                  title="Remove destination"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Destination Search & Input */}
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            if (destinationWarning) setDestinationWarning(null);
          }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.home.destinationsPlaceholder}
          className={`w-full text-xs rounded-lg border pl-8 pr-20 py-2 bg-white focus:outline-none focus:ring-2 shadow-sm ${
            destinationWarning
              ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
              : 'border-slate-300 focus:ring-blue-500'
          }`}
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        {inputVal.trim() && (
          <button
            type="button"
            onClick={() => addDestination(inputVal.trim())}
            disabled={isValidating}
            className="absolute right-2 top-1.5 px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            {isValidating ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="w-3 h-3" />
                {t.home.addCustomDestination}
              </>
            )}
          </button>
        )}

        {/* Dropdown with Suggestions */}
        {dropdownOpen && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
            {inputVal.trim() && (
              <button
                type="button"
                onClick={() => addDestination(inputVal.trim())}
                className="w-full text-left px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>+ {t.home.addCustomDestination} &ldquo;{inputVal.trim()}&rdquo;</span>
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {searchResults.map((item) => {
              const isSelected = selectedDestinations.some((d) => {
                if (d.toLowerCase() === item.name.toLowerCase()) return true;
                const ent = getDestinationEntity(d, locale);
                return ent && ent.id === item.id;
              });

              return (
                <button
                  key={`${item.id}-${item.name}`}
                  type="button"
                  onClick={() => addDestination(item.name)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    {item.code && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">
                        {item.code}
                      </span>
                    )}
                    {item.country && item.category !== 'country' && (
                      <span className="text-slate-400 text-[11px]">({item.country})</span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize flex-shrink-0 ml-2">
                    {item.categoryLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Validation Warning Feedback */}
      {destinationWarning && (
        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5 text-xs text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] leading-tight font-medium">{destinationWarning}</span>
        </div>
      )}
    </div>
  );
}
