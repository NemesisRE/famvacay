'use client';

import React, { useMemo } from 'react';
import { useIsClient } from '@/lib/client-stores';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import {
  COUNTRIES,
  getAllCountries,
  getDeterministicCountryList,
  getLocalizedCountryName,
} from '@/lib/regions/subdivisions';

/**
 * Shared select styling for the search form and the profile, so both pages render the same
 * control (previously each page carried its own slightly different class list).
 */
export const FORM_SELECT_CLASS =
  'w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs';


/**
 * Country list localized to the active UI language. Server render and hydration use the
 * deterministic ISO (English) list so markup never diverges on ICU data; the localized list
 * replaces it on the client.
 */
export function useLocalizedCountries() {
  const { locale } = useI18n();
  const mounted = useIsClient();
  return useMemo(
    () => (mounted ? getAllCountries(locale) : getDeterministicCountryList()),
    [mounted, locale]
  );
}

/**
 * When the country changes, keep the current region if it belongs to the new country,
 * otherwise fall back to its first subdivision (or the country itself if it has none).
 */
export function resolveRegionForCountry(countryCode: string, currentRegion?: string): string {
  const subdivisions = COUNTRIES[countryCode]?.subdivisions || [];
  if (subdivisions.length === 0) return countryCode;
  if (currentRegion && subdivisions.some((s) => s.code === currentRegion)) return currentRegion;
  return subdivisions[0].code;
}

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string) => void;
  label?: React.ReactNode;
  className?: string;
  id?: string;
  compact?: boolean;
}

export function CountrySelect({ value, onChange, label, className = '', id, compact = false }: CountrySelectProps) {
  const countries = useLocalizedCountries();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="h-5 flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <SelectDropdown
        id={id}
        variant={compact ? 'form-sm' : 'form'}
        value={value}
        onChange={onChange}
        options={countries.map((c) => ({ value: c.code, label: c.name }))}
      />
    </div>
  );
}

interface SubdivisionSelectProps {
  countryCode: string;
  value: string;
  onChange: (regionCode: string) => void;
  label?: React.ReactNode;
  className?: string;
  id?: string;
  /** Optional leading option with an empty value (e.g. "Same as home region"). */
  inheritOptionLabel?: string;
  compact?: boolean;
}

export function SubdivisionSelect({
  countryCode,
  value,
  onChange,
  label,
  className = '',
  id,
  inheritOptionLabel,
  compact = false,
}: SubdivisionSelectProps) {
  const { locale } = useI18n();
  const mounted = useIsClient();
  const subdivisions = COUNTRIES[countryCode]?.subdivisions || [];
  const countryName = mounted ? getLocalizedCountryName(countryCode, locale) : (COUNTRIES[countryCode]?.name || countryCode);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="h-5 flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <SelectDropdown
        id={id}
        variant={compact ? 'form-sm' : 'form'}
        value={value}
        onChange={onChange}
        options={[
          ...(inheritOptionLabel !== undefined ? [{ value: '', label: inheritOptionLabel }] : []),
          ...(subdivisions.length > 0
            ? subdivisions.map((sub) => ({ value: sub.code, label: `${sub.name} (${sub.code})` }))
            : [{ value: countryCode, label: countryName }]),
        ]}
      />
    </div>
  );
}

interface SchoolRegionSelectProps {
  homeRegion: string;
  value?: string | null;
  onChange: (regionCode: string | undefined) => void;
  className?: string;
  compact?: boolean;
  label?: React.ReactNode;
}

/**
 * Per-child school region: defaults to the family's home region, but a child can follow a
 * different state's (or country's) school calendar - e.g. siblings at schools on either side
 * of a state border, or a child living with the other parent. Lets the user switch country too.
 */
export function SchoolRegionSelect({ homeRegion, value, onChange, className = '', compact = true, label }: SchoolRegionSelectProps) {
  const { t } = useI18n();
  const homeCountry = (homeRegion || '').split('-')[0] || 'DE';
  const effective = value || '';
  // Derived, not stored: picking a foreign country always sets a region in that country,
  // and picking the home country resets to "same as home", so the value implies the country.
  const country = effective ? effective.split('-')[0] : homeCountry;

  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-1.5 ${className}`}>
      {label && (
        <span className="basis-full sm:basis-auto text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">{label}</span>
      )}
      <CountrySelect
        value={country}
        onChange={(c) => {
          if (c === homeCountry) {
            onChange(undefined);
          } else {
            onChange(resolveRegionForCountry(c));
          }
        }}
        compact
        className="flex-1 sm:flex-none sm:w-[42%] min-w-0"
      />
      <SubdivisionSelect
        countryCode={country}
        value={country === homeCountry ? effective : effective || resolveRegionForCountry(country)}
        onChange={(code) => onChange(code && code !== homeRegion ? code : undefined)}
        inheritOptionLabel={country === homeCountry ? t.home.schoolRegionSameAsHome : undefined}
        compact={compact}
        className="flex-1 min-w-0"
      />
    </div>
  );
}
