'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface GeocodedLocation {
  name: string;
  city?: string;
  state?: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  displayName: string;
}

interface LocationInputProps {
  value: string;
  onChange: (value: string, coords?: { lat: number; lon: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function LocationInput({
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: LocationInputProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced geocoding search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.locations || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Error fetching geocoded locations:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (loc: GeocodedLocation) => {
    const cityName = loc.city || loc.name;
    const parts = [cityName];
    if (loc.state && loc.state !== cityName) {
      parts.push(loc.state);
    }
    if (loc.country) {
      parts.push(loc.country);
    }
    const formatted = parts.join(', ');

    setQuery(formatted);
    onChange(formatted, { lat: loc.lat, lon: loc.lon });
    setShowDropdown(false);
  };

  const handleManualChange = (val: string) => {
    setQuery(val);
    onChange(val, undefined);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleManualChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder || t.home.departureLocationPlaceholder}
          className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-8 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        {loading && (
          <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onChange('', undefined);
              setShowDropdown(false);
            }}
            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {results.map((loc, idx) => (
            <button
              key={`${loc.name}-${loc.lat}-${loc.lon}-${idx}`}
              type="button"
              onClick={() => handleSelect(loc)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-800">
                    {loc.city || loc.name}
                  </span>
                  {loc.state && <span className="text-slate-500 ml-1">· {loc.state}</span>}
                  <span className="text-slate-400 ml-1">({loc.country})</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                {loc.countryCode.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
