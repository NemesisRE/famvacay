'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface GeocodedLocation {
  name: string;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
  countryCode: string;
  lat: number;
  lon: number;
  displayName: string;
}

interface LocationInputProps {
  value: string;
  onChange: (value: string, coords?: { lat: number; lon: number }, locationData?: GeocodedLocation) => void;
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
  const [isFocused, setIsFocused] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
      if (value && value.trim().length >= 2) {
        setIsVerified(true);
        setValidationWarning(null);
      }
    }
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
          const list = data.locations || [];
          setResults(list);
          // Only auto-open if user is actively interacting with/focusing the input
          if (list.length > 0 && isFocused) {
            setShowDropdown(true);
          }
        }
      } catch (err) {
        console.error('Error fetching geocoded locations:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isFocused]);

  // Handle outside click to close dropdown ONLY
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateCurrentQuery = async () => {
    const q = query.trim();
    if (!q) {
      setIsVerified(true);
      setValidationWarning(null);
      setHasUserInteracted(false);
      onChange('', undefined);
      return;
    }

    // If query matches a result in the list, auto-verify
    const exact = results.find(
      (r) =>
        r.name.toLowerCase() === q.toLowerCase() ||
        (r.city && r.city.toLowerCase() === q.toLowerCase()) ||
        (r.postcode && r.postcode === q)
    );

    if (exact) {
      handleSelect(exact);
      return;
    }

    // Try verifying against API
    try {
      setLoading(true);
      const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.locations && data.locations.length > 0) {
          handleSelect(data.locations[0]);
          return;
        }
      }
    } catch {
      // Fall through to unverified
    } finally {
      setLoading(false);
      setHasUserInteracted(false);
    }

    setIsVerified(false);
    setValidationWarning(t.home.locationUnverifiedWarning);
    onChange(q, undefined);
  };

  const handleSelect = (loc: GeocodedLocation) => {
    const cityName = loc.city || loc.name;
    const parts: string[] = [];
    if (loc.postcode && !loc.name.includes(loc.postcode)) {
      parts.push(`${loc.postcode} ${cityName}`);
    } else {
      parts.push(cityName);
    }

    if (loc.state && loc.state !== cityName) {
      parts.push(loc.state);
    }
    if (loc.country) {
      parts.push(loc.country);
    }
    const formatted = parts.join(', ');

    setQuery(formatted);
    setIsVerified(true);
    setHasUserInteracted(false);
    setValidationWarning(null);
    onChange(formatted, { lat: loc.lat, lon: loc.lon }, loc);
    setShowDropdown(false);
  };

  const handleManualChange = (val: string) => {
    setQuery(val);
    setHasUserInteracted(true);
    setIsVerified(false);
    setValidationWarning(null);
    onChange(val, undefined);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <div className="h-5 flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 truncate min-w-0">
            <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          {isVerified && query.trim() ? (
            <span
              className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold flex-shrink-0 ml-1.5"
              title={t.home.locationVerified}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="hidden sm:inline truncate max-w-[120px]">{t.home.locationVerified}</span>
            </span>
          ) : null}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleManualChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (results.length > 0) {
              setShowDropdown(true);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            if (hasUserInteracted && !isVerified) {
              validateCurrentQuery();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              validateCurrentQuery();
            }
          }}
          placeholder={placeholder || t.home.departureLocationPlaceholder}
          className={`w-full text-xs rounded-lg border pl-8 pr-8 py-2 bg-white focus:outline-none focus:ring-2 shadow-sm ${
            validationWarning
              ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
              : 'border-slate-300 focus:ring-blue-500'
          }`}
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
              setIsVerified(true);
              setValidationWarning(null);
              onChange('', undefined);
              setShowDropdown(false);
            }}
            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Validation warning */}
      {validationWarning && (
        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5 text-xs text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] leading-tight">{validationWarning}</span>
        </div>
      )}

      {/* Geocoding suggestions dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {results.map((loc, idx) => (
            <button
              key={`${loc.name}-${loc.lat}-${loc.lon}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(loc);
              }}
              onClick={() => handleSelect(loc)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-800">
                    {loc.name}
                  </span>
                  {loc.state && <span className="text-slate-500 ml-1">· {loc.state}</span>}
                  {loc.country && <span className="text-slate-400 ml-1">({loc.country})</span>}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                {loc.countryCode ? loc.countryCode.toUpperCase() : 'DE'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
