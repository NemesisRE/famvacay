'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Check,
  Utensils,
  BookUser,
  Info,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { getCountryCodeFromSubdivision } from '@/lib/regions/subdivisions';
import {
  CountrySelect,
  SubdivisionSelect,
  SchoolRegionSelect,
  resolveRegionForCountry,
} from '@/components/forms/RegionSelectors';
import { BoardTypeSelect, OverlandDurationSelect } from '@/components/forms/PreferenceSelects';
import type { BoardType, CarFuelType, DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import { isAllStylesSelection, toggleStyleSelection, readStoredStyles, getClimateRelevance } from '@/lib/optimizer/style-selection';
import { VacationStyleTiles, TravelModeTiles, ClimatePreferencesPanel } from '@/components/forms/TravelPreferenceTiles';
import { ChildAgeBadges } from '@/components/family/ChildAgeBadges';
import { differenceInYears } from 'date-fns';
import { FORM_SELECT_CLASS } from '@/components/forms/RegionSelectors';
import { AirportSelector } from '@/components/airports/AirportSelector';
import { LocationInput } from '@/components/geo/LocationInput';
import { AccountSettings } from '@/components/account/AccountSettings';
import { DateRangePicker } from '@/components/calendar/DateRangePicker';
import { getAnnualSpecialTimes, SpecialHolidayPeriod } from '@/lib/holidays/special-dates';

interface FamilyMemberForm {
  firstName: string;
  role: 'PARENT' | 'CHILD' | 'INFANT' | 'OTHER';
  birthDate: string;
  schoolRequired: boolean;
  schoolSubdivision?: string;
  passportExpiry: string;
  specialDiet: string;
}

interface BlackoutRangeForm {
  startDate: string;
  endDate: string;
  reason?: string;
  type?: 'STRICT_BLACKOUT' | 'CHILDCARE_CLOSURE';
  coverageFactor?: number;
}

export default function FamilyProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [familyName, setFamilyName] = useState('');
  const [homeLocation, setHomeLocation] = useState('Stuttgart, Germany');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [country, setCountry] = useState('DE');
  const [federalState, setFederalState] = useState('DE-BW');
  const [originAirports, setOriginAirports] = useState<string[]>(['STR', 'FRA', 'BSL']);
  const [preferredCabinClass, setPreferredCabinClass] = useState('ECONOMY');
  const [passportCheckRequired, setPassportCheckRequired] = useState(true);
  const [travelModes, setTravelModes] = useState<string[]>(['PLANE', 'CAR']);
  const [preferredBoardType, setPreferredBoardType] = useState<string>('ALL');
  const [maxOverlandDurationHours, setMaxOverlandDurationHours] = useState<number | undefined>(8);
  const [preferredVacationStyles, setPreferredVacationStyles] = useState<DestinationType[]>(['ALL']);
  const [longRangeStyles, setLongRangeStyles] = useState<DestinationType[]>([]);
  const allStylesSelected = isAllStylesSelection(preferredVacationStyles);
  const climateRelevance = getClimateRelevance(preferredVacationStyles, longRangeStyles);
  const longRangeOnlySelected = climateRelevance.isLongRangeSelected;
  const [minBeachTemp, setMinBeachTemp] = useState<number | undefined>(undefined);
  const [requireSnow, setRequireSnow] = useState<boolean>(false);
  const [maxFlightStops, setMaxFlightStops] = useState<number | undefined>(undefined);
  const [carFuelType, setCarFuelType] = useState<CarFuelType | undefined>(undefined);
  const [scoringWeights, setScoringWeights] = useState<any>({});
  const [blackoutRanges, setBlackoutRanges] = useState<BlackoutRangeForm[]>([]);
  const [airportRoadRouting, setAirportRoadRouting] = useState<Record<string, { drivingMinutes: number; drivingKm: number }>>({});
  const [isAddingBlackout, setIsAddingBlackout] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Same "quick add" common holiday periods as the search form, for the
  // current and next year (profile has no active search date range to
  // scope this to).
  const annualSpecialTimes = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    const result: (SpecialHolidayPeriod & { displayName: string })[] = [];
    for (const yr of years) {
      const list = getAnnualSpecialTimes(yr, locale);
      for (const item of list) {
        if (item.endDate >= todayStr) {
          result.push({ ...item, displayName: `${item.name} '${String(yr).slice(-2)}` });
        }
      }
    }
    return result.slice(0, 8);
  }, [locale, todayStr]);

  const toggleTravelMode = (mode: string) => {
    if (travelModes.includes(mode)) {
      if (travelModes.length > 1) {
        setTravelModes(travelModes.filter((m) => m !== mode));
      } else {
        // Same as the search form: pressing the only selected mode selects every mode
        setTravelModes(['PLANE', 'CAR', 'TRAIN', 'BUS']);
      }
    } else {
      setTravelModes([...travelModes, mode]);
    }
  };

  const [members, setMembers] = useState<FamilyMemberForm[]>([
    {
      firstName: 'Sarah',
      role: 'PARENT',
      birthDate: '1988-04-12',
      schoolRequired: false,
      passportExpiry: '2028-09-10',
      specialDiet: '',
    },
    {
      firstName: 'Michael',
      role: 'PARENT',
      birthDate: '1986-11-23',
      schoolRequired: false,
      passportExpiry: '2027-05-18',
      specialDiet: '',
    },
    {
      firstName: 'Liam',
      role: 'CHILD',
      birthDate: '2018-06-15',
      schoolRequired: true,
      passportExpiry: '2026-12-01',
      specialDiet: 'Nut Allergy',
    },
    {
      firstName: 'Emma',
      role: 'CHILD',
      birthDate: '2021-09-04',
      schoolRequired: false,
      passportExpiry: '2029-03-22',
      specialDiet: '',
    },
  ]);

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
            setOriginAirports(p.originAirports || ['STR', 'FRA']);
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
              setPreferredVacationStyles(readStoredStyles(sw));
              if (Array.isArray(sw.longRangeStyles)) {
                setLongRangeStyles(sw.longRangeStyles);
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
                  specialDiet: m.specialDiet || '',
                }))
              );
            }
          }
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

  const toggleSpecialPeriod = (period: SpecialHolidayPeriod) => {
    const existingIdx = blackoutRanges.findIndex(
      (b) => b.startDate === period.startDate && b.endDate === period.endDate
    );
    if (existingIdx >= 0) {
      const next = blackoutRanges.filter((_, i) => i !== existingIdx);
      setBlackoutRanges(next);
      if (next.length === 0) {
        setIsAddingBlackout(false);
      }
    } else {
      setIsAddingBlackout(true);
      setBlackoutRanges((prev) => [
        ...prev,
        { startDate: period.startDate, endDate: period.endDate, reason: period.name },
      ]);
    }
  };

  const toggleAirport = (code: string) => {
    if (originAirports.includes(code)) {
      if (originAirports.length > 1) {
        setOriginAirports(originAirports.filter((a) => a !== code));
      }
    } else {
      setOriginAirports([...originAirports, code]);
    }
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
        specialDiet: '',
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
        longRangeStyles: longRangeOnlySelected ? longRangeStyles : [],
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
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
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
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="h-5 flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.profile.familyName}
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="The Miller Family"
                  className={FORM_SELECT_CLASS}
                />
              </div>

              <div>
                <LocationInput
                  label={t.home.departureLocationLabel}
                  value={homeLocation}
                  onChange={(loc, coords) => {
                    setHomeLocation(loc);
                    if (coords) setDepartureCoords(coords);
                  }}
                  placeholder={t.home.departureLocationPlaceholder}
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
              <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <span>{t.home.holidayScopeNotice}</span>
            </p>
          </div>

          {/* Section 2: Vacation & travel preferences - same order and controls as the search form */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              {t.profile.sec2Title}
            </h2>

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
                longRangeStyles={longRangeStyles}
                onLongRangeStylesChange={setLongRangeStyles}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
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
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.filterByOverlandDuration}</span>
                </label>
                <OverlandDurationSelect value={maxOverlandDurationHours} onChange={setMaxOverlandDurationHours} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.profile.cabinClass}
                </label>
                <select
                  value={preferredCabinClass}
                  onChange={(e) => setPreferredCabinClass(e.target.value)}
                  className={FORM_SELECT_CLASS}
                >
                  <option value="ECONOMY">{t.profile.economy}</option>
                  <option value="PREMIUM_ECONOMY">{t.profile.premiumEconomy}</option>
                  <option value="BUSINESS">{t.profile.business}</option>
                </select>
              </div>
            </div>

            {/* Departure airports, after the comfort settings - same position as on the search form */}
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
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                {t.profile.sec3Title}
              </h2>
              <button
                type="button"
                onClick={addMember}
                className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.profile.addMember}
              </button>
            </div>

            {/* Passport validity check belongs with the travelers' passport expiry dates */}
            <div className="max-w-md">
              <label htmlFor="passportCheck" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <BookUser className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {t.profile.passportCheckLabel}
              </label>
              <select
                id="passportCheck"
                value={passportCheckRequired ? 'CHECK' : 'OFF'}
                onChange={(e) => setPassportCheckRequired(e.target.value === 'CHECK')}
                className={FORM_SELECT_CLASS}
              >
                <option value="CHECK">{t.profile.passportCheckOn}</option>
                <option value="OFF">{t.profile.passportCheckOff}</option>
              </select>
            </div>

            <div className="space-y-3">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.name}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Liam"
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.role}
                    </label>
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="PARENT">{t.profile.parent}</option>
                      <option value="CHILD">{t.profile.child}</option>
                      <option value="INFANT">{t.profile.infant}</option>
                      <option value="OTHER">{t.profile.other}</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.birthDate}
                    </label>
                    <input
                      type="date"
                      required
                      value={member.birthDate}
                      onChange={(e) => updateMember(index, 'birthDate', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      {t.profile.passportExpiry}
                    </label>
                    <input
                      type="date"
                      value={member.passportExpiry}
                      onChange={(e) => updateMember(index, 'passportExpiry', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {(member.role === 'CHILD' || member.role === 'INFANT') && member.birthDate && (
                    <div className="sm:col-span-12 flex flex-wrap items-center gap-1.5">
                      <ChildAgeBadges age={Math.max(0, differenceInYears(new Date(), new Date(member.birthDate)))} />
                    </div>
                  )}

                  {(member.role === 'CHILD' || member.role === 'INFANT') && (
                    <div className="sm:col-span-12">
                      <SchoolRegionSelect
                        homeRegion={federalState}
                        value={member.schoolSubdivision}
                        onChange={(region) => updateMember(index, 'schoolSubdivision', region)}
                        label={t.home.schoolRegionLabel}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Persistent blackout dates - same amber card & picker rows as the search form */}
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Ban className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t.profile.blackoutDatesTitle}
              {blackoutRanges.length > 0 && (
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-700/60">
                  {blackoutRanges.length}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.profile.blackoutDatesDesc}</p>

            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200/90 dark:border-amber-800/60 space-y-3">
              {blackoutRanges.length === 0 && !isAddingBlackout ? (
                <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 text-center">
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{t.profile.noBlackouts}</p>
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
                  {/* Quick Add Special Moving Periods (Ostern, Pfingsten, Himmelfahrt, Fronleichnam, Silvester) */}
                  {annualSpecialTimes.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900/75 dark:text-amber-300/75">
                        {t.home.quickSpecialTimes}:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {annualSpecialTimes.map((period) => {
                          const isSelected = blackoutRanges.some(
                            (b) => b.startDate === period.startDate && b.endDate === period.endDate
                          );
                          return (
                            <button
                              key={`${period.id}-${period.startDate}`}
                              type="button"
                              onClick={() => toggleSpecialPeriod(period)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                  : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs'
                              }`}
                              title={`${period.name} (${period.startDate} - ${period.endDate}): ${period.description}`}
                            >
                              <span>{period.icon}</span>
                              <span>{period.displayName}</span>
                              {isSelected ? (
                                <Check className="w-3 h-3 ml-0.5" />
                              ) : (
                                <Plus className="w-3 h-3 ml-0.5 text-amber-600 dark:text-amber-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {blackoutRanges.map((range, index) => (
                      <div
                        key={index}
                        className="px-2.5 py-1.5 bg-white/95 dark:bg-slate-800/80 rounded-lg border border-amber-200/90 dark:border-amber-800/60 flex items-center gap-1.5 text-xs transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-amber-300 dark:hover:border-amber-700 shadow-xs"
                      >
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700/60 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
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
                          className="flex-1 min-w-0 text-xs rounded border border-slate-300 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => toggleBlackoutType(index)}
                          title={t.profile.childcareClosureToggleHint}
                          className={`flex-shrink-0 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
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
                            className="w-14 flex-shrink-0 text-xs rounded border border-sky-300 dark:border-sky-700 px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeBlackout(index)}
                          className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer flex-shrink-0"
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
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t.profile.saving}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t.profile.saveProfile}
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
