'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plane, Search, X, ChevronDown, ChevronUp, Train, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface AirportItem {
  code: string;
  name: string;
  city: string;
  country: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  isHighSpeedRailConnected?: boolean;
  railConnectivityNote?: string;
  flightCorridorNote?: string;
}

interface AirportSelectorProps {
  selectedAirports: string[];
  onChange: (airports: string[]) => void;
  coordinates?: { lat: number; lon: number } | null;
  targetDestinations?: string[];
  className?: string;
}

export function AirportSelector({
  selectedAirports,
  onChange,
  coordinates,
  targetDestinations,
  className = '',
}: AirportSelectorProps) {
  const { t, locale } = useI18n();

  const [suggestions, setSuggestions] = useState<AirportItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AirportItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Airport details cache for selected chips and suggestion synchronization
  const [airportDetails, setAirportDetails] = useState<Record<string, AirportItem>>({});

  // Ensure all selected airports have full localized metadata loaded
  useEffect(() => {
    const missing = selectedAirports.filter((code) => !airportDetails[code]);
    if (missing.length === 0) return;

    fetch(`/api/airports/search?codes=${encodeURIComponent(missing.join(','))}&locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.airports) {
          setAirportDetails((prev) => {
            const updated = { ...prev };
            for (const ap of data.airports) {
              updated[ap.code] = ap;
            }
            return updated;
          });
        }
      })
      .catch(() => {});
  }, [selectedAirports, airportDetails, locale]);

  // Fetch recommended airports and prune stale airports when coordinates or destinations change
  useEffect(() => {
    let active = true;

    async function fetchRecommended() {
      try {
        setLoadingSuggestions(true);
        const destParam =
          targetDestinations && targetDestinations.length > 0
            ? `&destinations=${encodeURIComponent(targetDestinations.join(','))}`
            : '';
        const selectedParam =
          selectedAirports && selectedAirports.length > 0
            ? `&selected=${encodeURIComponent(selectedAirports.join(','))}`
            : '';
        const url = coordinates
          ? `/api/airports/search?lat=${coordinates.lat}&lon=${coordinates.lon}&locale=${locale}${destParam}${selectedParam}`
          : `/api/airports/search?locale=${locale}${destParam}${selectedParam}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (active && data.airports) {
            setSuggestions(data.airports);

            // Populate airport details cache
            setAirportDetails((prev) => {
              const updated = { ...prev };
              for (const ap of data.airports) {
                updated[ap.code] = ap;
              }
              return updated;
            });

            // Automatically synchronize pruned airports if selection became stale
            if (
              Array.isArray(data.updatedSelection) &&
              (data.prunedCodes?.length > 0 || (selectedAirports.length === 0 && data.updatedSelection.length > 0))
            ) {
              const currentStr = selectedAirports.slice().sort().join(',');
              const newStr = data.updatedSelection.slice().sort().join(',');
              if (currentStr !== newStr) {
                onChange(data.updatedSelection);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching airport recommendations:', err);
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    }

    fetchRecommended();

    return () => {
      active = false;
    };
  }, [coordinates?.lat, coordinates?.lon, JSON.stringify(targetDestinations), locale]);

  // Debounced airport search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const coordsParam = coordinates ? `&lat=${coordinates.lat}&lon=${coordinates.lon}` : '';
        const res = await fetch(
          `/api/airports/search?q=${encodeURIComponent(searchQuery.trim())}&locale=${locale}${coordsParam}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.airports || []);
          setShowDropdown(true);

          setAirportDetails((prev) => {
            const updated = { ...prev };
            for (const ap of data.airports || []) {
              updated[ap.code] = ap;
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Error searching airports:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, coordinates?.lat, coordinates?.lon, locale]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAirport = (code: string) => {
    if (!selectedAirports.includes(code)) {
      onChange([...selectedAirports, code]);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemoveAirport = (code: string) => {
    if (selectedAirports.length > 1) {
      onChange(selectedAirports.filter((c) => c !== code));
    }
  };

  const toggleSuggestion = (code: string) => {
    if (selectedAirports.includes(code)) {
      if (selectedAirports.length > 1) {
        onChange(selectedAirports.filter((c) => c !== code));
      }
    } else {
      onChange([...selectedAirports, code]);
    }
  };

  // Synchronized list of suggestion hubs: union of recommended hubs and any selected airport
  const synchronizedHubs = useMemo(() => {
    const map = new Map<string, AirportItem>();
    suggestions.forEach((a) => map.set(a.code, a));
    selectedAirports.forEach((code) => {
      if (!map.has(code) && airportDetails[code]) {
        map.set(code, airportDetails[code]);
      }
    });
    return Array.from(map.values());
  }, [suggestions, selectedAirports, airportDetails]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Selected Airport Chips */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-blue-600" />
            {t.home.airportsLabel} ({selectedAirports.length})
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            {selectedAirports.length === 1 ? '1 selected' : `${selectedAirports.length} selected`}
          </span>
        </label>
        <p className="text-[11px] text-slate-500 mb-2">{t.home.airportsHint}</p>

        <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50/80 rounded-xl border border-slate-200">
          {selectedAirports.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No airports selected</span>
          ) : (
            selectedAirports.map((code) => {
              const details = airportDetails[code];
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm"
                >
                  <Plane className="w-3 h-3 text-blue-200" />
                  <span>{code}</span>
                  {details && (
                    <span className="font-normal text-blue-100 text-[11px] max-w-[160px] truncate">
                      · {details.city || details.name}
                    </span>
                  )}
                  {selectedAirports.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAirport(code)}
                      className="ml-0.5 hover:bg-blue-700 p-0.5 rounded-full transition-colors text-blue-200 hover:text-white"
                      title="Remove airport"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* Airport Search Input */}
      <div ref={searchContainerRef} className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder={t.home.searchAirportsPlaceholder}
            className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-8 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          {searching && (
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
          )}
          {searchQuery && !searching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
            {searchResults.map((ap) => {
              const isSelected = selectedAirports.includes(ap.code);
              return (
                <button
                  key={ap.code}
                  type="button"
                  onClick={() => handleSelectAirport(ap.code)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-blue-50/60 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                      {ap.code}
                    </span>
                    <div className="truncate">
                      <span className="font-medium text-slate-800">{ap.city}</span>
                      <span className="text-slate-400 ml-1">({ap.name})</span>
                      <span className="text-slate-400 ml-1 text-[10px]">· {ap.country}</span>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-semibold flex-shrink-0">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  ) : (
                    <span className="text-blue-600 text-[11px] font-semibold flex-shrink-0">
                      + Add
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Suggestions List */}
      <div>
        <button
          type="button"
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1.5 transition-colors"
        >
          {showSuggestions ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              {t.home.hideSuggestions}
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              {t.home.showSuggestions.replace('{count}', String(synchronizedHubs.length))}
            </>
          )}
        </button>

        {showSuggestions && (
          <div className="mt-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600">
                Nearby Hubs &amp; Train-Connected Airports
              </span>
              {loadingSuggestions && (
                <span className="text-[10px] text-slate-400 animate-pulse">Updating...</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {synchronizedHubs.map((airport) => {
                const isSelected = selectedAirports.includes(airport.code);
                return (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => toggleSuggestion(airport.code)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>
                      {airport.code} · {airport.city}
                      {airport.distanceKm !== undefined && (
                        <span className={isSelected ? 'text-blue-100 ml-1' : 'text-slate-400 ml-1'}>
                          ({Math.round(airport.distanceKm)} km)
                        </span>
                      )}
                    </span>
                    {airport.isHighSpeedRailConnected && (
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                        title={airport.railConnectivityNote || t.home.railConnected}
                      >
                        <Train className="w-2.5 h-2.5" />
                        TGV
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
