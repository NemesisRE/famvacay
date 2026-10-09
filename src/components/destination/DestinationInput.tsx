'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Check, Compass } from 'lucide-react';
import { POPULAR_DESTINATIONS } from '@/lib/optimizer/weather';
import { DestinationType } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';

interface DestinationInputProps {
  value: string; // airport or destination code, e.g. 'PMI' or ''
  onChange: (code: string) => void;
  destinationType: DestinationType;
  className?: string;
}

export function DestinationInput({
  value,
  onChange,
  destinationType,
  className = '',
}: DestinationInputProps) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Popular destinations matching current category
  const categoryDestinations = Object.values(POPULAR_DESTINATIONS).filter(
    (d) => d.type === destinationType
  );

  const selectedDestination = value ? (POPULAR_DESTINATIONS as any)[value] : null;

  // Search when typing
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        // Search via airports search endpoint
        const res = await fetch(`/api/airports/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.airports || []);
        }
      } catch (err) {
        console.error('Error searching destinations:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const handleSelect = (code: string) => {
    onChange(code);
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          {t.home.targetDestinationLabel}
        </span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-blue-600 hover:underline"
          >
            {t.home.allDestinations}
          </button>
        )}
      </label>

      {/* Selected chip or Search input */}
      {value ? (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-blue-800 bg-blue-200/80 px-1.5 py-0.5 rounded text-[11px]">
              {value}
            </span>
            <span className="font-semibold text-slate-800 truncate">
              {selectedDestination ? selectedDestination.name : value}
            </span>
            {selectedDestination?.country && (
              <span className="text-slate-500 text-[11px]">({selectedDestination.country})</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
            title="Reset to all destinations"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t.home.destinationSearchPlaceholder}
            className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-8 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          {searching && (
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
          )}
          {searchQuery && !searching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown with Category Recommendations + Search Matches */}
      {dropdownOpen && !value && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
          {/* Default Option: All destinations */}
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 flex items-center justify-between"
          >
            <span>✨ {t.home.allDestinations}</span>
            <Check className="w-3 h-3 text-blue-600" />
          </button>

          {/* Search results if query entered */}
          {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                Search Matches
              </div>
              {searchResults.slice(0, 8).map((ap) => (
                <button
                  key={ap.code}
                  type="button"
                  onClick={() => handleSelect(ap.code)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                      {ap.code}
                    </span>
                    <span className="font-medium text-slate-800">{ap.city}</span>
                    <span className="text-slate-400 text-[11px]">({ap.country})</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Category destinations */}
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
              Popular in {destinationType}
            </div>
            {categoryDestinations.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => handleSelect(d.code)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                    {d.code}
                  </span>
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="text-slate-400 text-[11px]">({d.country})</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

