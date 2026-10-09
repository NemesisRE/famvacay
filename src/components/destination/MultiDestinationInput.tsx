'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Compass, Search, X, Plus, Sparkles, MapPin, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface DestinationSuggestion {
  name: string;
  category: 'country' | 'region' | 'city' | 'airport';
  code?: string;
  country?: string;
}

// Comprehensive popular family holiday destinations catalog
export const POPULAR_FAMILY_DESTINATIONS: DestinationSuggestion[] = [
  // Countries
  { name: 'Egypt', category: 'country', country: 'EG' },
  { name: 'Spain', category: 'country', country: 'ES' },
  { name: 'Greece', category: 'country', country: 'GR' },
  { name: 'Turkey', category: 'country', country: 'TR' },
  { name: 'Italy', category: 'country', country: 'IT' },
  { name: 'Portugal', category: 'country', country: 'PT' },
  { name: 'Tunisia', category: 'country', country: 'TN' },
  { name: 'Thailand', category: 'country', country: 'TH' },
  { name: 'Croatia', category: 'country', country: 'HR' },
  { name: 'Cyprus', category: 'country', country: 'CY' },
  { name: 'Austria', category: 'country', country: 'AT' },
  { name: 'France', category: 'country', country: 'FR' },

  // Regions & Resort Hubs
  { name: 'Hurghada & Red Sea', category: 'region', code: 'HRG', country: 'Egypt' },
  { name: 'Sharm el Sheikh', category: 'region', code: 'SSH', country: 'Egypt' },
  { name: 'Mallorca (Balearic Islands)', category: 'region', code: 'PMI', country: 'Spain' },
  { name: 'Canary Islands (Tenerife / Gran Canaria)', category: 'region', code: 'TFS', country: 'Spain' },
  { name: 'Turkish Riviera & Antalya', category: 'region', code: 'AYT', country: 'Turkey' },
  { name: 'Crete & Greek Islands', category: 'region', code: 'HER', country: 'Greece' },
  { name: 'Rhodes', category: 'region', code: 'RHO', country: 'Greece' },
  { name: 'Kos', category: 'region', code: 'KGS', country: 'Greece' },
  { name: 'Djerba', category: 'region', code: 'DJE', country: 'Tunisia' },
  { name: 'Algarve', category: 'region', code: 'FAO', country: 'Portugal' },
  { name: 'Costa del Sol (Malaga)', category: 'region', code: 'AGP', country: 'Spain' },
  { name: 'Bali', category: 'region', code: 'DPS', country: 'Indonesia' },
  { name: 'Phuket', category: 'region', code: 'HKT', country: 'Thailand' },
  { name: 'Cancun & Riviera Maya', category: 'region', code: 'CUN', country: 'Mexico' },
  { name: 'Dubai', category: 'city', code: 'DXB', country: 'UAE' },
  { name: 'Barcelona', category: 'city', code: 'BCN', country: 'Spain' },
  { name: 'Rome', category: 'city', code: 'FCO', country: 'Italy' },
];

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
  const { t } = useI18n();

  const [inputVal, setInputVal] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<DestinationSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter recommendations based on input query
  useEffect(() => {
    const q = inputVal.trim().toLowerCase();
    if (!q) {
      setSearchResults(POPULAR_FAMILY_DESTINATIONS.slice(0, 8));
      return;
    }

    const matched = POPULAR_FAMILY_DESTINATIONS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.country && d.country.toLowerCase().includes(q)) ||
        (d.code && d.code.toLowerCase().includes(q))
    );

    setSearchResults(matched.slice(0, 8));
  }, [inputVal]);

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

  const addDestination = (dest: string) => {
    const clean = dest.trim();
    if (!clean) return;
    if (!selectedDestinations.includes(clean)) {
      onChange([...selectedDestinations, clean]);
    }
    setInputVal('');
    setDropdownOpen(false);
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
            className="text-[10px] text-blue-600 hover:underline"
          >
            {t.home.allDestinationsOption}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">{t.home.destinationsHint}</p>

      {/* Selected Destination Chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-slate-50/80 rounded-xl border border-slate-200">
        {selectedDestinations.length === 0 ? (
          <span className="text-xs text-blue-700 font-medium inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
            <Sparkles className="w-3 h-3 text-blue-500" />
            {t.home.allDestinationsOption}
          </span>
        ) : (
          selectedDestinations.map((dest) => (
            <span
              key={dest}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-xs"
            >
              <Globe className="w-3 h-3 text-blue-200" />
              <span>{dest}</span>
              <button
                type="button"
                onClick={() => removeDestination(dest)}
                className="hover:bg-blue-700 p-0.5 rounded-full transition-colors text-blue-200 hover:text-white"
                title="Remove destination"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Destination Search & Input */}
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.home.destinationsPlaceholder}
          className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-16 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        {inputVal.trim() && (
          <button
            type="button"
            onClick={() => addDestination(inputVal.trim())}
            className="absolute right-2 top-1.5 px-2 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-xs"
          >
            {t.home.addCustomDestination}
          </button>
        )}

        {/* Dropdown with Suggestions */}
        {dropdownOpen && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
            {inputVal.trim() && (
              <button
                type="button"
                onClick={() => addDestination(inputVal.trim())}
                className="w-full text-left px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100 transition-colors flex items-center justify-between"
              >
                <span>+ {t.home.addCustomDestination} &ldquo;{inputVal.trim()}&rdquo;</span>
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {searchResults.map((item) => {
              const isSelected = selectedDestinations.includes(item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => addDestination(item.name)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between ${
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
                  <span className="text-[10px] text-slate-400 capitalize flex-shrink-0 ml-2">
                    {item.category}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

