'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X, CheckCircle2, AlertCircle, LocateFixed } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import {
  detectUserLocation,
  formatLocationLabel,
  type BrowserLocationError,
  type GeocodedLocation,
} from '@/lib/geo/location-helpers';

// Same shape as the geocoding API (stateCode / stateName / countryCode)
export type { GeocodedLocation };

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
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(value);
  const [locating, setLocating] = useState(false);
  const [rawResults, setResults] = useState<GeocodedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const results = query.trim().length >= 2 ? rawResults : [];

  // Outside value changes (profile prefill, detected location, reset): adopted while rendering
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value);
    if (value && value.trim().length >= 2) {
      setIsVerified(true);
      setValidationWarning(null);
    }
  }

  // Debounced geocoding search (results of a too-short query are simply not shown, see below)
  useEffect(() => {
    if (query.trim().length < 2) return;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(query.trim())}&locale=${locale}`);
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
  }, [query, isFocused, locale]);

  // Handle outside click or tap to close dropdown ONLY when dropdown is open
  useEffect(() => {
    if (!showDropdown) return;

    function handleClickOutside(event: MouseEvent | TouchEvent | PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showDropdown]);

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
      const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(q)}&locale=${locale}`);
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
    const formatted = formatLocationLabel(loc, locale);

    setQuery(formatted);
    setIsVerified(true);
    setHasUserInteracted(false);
    setValidationWarning(null);
    onChange(formatted, { lat: loc.lat, lon: loc.lon }, loc);
    setShowDropdown(false);
  };

  // Browser location -> town (asks for permission; only possible over https / localhost)
  const handleUseMyLocation = async () => {
    setLocating(true);
    setValidationWarning(null);
    try {
      handleSelect(await detectUserLocation(locale));
    } catch (err) {
      const code = (typeof err === 'string' ? err : 'unavailable') as BrowserLocationError;
      setValidationWarning(
        code === 'denied'
          ? t.home.locationErrorDenied
          : code === 'insecure'
          ? t.home.locationErrorInsecure
          : t.home.locationErrorUnavailable
      );
    } finally {
      setLocating(false);
    }
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
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate min-w-0">
            <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0 ml-1.5">
            {isVerified && query.trim() ? (
              <span title={t.home.locationVerified} aria-label={t.home.locationVerified}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 flex items-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {locating ? (
                <span className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              <span>{locating ? t.home.locating : t.home.useMyLocation}</span>
            </button>
          </span>
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
          className={`w-full text-xs font-medium rounded-lg border pl-3 pr-8 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:font-normal focus:outline-hidden focus:ring-2 shadow-2xs ${
            validationWarning
              ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20 dark:bg-amber-950/20'
              : 'border-slate-300 dark:border-slate-700 focus:ring-teal-500'
          }`}
        />
        {loading && (
          <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
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
            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Validation warning */}
      {validationWarning && (
        <div className="mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[11px] leading-tight">{validationWarning}</span>
        </div>
      )}

      {/* Geocoding suggestions dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
          {results.map((loc, idx) => (
            <button
              key={`${loc.name}-${loc.lat}-${loc.lon}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(loc);
              }}
              onClick={() => handleSelect(loc)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 dark:hover:bg-slate-700/70 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {loc.name}
                  </span>
                  {loc.stateName && <span className="text-slate-500 dark:text-slate-400 ml-1">· {loc.stateName}</span>}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded shrink-0 ml-2">
                {(loc.countryCode || '').toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
