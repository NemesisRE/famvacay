'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Compass,
  Ban,
  Shield,
  Car,
  Utensils,
  BookUser,
  Info,
  Globe,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { getCountryCodeFromSubdivision } from '@/lib/regions/subdivisions';
import {
  CountrySelect,
  SubdivisionSelect,
  SchoolRegionSelect,
  resolveRegionForCountry,
} from '@/components/forms/RegionSelectors';
import { BoardTypeSelect } from '@/components/forms/PreferenceSelects';
import type { BoardType, CarFuelType, DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import { isAllStylesSelection, toggleStyleSelection, toggleTravelModeSelection, toggleTravelDistance, readStoredStyleSelection, getClimateRelevance, ALL_TRAVEL_DISTANCES, type TravelDistance } from '@/lib/optimizer/style-selection';
import { VacationStyleTiles, TravelDistanceTiles, TravelModeTiles, ClimatePreferencesPanel } from '@/components/forms/TravelPreferenceTiles';
import { ChildAgeBadges } from '@/components/family/ChildAgeBadges';
import { differenceInYears } from 'date-fns';
import { FORM_SELECT_CLASS } from '@/components/forms/RegionSelectors';
import { AirportSelector } from '@/components/airports/AirportSelector';
import { LocationInput } from '@/components/geo/LocationInput';
import { AccountSettings } from '@/components/account/AccountSettings';
import { DateRangePicker } from '@/components/calendar/DateRangePicker';
import type { SpecialHolidayId } from '@/lib/holidays/special-dates';
import { HolidayBlackoutToggles } from '@/components/forms/HolidayBlackoutToggles';
import { resolveCountryAndRegion } from '@/lib/geo/location-helpers';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { CountryExclusionPicker } from '@/components/destination/CountryExclusionPicker';
import { DatePicker } from '@/components/calendar/DatePicker';
import { WorkdaysSelector } from '@/components/forms/WorkdaysSelector';
import { normalizeWorkweek } from '@/lib/holidays/workweek';

interface FamilyMemberForm {
  firstName: string;
  role: 'PARENT' | 'CHILD' | 'INFANT' | 'OTHER';
  birthDate: string;
  schoolRequired: boolean;
  schoolSubdivision?: string;
  passportExpiry: string;
}

interface BlackoutRangeForm {
  startDate: string;
  endDate: string;
  reason?: string;
  type?: 'STRICT_BLACKOUT' | 'CHILDCARE_CLOSURE';
  coverageFactor?: number;
}

function FamilyProfileContent() {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // A confirmation link lands here with ?email=<outcome>: the account settings show it
  const emailLinkStatus = useSearchParams().get('email');
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>(emailLinkStatus ? 'account' : 'profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [familyName, setFamilyName] = useState('');
  // New profiles start like the search form: the browser's location, flexible airports, every
  // vehicle, two adults and no children
  const [homeLocation, setHomeLocation] = useState('');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [country, setCountry] = useState('DE');
  // Own workdays (ISO weekdays), null = the usual week of the home country
  const [workweekDays, setWorkweekDays] = useState<number[] | null>(null);
  const [federalState, setFederalState] = useState('DE-BW');
  const [originAirports, setOriginAirports] = useState<string[]>([]);
  const [preferredCabinClass, setPreferredCabinClass] = useState('ECONOMY');
  const [passportCheckRequired, setPassportCheckRequired] = useState(true);
  const [travelModes, setTravelModes] = useState<string[]>(['PLANE', 'CAR', 'TRAIN', 'BUS']);
  const [preferredBoardType, setPreferredBoardType] = useState<string>('ALL');
  const [maxOverlandDurationHours, setMaxOverlandDurationHours] = useState<number | undefined>(undefined);
  const [preferredVacationStyles, setPreferredVacationStyles] = useState<DestinationType[]>(['ALL']);
  const [travelDistances, setTravelDistances] = useState<TravelDistance[]>([...ALL_TRAVEL_DISTANCES]);
  const [excludedCountries, setExcludedCountries] = useState<string[]>([]);
  const allStylesSelected = isAllStylesSelection(preferredVacationStyles);
  const climateRelevance = getClimateRelevance(preferredVacationStyles);
  // Flight-only parts (distance, departure airports) only show while the plane is selected
  const usesPlane = travelModes.includes('PLANE');
  const [minBeachTemp, setMinBeachTemp] = useState<number | undefined>(undefined);
  const [requireSnow, setRequireSnow] = useState<boolean>(false);
  const [maxFlightStops, setMaxFlightStops] = useState<number | undefined>(undefined);
  const [carFuelType, setCarFuelType] = useState<CarFuelType | undefined>(undefined);
  const [scoringWeights, setScoringWeights] = useState<any>({});
  const [blackoutRanges, setBlackoutRanges] = useState<BlackoutRangeForm[]>([]);
  const [airportRoadRouting, setAirportRoadRouting] = useState<Record<string, { drivingMinutes: number; drivingKm: number }>>({});
  const [isAddingBlackout, setIsAddingBlackout] = useState(false);
  // Year-independent holiday blackouts, resolved for each search's travel period
  const [recurringBlackouts, setRecurringBlackouts] = useState<SpecialHolidayId[]>([]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Same selection behaviour as the vacation styles and the search form
  const toggleTravelMode = (mode: string) => setTravelModes((prev) => toggleTravelModeSelection(prev, mode));

  const [members, setMembers] = useState<FamilyMemberForm[]>([
    { firstName: '', role: 'PARENT', birthDate: '', schoolRequired: false, passportExpiry: '' },
    { firstName: '', role: 'PARENT', birthDate: '', schoolRequired: false, passportExpiry: '' },
  ]);

  const applyLocation = (
    loc: string,
    coords?: { lat: number; lon: number },
    data?: Parameters<typeof resolveCountryAndRegion>[0]
  ) => {
    setHomeLocation(loc);
    if (coords) setDepartureCoords(coords);
    const resolved = data ? resolveCountryAndRegion(data) : null;
    if (resolved) {
      setCountry(resolved.country);
      setFederalState(resolved.region);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/family-profile')
        .then((res) => res.json())
        .then((data) => {
          if (data?.profile) {
            const p = data.profile;
            setFamilyName(p.familyName || '');
            if (p.homeLocation) {
              setHomeLocation(p.homeLocation);
              fetch(`/api/locations/geocode?q=${encodeURIComponent(p.homeLocation)}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.locations?.[0]) {
                    setDepartureCoords({ lat: d.locations[0].lat, lon: d.locations[0].lon });
                  }
                })
                .catch(() => {});
            }
            if (p.federalState) {
              setFederalState(p.federalState);
              setCountry(getCountryCodeFromSubdivision(p.federalState));
            }
            setOriginAirports(p.originAirports || []);
            if (Array.isArray(p.preferredAirports)) {
              const routing: Record<string, { drivingMinutes: number; drivingKm: number }> = {};
              for (const link of p.preferredAirports) {
                if (typeof link.drivingMinutes === 'number' && typeof link.drivingKm === 'number') {
                  routing[link.airportIata] = { drivingMinutes: link.drivingMinutes, drivingKm: link.drivingKm };
                }
              }
              setAirportRoadRouting(routing);
            }
            setPreferredCabinClass(p.preferredCabinClass || 'ECONOMY');
            setWorkweekDays(normalizeWorkweek(p.workweekDays));
            setPassportCheckRequired(p.passportCheckRequired ?? true);
            if (Array.isArray(p.travelModes) && p.travelModes.length > 0) {
              setTravelModes(p.travelModes);
            }
            if (p.maxTravelHours !== null && p.maxTravelHours !== undefined) {
              setMaxOverlandDurationHours(Number(p.maxTravelHours));
            }
            if (p.scoringWeights) {
              const sw = typeof p.scoringWeights === 'string' ? JSON.parse(p.scoringWeights) : p.scoringWeights;
              setScoringWeights(sw);
              if (sw.preferredBoardType) {
                setPreferredBoardType(sw.preferredBoardType);
              }
              const styleSelection = readStoredStyleSelection(sw);
              setPreferredVacationStyles(styleSelection.styles);
              setTravelDistances(styleSelection.distances);
              if (Array.isArray(sw.excludedCountries)) {
                setExcludedCountries(sw.excludedCountries);
              }
              if (Array.isArray(sw.recurringBlackouts)) {
                setRecurringBlackouts(sw.recurringBlackouts);
              }
              if ((p.maxTravelHours === null || p.maxTravelHours === undefined) && sw.maxOverlandTravelMinutes) {
                setMaxOverlandDurationHours(Math.round(sw.maxOverlandTravelMinutes / 60));
              }
              if (typeof sw.minBeachTemp === 'number') {
                setMinBeachTemp(sw.minBeachTemp);
              }
              if (typeof sw.requireSnow === 'boolean') {
                setRequireSnow(sw.requireSnow);
              }
              if (typeof sw.maxFlightStops === 'number') {
                setMaxFlightStops(sw.maxFlightStops);
              }
              if (['PETROL', 'DIESEL', 'ELECTRIC'].includes(sw.carFuelType)) {
                setCarFuelType(sw.carFuelType);
              }
            }

            if (Array.isArray(p.blackoutRanges)) {
              setBlackoutRanges(
                p.blackoutRanges.map((b: any) => ({
                  startDate: b.startDate ? b.startDate.split('T')[0] : '',
                  endDate: b.endDate ? b.endDate.split('T')[0] : '',
                  reason: b.reason || '',
                  type: b.type === 'CHILDCARE_CLOSURE' ? 'CHILDCARE_CLOSURE' : 'STRICT_BLACKOUT',
                  coverageFactor: typeof b.coverageFactor === 'number' ? b.coverageFactor : 1.0,
                }))
              );
            }

            if (p.members && p.members.length > 0) {
              setMembers(
                p.members.map((m: any) => ({
                  firstName: m.firstName || '',
                  role: m.role || 'PARENT',
                  birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
                  schoolRequired: Boolean(m.schoolRequired),
                  schoolSubdivision: m.schoolSubdivision || undefined,
                  passportExpiry: m.passportExpiry ? m.passportExpiry.split('T')[0] : '',
                }))
              );
            }
          }
          // No profile yet: the home location stays empty until the user types it or presses
          // "My location" - never a location permission prompt just for opening the page
        })
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  // Same behavior as the search form: keep the region when it still belongs to the new
  // country, otherwise pick its first subdivision (or the country itself when it has none).
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setFederalState(resolveRegionForCountry(newCountry, federalState));
  };

  const addBlackout = () => {
    setIsAddingBlackout(true);
    setBlackoutRanges([
      ...blackoutRanges,
      { startDate: '', endDate: '', reason: '' },
    ]);
  };

  const finishBlackoutEditing = () => {
    setIsAddingBlackout(false);
    setBlackoutRanges((prev) => prev.filter((b) => b.startDate && b.endDate));
  };

  const removeBlackout = (index: number) => {
    const next = blackoutRanges.filter((_, i) => i !== index);
    setBlackoutRanges(next);
    if (next.length === 0) {
      setIsAddingBlackout(false);
    }
  };

  const updateBlackout = (index: number, field: keyof BlackoutRangeForm, value: string) => {
    const updated = [...blackoutRanges];
    updated[index] = { ...updated[index], [field]: value };
    setBlackoutRanges(updated);
  };

  const updateBlackoutRange = (index: number, start: string, end: string) => {
    const updated = [...blackoutRanges];
    updated[index] = { ...updated[index], startDate: start, endDate: end };
    setBlackoutRanges(updated);
  };

  const toggleBlackoutType = (index: number) => {
    const updated = [...blackoutRanges];
    const current = updated[index];
    updated[index] = {
      ...current,
      type: current.type === 'CHILDCARE_CLOSURE' ? 'STRICT_BLACKOUT' : 'CHILDCARE_CLOSURE',
      coverageFactor: current.coverageFactor ?? 1.0,
    };
    setBlackoutRanges(updated);
  };

  const updateBlackoutCoverage = (index: number, value: number) => {
    const updated = [...blackoutRanges];
    updated[index] = { ...updated[index], coverageFactor: Math.min(1, Math.max(0, value)) };
    setBlackoutRanges(updated);
  };

  const addMember = () => {
    setMembers([
      ...members,
      {
        firstName: '',
        role: 'CHILD',
        birthDate: '2020-01-01',
        schoolRequired: false,
        passportExpiry: '',
      },
    ]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof FamilyMemberForm, value: any) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updatedScoringWeights = {
        ...scoringWeights,
        preferredBoardType,
        preferredVacationStyles,
        // Legacy single value kept for older clients reading the profile
        preferredVacationStyle: allStylesSelected ? 'ALL' : preferredVacationStyles[0],
        travelDistances,
        // Replaced by travelDistances; cleared so the old long-haul kinds are not read back
        longRangeStyles: undefined,
        excludedCountries,
        recurringBlackouts,
        maxOverlandTravelMinutes: maxOverlandDurationHours ? maxOverlandDurationHours * 60 : undefined,
        minBeachTemp,
        requireSnow,
        maxFlightStops,
        carFuelType,
      };

      const res = await fetch('/api/family-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName,
          homeLocation,
          federalState,
          // Empty: the usual week of the home country, which follows a change of country
          workweekDays: workweekDays ?? [],
          originAirports,
          maxTravelHours: maxOverlandDurationHours,
          preferredCabinClass,
          passportCheckRequired,
          travelModes,
          scoringWeights: updatedScoringWeights,
          members,
          blackoutRanges: blackoutRanges.filter((b) => b.startDate && b.endDate),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update family profile.');
      }

      setMessage({ type: 'success', text: t.profile.successSaved });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <span className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin inline-block"></span>
        <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              {t.profile.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.profile.subtitle}</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800 self-start sm:self-auto">
            {members.length} {t.profile.membersBadge}
          </span>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 mt-6 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            {t.profile.profileTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'account'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            {t.profile.accountTab}
          </button>
        </div>

        {activeTab === 'account' ? (
          <div className="mt-6">
            <AccountSettings />
          </div>
        ) : (
          <>
            {message && (
              <div
                className={`my-4 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 mt-6">
          {/* Section 1: Home & school holiday region (same fields & wording as the search form) */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              {t.profile.sec1Title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="h-5 flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.profile.familyName}
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder={t.profile.familyNamePlaceholder}
                  className={FORM_SELECT_CLASS}
                />
              </div>

              <div>
                <LocationInput
                  label={t.home.departureLocationLabel}
                  value={homeLocation}
                  onChange={(loc, coords, data) => {
                    applyLocation(loc, coords, data);
                  }}
                  placeholder={t.home.departureLocationPlaceholder}
                  countryHint={country}
                />
              </div>

              <CountrySelect
                id="profile-country"
                label={t.home.countryLabel}
                value={country}
                onChange={handleCountryChange}
              />

              <SubdivisionSelect
                id="profile-region"
                label={t.home.homeStateLabel}
                countryCode={country}
                value={federalState}
                onChange={setFederalState}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{t.home.holidayScopeNotice}</span>
            </p>
            <WorkdaysSelector value={workweekDays} country={country} onChange={setWorkweekDays} idPrefix="profile-workdays" />
          </div>

          {/* Section 2: Vacation & travel preferences - same order and controls as the search form */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              {t.profile.sec2Title}
            </h2>

            <div>
              <div className="mb-2 space-y-0.5">
                <label htmlFor="profile-excluded-countries" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.excludeCountriesLabel}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t.home.excludeCountriesHint}</p>
              </div>
              <CountryExclusionPicker
                id="profile-excluded-countries"
                value={excludedCountries}
                onChange={setExcludedCountries}
              />
            </div>

            <div>
              <div className="mb-2.5 space-y-0.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.vacationKindLabel}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t.home.vacationKindHint}</p>
              </div>
              <VacationStyleTiles
                selectedStyles={preferredVacationStyles}
                onToggle={(style) => setPreferredVacationStyles((prev) => toggleStyleSelection(prev, style))}
                className="grid grid-cols-2 md:grid-cols-4 gap-2.5"
              />
              <ClimatePreferencesPanel
                idPrefix="profile-climate"
                showBeach={climateRelevance.beach}
                showAlpine={climateRelevance.alpine}
                minBeachTemp={minBeachTemp}
                onMinBeachTempChange={setMinBeachTemp}
                requireSnow={requireSnow}
                onRequireSnowChange={setRequireSnow}
              />

              {/* Long haul needs a flight: without the plane the distance is no choice */}
              {usesPlane && (
                <>
                  <div className="mt-4 mb-2.5 space-y-0.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{t.home.travelDistanceLabel}</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t.home.travelDistanceHint}</p>
                  </div>
                  <TravelDistanceTiles
                    selectedDistances={travelDistances}
                    onToggle={(distance) => setTravelDistances((prev) => toggleTravelDistance(prev, distance))}
                  />
                </>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="mb-2.5 space-y-0.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.travelVehicleLabel}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t.home.travelVehicleHint}</p>
              </div>
              <TravelModeTiles
                selectedVehicles={travelModes as TravelVehicle[]}
                onToggle={toggleTravelMode}
                maxFlightStops={maxFlightStops}
                onMaxFlightStopsChange={setMaxFlightStops}
                carFuelType={carFuelType}
                onCarFuelTypeChange={setCarFuelType}
                cabinClass={preferredCabinClass}
                onCabinClassChange={setPreferredCabinClass}
                maxOverlandHours={maxOverlandDurationHours}
                onMaxOverlandHoursChange={setMaxOverlandDurationHours}
                className="grid grid-cols-2 md:grid-cols-4 gap-2.5"
              />
            </div>

            {/* Board (the settings of the travel modes sit with the modes above) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 @container">
              <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t.home.filterByBoardType}</span>
                  </label>
                  <BoardTypeSelect
                    value={preferredBoardType === 'ALL' ? undefined : (preferredBoardType as BoardType)}
                    onChange={(value) => setPreferredBoardType(value || 'ALL')}
                  />
                </div>
              </div>
            </div>

            {/* Departure airports, after the comfort settings - same position as on the search form */}
            {usesPlane && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <AirportSelector
                  selectedAirports={originAirports}
                  onChange={setOriginAirports}
                  coordinates={departureCoords}
                />
                {originAirports.some((code) => airportRoadRouting[code]) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {originAirports
                      .filter((code) => airportRoadRouting[code])
                      .map((code) => (
                        <span
                          key={code}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          title={t.profile.drivingTimeHint}
                        >
                          {code}: ~{airportRoadRouting[code].drivingMinutes} min ({airportRoadRouting[code].drivingKm} km)
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                {t.profile.sec3Title}
              </h2>
            </div>

            {/* Passport validity check belongs with the travelers' passport expiry dates */}
            <div className="max-w-md">
              <label htmlFor="passportCheck" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <BookUser className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {t.profile.passportCheckLabel}
              </label>
              <SelectDropdown
                id="passportCheck"
                variant="form"
                value={passportCheckRequired ? 'CHECK' : 'OFF'}
                onChange={(v) => setPassportCheckRequired(v === 'CHECK')}
                options={[
                  { value: 'CHECK', label: t.profile.passportCheckOn },
                  { value: 'OFF', label: t.profile.passportCheckOff },
                ]}
              />
            </div>

            <div className="space-y-3">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-12 gap-3 items-start"
                >
                  <div className="order-1 lg:order-0 lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.name}
                    </label>
                    <input
                      type="text"
                      placeholder={t.profile.memberNamePlaceholder}
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="order-3 col-span-2 lg:order-0 lg:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.role}
                    </label>
                    <SelectDropdown
                      variant="form"
                      value={member.role}
                      onChange={(v) => updateMember(index, 'role', v)}
                      options={[
                        { value: 'PARENT', label: t.profile.parent },
                        { value: 'CHILD', label: t.profile.child },
                        { value: 'INFANT', label: t.profile.infant },
                        { value: 'OTHER', label: t.profile.other },
                      ]}
                    />
                  </div>

                  <div className="order-3 col-span-2 lg:order-0 lg:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.birthDate}
                    </label>
                    <DatePicker
                      value={member.birthDate}
                      onChange={(value) => updateMember(index, 'birthDate', value)}
                      max={todayStr}
                      yearDropdown
                      clearable={member.role !== 'CHILD' && member.role !== 'INFANT'}
                    />
                  </div>

                  <div className="order-3 col-span-2 lg:order-0 lg:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.passportExpiry}
                    </label>
                    <DatePicker
                      value={member.passportExpiry}
                      onChange={(value) => updateMember(index, 'passportExpiry', value)}
                      yearDropdown
                      clearable
                    />
                  </div>

                  {/* Phones: next to the name field (it used to get a row of its own) */}
                  <div className="order-1 self-end lg:self-auto lg:order-0 lg:col-span-1 flex justify-end lg:mt-[15px]">
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title={t.profile.removeMember}
                      aria-label={t.profile.removeMember}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Own full-width row so a wrapped hint never inflates the row above and
                      leaves dead space under role/birth date/passport expiry. On phones it must
                      span both columns: in the narrow delete-button column it squeezed the name field. */}
                  {(member.role === 'CHILD' || member.role === 'INFANT') && (
                    <div className="order-2 col-span-2 lg:order-0 lg:col-span-12 -mt-2">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.profile.childNameHint}</p>
                    </div>
                  )}

                  {(member.role === 'CHILD' || member.role === 'INFANT') && member.birthDate && (
                    <div className="order-3 col-span-2 lg:order-0 lg:col-span-12 flex flex-wrap items-center gap-1.5">
                      <ChildAgeBadges age={Math.max(0, differenceInYears(new Date(), new Date(member.birthDate)))} />
                    </div>
                  )}

                  {(member.role === 'CHILD' || member.role === 'INFANT') && (
                    <div className="order-3 col-span-2 lg:order-0 lg:col-span-12">
                      <SchoolRegionSelect
                        homeRegion={federalState}
                        value={member.schoolSubdivision}
                        onChange={(region) => updateMember(index, 'schoolSubdivision', region)}
                        label={t.home.schoolRegionLabel}
                        compact={false}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Same full-width dashed button as "add child" on the search form */}
              <button
                type="button"
                onClick={addMember}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/70 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.profile.addMember}
              </button>
            </div>
          </div>

          {/* Section 4: Persistent blackout dates - same amber card & picker rows as the search form */}
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Ban className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t.profile.blackoutDatesTitle}
              {blackoutRanges.length + recurringBlackouts.length > 0 && (
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-700/60">
                  {blackoutRanges.length + recurringBlackouts.length}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.profile.blackoutDatesDesc}</p>

            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200/90 dark:border-amber-800/60 space-y-3">
              <HolidayBlackoutToggles selected={recurringBlackouts} onChange={setRecurringBlackouts} expanded={isAddingBlackout} />
              {blackoutRanges.length === 0 && !isAddingBlackout ? (
                <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 text-center">
                  {recurringBlackouts.length === 0 && (
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{t.profile.noBlackouts}</p>
                  )}
                  <button
                    type="button"
                    onClick={addBlackout}
                    className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    + {t.profile.addBlackout}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    {blackoutRanges.map((range, index) => (
                      <div
                        key={index}
                        className="px-2.5 py-1.5 bg-white/95 dark:bg-slate-800/80 rounded-lg border border-amber-200/90 dark:border-amber-800/60 flex items-center gap-1.5 text-xs transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs"
                      >
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700/60 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <DateRangePicker
                          startDate={range.startDate}
                          endDate={range.endDate}
                          onChange={(start, end) => updateBlackoutRange(index, start, end)}
                          minDate={todayStr}
                          className="w-[108px] shrink-0"
                        />
                        <input
                          type="text"
                          placeholder={t.home.blackoutReasonPlaceholder}
                          value={range.reason || ''}
                          onChange={(e) => updateBlackout(index, 'reason', e.target.value)}
                          className="flex-1 min-w-0 text-xs rounded border border-slate-300 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => toggleBlackoutType(index)}
                          title={t.profile.childcareClosureToggleHint}
                          className={`shrink-0 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                            range.type === 'CHILDCARE_CLOSURE'
                              ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {range.type === 'CHILDCARE_CLOSURE' ? t.profile.childcareClosureLabel : t.profile.strictBlackoutLabel}
                        </button>
                        {range.type === 'CHILDCARE_CLOSURE' && (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={Math.round((range.coverageFactor ?? 1.0) * 100)}
                            onChange={(e) => updateBlackoutCoverage(index, Number(e.target.value) / 100)}
                            title={t.profile.childcareCoverageHint}
                            className="w-14 shrink-0 text-xs rounded border border-sky-300 dark:border-sky-700 px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-sky-500"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeBlackout(index)}
                          className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer shrink-0"
                          title={t.profile.removeBlackout}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addBlackout}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t.profile.addBlackout}
                    </button>
                    {isAddingBlackout && (
                      <button
                        type="button"
                        onClick={finishBlackoutEditing}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {t.common.done}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>{t.profile.saving}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.profile.saveProfile}</span>
                </>
              )}
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary on a prerendered page
export default function FamilyProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <span className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FamilyProfileContent />
    </Suspense>
  );
}
