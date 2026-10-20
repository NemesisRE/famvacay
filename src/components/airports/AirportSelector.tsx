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
  const airportDetailsRef = useRef(airportDetails);
  airportDetailsRef.current = airportDetails;
  const requestedCodesRef = useRef<Set<string>>(new Set());

  // Ensure all selected airports have full localized metadata loaded
  useEffect(() => {
    const missing = selectedAirports.filter(
      (code) => !airportDetailsRef.current[code] && !requestedCodesRef.current.has(`${locale}:${code}`)
    );
    if (missing.length === 0) return;

    for (const code of missing) {
      requestedCodesRef.current.add(`${locale}:${code}`);
    }

    fetch(`/api/airports/search?codes=${encodeURIComponent(missing.join(','))}&locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.airports && data.airports.length > 0) {
          setAirportDetails((prev) => {
            let changed = false;
            const updated = { ...prev };
            for (const ap of data.airports) {
              if (!prev[ap.code] || prev[ap.code].name !== ap.name) {
                updated[ap.code] = ap;
                changed = true;
              }
            }
            return changed ? updated : prev;
          });
        }
      })
      .catch(() => {});
  }, [selectedAirports, locale]);

  const destinationsKey = JSON.stringify(targetDestinations);
  const coordLat = coordinates?.lat;
  const coordLon = coordinates?.lon;

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
              let changed = false;
              const updated = { ...prev };
              for (const ap of data.airports) {
                if (!prev[ap.code] || prev[ap.code].name !== ap.name) {
                  updated[ap.code] = ap;
                  changed = true;
                }
              }
              return changed ? updated : prev;
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
  }, [coordLat, coordLon, destinationsKey, locale]);

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
            let changed = false;
            const updated = { ...prev };
            for (const ap of data.airports || []) {
              if (!prev[ap.code] || prev[ap.code].name !== ap.name) {
                updated[ap.code] = ap;
                changed = true;
              }
            }
            return changed ? updated : prev;
          });
        }
      } catch (err) {
        console.error('Error searching airports:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, coordLat, coordLon, locale]);

  // Close dropdown on outside click or touch ONLY when dropdown is open
  useEffect(() => {
    if (!showDropdown) return;

    function handleClickOutside(event: MouseEvent | TouchEvent | PointerEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showDropdown]);

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
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            {t.home.airportsLabel} ({selectedAirports.length})
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
            {selectedAirports.length === 1 ? '1 selected' : `${selectedAirports.length} selected`}
          </span>
        </label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{t.home.airportsHint}</p>

        <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          {selectedAirports.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">No airports selected</span>
          ) : (
            selectedAirports.map((code) => {
              const details = airportDetails[code];
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-600 text-white shadow-sm"
                >
                  <Plane className="w-3 h-3 text-teal-200" />
                  <span>{code}</span>
                  {details && (
                    <span className="font-normal text-teal-100 text-[11px] max-w-[160px] truncate">
                      · {details.city || details.name}
                    </span>
                  )}
                  {selectedAirports.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAirport(code)}
                      className="ml-0.5 hover:bg-teal-700 p-0.5 rounded-full transition-colors text-teal-200 hover:text-white"
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
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 pl-8 pr-8 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
          {searching && (
            <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
          )}
          {searchQuery && !searching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {searchResults.map((ap) => {
              const isSelected = selectedAirports.includes(ap.code);
              return (
                <button
                  key={ap.code}
                  type="button"
                  onClick={() => handleSelectAirport(ap.code)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 dark:hover:bg-slate-700/70 transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected ? 'bg-teal-50/60 dark:bg-slate-700/50 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/60 px-1.5 py-0.5 rounded text-[11px]">
                      {ap.code}
                    </span>
                    <div className="truncate">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{ap.city}</span>
                      <span className="text-slate-400 dark:text-slate-400 ml-1">({ap.name})</span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1 text-[10px]">· {ap.country}</span>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-semibold flex-shrink-0">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  ) : (
                    <span className="text-teal-600 dark:text-teal-400 text-[11px] font-semibold flex-shrink-0">
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
          className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
          <div className="mt-2 p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Nearby Hubs &amp; Train-Connected Airports
              </span>
              {loadingSuggestions && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">Updating...</span>
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
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span>
                      {airport.code} · {airport.city}
                      {airport.distanceKm !== undefined && (
                        <span className={isSelected ? 'text-teal-100 ml-1' : 'text-slate-400 dark:text-slate-400 ml-1'}>
                          ({Math.round(airport.distanceKm)} km)
                        </span>
                      )}
                    </span>
                    {airport.isHighSpeedRailConnected && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        }`}
                        title={airport.railConnectivityNote || t.home.railConnected}
                      >
                        <Train className="w-3 h-3" />
                        <span>Rail</span>
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
