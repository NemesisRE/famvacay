'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  Plane,
  Sun,
  Award,
  AlertCircle,
  Sparkles,
  Filter,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Users,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { differenceInYears, addDays } from 'date-fns';
import { CandidateWindow } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';
import { COUNTRIES, getCountryCodeFromSubdivision } from '@/lib/regions/subdivisions';
import { AirportSelector } from '@/components/airports/AirportSelector';
import { LocationInput } from '@/components/geo/LocationInput';
import { ChildrenSelector, ChildItem } from '@/components/family/ChildrenSelector';
import { MultiDestinationInput } from '@/components/destination/MultiDestinationInput';
import { ClimateDetailsPopover } from '@/components/climate/ClimateDetailsPopover';
import { BookingDealsPopover } from '@/components/pricing/BookingDealsPopover';
import { getLocalizedSeasonalWarning } from '@/lib/optimizer/localized-warnings';

export default function HomePage() {
  const { data: session } = useSession();
  const { t, formatDate, formatCurrency } = useI18n();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultEarliest = useMemo(
    () => addDays(new Date(), 14).toISOString().split('T')[0],
    []
  );
  const defaultLatest = useMemo(
    () => addDays(new Date(), 90).toISOString().split('T')[0],
    []
  );

  // 1. Departure & School District State
  const [departureLocation, setDepartureLocation] = useState('Karlsruhe, Germany');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lon: number } | null>({
    lat: 49.0069,
    lon: 8.4037,
  });
  const [country, setCountry] = useState('DE');
  const [federalState, setFederalState] = useState('DE-BW');

  // 2. Travel Destinations State (Multi-Entry)
  const [targetDestinations, setTargetDestinations] = useState<string[]>([
    'Mallorca (Balearic Islands)',
    'Hurghada & Red Sea',
  ]);

  // 3. Flight / Origin Airports State
  const [originAirports, setOriginAirports] = useState<string[]>(['FKB', 'STR', 'FRA']);

  // 4. Dynamic Children with Birth Dates
  const [childrenList, setChildrenList] = useState<ChildItem[]>([
    { id: 'c1', birthDate: '2021-08-15' }, // ~5y
    { id: 'c2', birthDate: '2017-05-10' }, // ~9y
  ]);

  // 5. Duration Range
  const [durationDaysMin, setDurationDaysMin] = useState(10);
  const [durationDaysMax, setDurationDaysMax] = useState(14);

  // 6. Date Boundaries
  const [earliestDate, setEarliestDate] = useState(defaultEarliest);
  const [latestDate, setLatestDate] = useState(defaultLatest);
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);

  // 7. Blackout Dates (Starts empty by default, loaded from profile if configured)
  const [searchBlackouts, setSearchBlackouts] = useState<
    { startDate: string; endDate: string; reason?: string }[]
  >([]);

  // Profile preferences & travel comfort state
  const [maxDrivingHours, setMaxDrivingHours] = useState<number | undefined>(undefined);
  const [preferredCabinClass, setPreferredCabinClass] = useState<string | undefined>(undefined);
  const [climatePreference, setClimatePreference] = useState<string | undefined>(undefined);
  const [travelModes, setTravelModes] = useState<string[] | undefined>(undefined);

  // Profile sync states
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);

  // Search Results & Filter / Pagination State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidateWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [maxCostFilter, setMaxCostFilter] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'pto' | 'duration'>('score');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-prefill if family profile exists
  useEffect(() => {
    fetch('/api/family-profile')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then(async (data) => {
        if (data?.profile) {
          const p = data.profile;
          if (p.homeLocation) {
            try {
              const geoRes = await fetch(
                `/api/locations/geocode?q=${encodeURIComponent(p.homeLocation)}`
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.locations && geoData.locations.length > 0) {
                  const loc0 = geoData.locations[0];
                  const cityName = loc0.city || loc0.name;
                  const parts: string[] = [];
                  if (loc0.postcode && !loc0.name.includes(loc0.postcode)) {
                    parts.push(`${loc0.postcode} ${cityName}`);
                  } else {
                    parts.push(cityName);
                  }
                  if (loc0.state && loc0.state !== cityName) parts.push(loc0.state);
                  if (loc0.country) parts.push(loc0.country);
                  const formatted = parts.join(', ');

                  setDepartureLocation(formatted);
                  setDepartureCoords({
                    lat: loc0.lat,
                    lon: loc0.lon,
                  });
                } else {
                  setDepartureLocation(p.homeLocation);
                }
              } else {
                setDepartureLocation(p.homeLocation);
              }
            } catch (err) {
              setDepartureLocation(p.homeLocation);
              console.error('Failed to geocode saved home location:', err);
            }
          }

          if (p.federalState) {
            setFederalState(p.federalState);
            setCountry(getCountryCodeFromSubdivision(p.federalState));
          }

          if (Array.isArray(p.originAirports) && p.originAirports.length > 0) {
            setOriginAirports(p.originAirports);
          }

          if (Array.isArray(p.members) && p.members.length > 0) {
            const childMembers = p.members.filter(
              (m: any) => m.role === 'CHILD' || m.role === 'INFANT'
            );
            if (childMembers.length > 0) {
              setChildrenList(
                childMembers.map((m: any) => ({
                  id: m.id || Math.random().toString(36).substring(2, 9),
                  birthDate: m.birthDate ? m.birthDate.split('T')[0] : '2020-01-01',
                }))
              );
            }
          }

          if (Array.isArray(p.blackoutRanges) && p.blackoutRanges.length > 0) {
            setSearchBlackouts(
              p.blackoutRanges.map((b: any) => ({
                startDate: b.startDate ? b.startDate.split('T')[0] : '',
                endDate: b.endDate ? b.endDate.split('T')[0] : '',
                reason: b.reason || '',
              }))
            );
          }

          if (p.maxDrivingHours !== undefined && p.maxDrivingHours !== null) {
            setMaxDrivingHours(Number(p.maxDrivingHours));
          }
          if (p.preferredCabinClass) {
            setPreferredCabinClass(p.preferredCabinClass);
          }
          if (p.climatePreference) {
            setClimatePreference(p.climatePreference);
          }
          if (Array.isArray(p.travelModes)) {
            setTravelModes(p.travelModes);
          }

          setProfileLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryData = COUNTRIES[newCountry];
    if (countryData && countryData.subdivisions.length > 0) {
      setFederalState(countryData.subdivisions[0].code);
    }
  };

  const handleLocationChange = (loc: string, coords?: { lat: number; lon: number }) => {
    setDepartureLocation(loc);
    if (coords) {
      setDepartureCoords(coords);
    } else if (loc.trim().length >= 2) {
      fetch(`/api/locations/geocode?q=${encodeURIComponent(loc.trim())}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.locations && data.locations.length > 0) {
            setDepartureCoords({
              lat: data.locations[0].lat,
              lon: data.locations[0].lon,
            });
          }
        })
        .catch(() => {});
    }
  };

  const addBlackout = () => {
    setSearchBlackouts([...searchBlackouts, { startDate: '', endDate: '', reason: '' }]);
  };

  const removeBlackout = (index: number) => {
    setSearchBlackouts(searchBlackouts.filter((_, i) => i !== index));
  };

  const updateBlackout = (index: number, field: 'startDate' | 'endDate' | 'reason', val: string) => {
    const updated = [...searchBlackouts];
    updated[index] = { ...updated[index], [field]: val };
    setSearchBlackouts(updated);
  };

  // Two-way sync: Save current travel filters to Family Profile
  const handleSaveToProfile = async () => {
    try {
      setSavingProfile(true);
      setSaveProfileSuccess(false);

      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);
      const membersToSave = childrenList.map((c) => ({
        role: 'CHILD',
        birthDate: c.birthDate,
        schoolRequired: true,
      }));

      const payload = {
        homeLocation: departureLocation,
        federalState,
        originAirports,
        blackoutRanges: validBlackouts,
        members: membersToSave,
      };

      const res = await fetch('/api/family-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to update family profile');
      }

      setSaveProfileSuccess(true);
      setTimeout(() => setSaveProfileSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error saving to profile:', err);
      alert(err.message || 'Error saving to family profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    try {
      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);
      const minDur = Number(durationDaysMin) || 7;
      const maxDur = Math.max(minDur, Number(durationDaysMax) || minDur);

      const tripDate = earliestDate ? new Date(earliestDate) : new Date();
      const computedAges = childrenList
        .map((c) => {
          const b = new Date(c.birthDate);
          return isNaN(b.getTime()) ? 6 : Math.max(0, differenceInYears(tripDate, b));
        })
        .sort((a, b) => a - b);

      const childrenBirthDates = childrenList
        .map((c) => c.birthDate)
        .filter(Boolean);

      const payload = {
        targetDestinations: targetDestinations.length > 0 ? targetDestinations : undefined,
        durationDays: minDur,
        durationDaysMin: minDur,
        durationDaysMax: maxDur,
        earliestDate,
        latestDate,
        maxBudgetTotal: maxBudget ? Number(maxBudget) : undefined,
        searchBlackouts: validBlackouts,
        userProfile: {
          homeLocation: departureLocation,
          departureLat: departureCoords?.lat,
          departureLon: departureCoords?.lon,
          federalState,
          originAirports,
          childrenAges: computedAges,
          childrenBirthDates,
          blackoutRanges: validBlackouts,
          maxDrivingHours,
          preferredCabinClass,
          climatePreference,
          travelModes,
        },
      };

      const res = await fetch('/api/vacations/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Optimization request failed');
      }

      const data = await res.json();
      setResults(data.windows);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filtered and Sorted Results
  const filteredResults = useMemo(() => {
    if (!results) return [];
    let list = [...results];

    if (selectedMonth !== 'ALL') {
      list = list.filter((w) => {
        const m = w.startDate.split('-')[1];
        return m === selectedMonth;
      });
    }

    if (maxCostFilter !== undefined && maxCostFilter > 0) {
      list = list.filter((w) => w.estimatedTotalCost <= maxCostFilter);
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.estimatedTotalCost - b.estimatedTotalCost;
        case 'pto':
          return b.ptoEfficiencyRatio - a.ptoEfficiencyRatio;
        case 'duration':
          return b.durationDays - a.durationDays;
        case 'score':
        default:
          return b.finalScore - a.finalScore;
      }
    });

    return list;
  }, [results, selectedMonth, maxCostFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const displayedResults = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredResults.slice(startIdx, startIdx + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  // Extract available months from search results
  const availableMonths = useMemo(() => {
    if (!results) return [];
    const monthSet = new Set<string>();
    results.forEach((w) => {
      const m = w.startDate.split('-')[1];
      if (m) monthSet.add(m);
    });
    return Array.from(monthSet).sort();
  }, [results]);

  const formatLocalizedDate = (dateStr: string) => {
    try {
      return formatDate(dateStr, { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8">
      {/* Intro hero banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            {t.home.heroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t.home.heroTitle}
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            {t.home.heroDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              {t.home.constraintsTitle}
            </h2>
            {profileLoaded && (
              <span
                className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1.5"
                title={t.home.prefilledFromProfile}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                {t.home.prefilledFromProfile}
              </span>
            )}
          </div>

          <form onSubmit={handleOptimize} className="space-y-6">
            {/* Step 1: Departure Location & School District */}
            <div className="space-y-3">
              <LocationInput
                label={t.home.departureLocationLabel}
                value={departureLocation}
                onChange={handleLocationChange}
                placeholder={t.home.departureLocationPlaceholder}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.home.countryLabel}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    {Object.values(COUNTRIES).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.home.homeStateLabel}
                  </label>
                  <select
                    value={federalState}
                    onChange={(e) => setFederalState(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    {(COUNTRIES[country]?.subdivisions || []).map((sub) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 sm:col-span-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>{t.home.holidayScopeNotice}</span>
                </p>
              </div>
            </div>

            {/* Step 2: Travel Destinations (Multi-Entry Input) */}
            <div className="pt-2 border-t border-slate-100">
              <MultiDestinationInput
                selectedDestinations={targetDestinations}
                onChange={setTargetDestinations}
              />
            </div>

            {/* Step 3: Departure Airports (Proximity, Destination Corridors, Direct Rail Link) */}
            <div className="pt-2 border-t border-slate-100">
              <AirportSelector
                selectedAirports={originAirports}
                onChange={setOriginAirports}
                coordinates={departureCoords}
                targetDestinations={targetDestinations}
              />
            </div>

            {/* Step 4: Participating Children */}
            <div className="pt-2 border-t border-slate-100">
              <ChildrenSelector
                childrenList={childrenList}
                onChange={setChildrenList}
                travelDate={earliestDate}
              />
            </div>

            {/* Step 5: Flexible Vacation Duration */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t.home.durationLabel}
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.durationMinLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMin}
                    onChange={(e) => setDurationDaysMin(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.durationMaxLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMax}
                    onChange={(e) => setDurationDaysMax(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 6: Search Date Range (Strictly Future Dates) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t.home.earliestDateLabel} &amp; {t.home.latestDateLabel}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    min={todayStr}
                    value={earliestDate}
                    onChange={(e) => setEarliestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    min={earliestDate || todayStr}
                    value={latestDate}
                    onChange={(e) => setLatestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 7: Blackout Periods (Sperrzeiten) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    {t.home.blackoutFilterTitle}
                  </span>
                  <button
                    type="button"
                    onClick={addBlackout}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.home.addBlackout}
                  </button>
                </div>

                {searchBlackouts.length === 0 ? (
                  <p className="text-[11px] text-amber-700 italic">{t.home.noBlackouts}</p>
                ) : (
                  <div className="space-y-2">
                    {searchBlackouts.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-white/90 border border-amber-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center shadow-xs"
                      >
                        <div className="sm:col-span-4">
                          <label className="block text-[9px] font-semibold text-slate-500 uppercase">
                            {t.home.blackoutStart}
                          </label>
                          <input
                            type="date"
                            min={todayStr}
                            value={b.startDate}
                            onChange={(e) => updateBlackout(idx, 'startDate', e.target.value)}
                            className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[9px] font-semibold text-slate-500 uppercase">
                            {t.home.blackoutEnd}
                          </label>
                          <input
                            type="date"
                            min={b.startDate || todayStr}
                            value={b.endDate}
                            onChange={(e) => updateBlackout(idx, 'endDate', e.target.value)}
                            className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[9px] font-semibold text-slate-500 uppercase">
                            Reason
                          </label>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={b.reason || ''}
                            onChange={(e) => updateBlackout(idx, 'reason', e.target.value)}
                            className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeBlackout(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title={t.home.removeBlackout}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Sync Button */}
            {session && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSaveToProfile}
                  disabled={savingProfile}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 transition-colors disabled:opacity-50"
                >
                  {saveProfileSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">{t.home.savedToProfileSuccess}</span>
                    </>
                  ) : savingProfile ? (
                    <>
                      <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>{t.home.savingToProfile}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t.home.saveToProfile}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Submit Optimization Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t.home.optimizing}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  {t.home.runOptimization}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Stream */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              {t.home.resultsTitle}
            </h2>
            {results && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                {filteredResults.length} / {results.length} {t.home.windowsFound}
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
              {error}
            </div>
          )}

          {!results && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl">
                <Sun className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-slate-800 font-semibold text-base">{t.home.readyTitle}</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">{t.home.readyDescription}</p>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="font-semibold text-amber-900 text-sm">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationTitle
                  : t.home.noResultsTitle}
              </p>
              <p className="text-xs text-amber-700">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationHint
                  : t.home.noResultsHint}
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <>
              {/* Filter and Sort Toolbar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Filter &amp; Sort</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Month Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t.home.filterByMonth}
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">{t.home.allMonths}</option>
                      {availableMonths.map((m) => {
                        const monthName = formatDate(new Date(2026, parseInt(m, 10) - 1, 1), {
                          month: 'long',
                        });
                        return (
                          <option key={m} value={m}>
                            {monthName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Max Cost Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t.home.filterByCost}
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 3500"
                      value={maxCostFilter || ''}
                      onChange={(e) => {
                        setMaxCostFilter(e.target.value ? Number(e.target.value) : undefined);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      {t.home.sortBy}
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="score">{t.home.sortScore}</option>
                      <option value="price">{t.home.sortPrice}</option>
                      <option value="pto">{t.home.sortPto}</option>
                      <option value="duration">{t.home.sortDuration}</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredResults.length === 0 ? (
                <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-xs">
                  No vacation windows match the active filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedResults.map((win, idx) => {
                    const globalRank = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <div
                        key={`${win.startDate}-${win.originAirport}-${win.destinationAirport}-${win.durationDays}`}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        {/* Arbitrage Banner */}
                        {win.isArbitrageOpportunity && (
                          <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 flex items-center justify-between -mx-5 -mt-5 mb-4 rounded-t-xl">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                              {t.home.arbitrageBadge} ({win.originAirport} in {win.arbitrageOriginState})
                            </span>
                            <span>{t.home.arbitrageSaving}</span>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-base sm:text-lg">
                                {formatLocalizedDate(win.startDate)} → {formatLocalizedDate(win.endDate)}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {win.durationDays} {t.home.days}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <Plane className="w-3.5 h-3.5 text-blue-600" />
                                {win.originAirport} ➔ {win.destinationAirport}
                              </span>
                              <span>•</span>
                              <ClimateDetailsPopover
                                destinationAirport={win.destinationAirport}
                                weather={win.weather}
                              />
                            </div>
                          </div>

                          <div className="text-right flex sm:flex-col justify-between items-end">
                            <div>
                              <span className="text-[11px] text-slate-500 block">
                                {t.home.estFamilyCost}
                              </span>
                              <span className="text-2xl font-black text-slate-900">
                                {formatCurrency(win.estimatedTotalCost)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              <span>~{formatCurrency(win.pricePerPerson)} / {t.home.perPerson}</span>
                              <span className="block text-[10px] text-slate-400">
                                ({t.home.flightAndLodgingIncluded})
                              </span>
                            </div>
                            <BookingDealsPopover
                              pricingDetails={win.pricingDetails}
                              estimatedTotalCost={win.estimatedTotalCost}
                              originAirport={win.originAirport}
                              destinationAirport={win.destinationAirport}
                              countryCode={country}
                              startDate={win.startDate}
                              endDate={win.endDate}
                            />
                          </div>
                        </div>

                        {/* School Holiday Exemption Warning */}
                        {win.requiresSchoolExemption && (
                          <div className="mt-3 p-2.5 rounded-lg bg-orange-50 border border-orange-300 flex items-start gap-2 text-xs text-orange-900">
                            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block">
                                {t.home.requiresSchoolExemptionWarning}
                              </span>
                              {win.schoolHolidayDaysOverlap !== undefined && win.schoolHolidayDaysOverlap > 0 ? (
                                <span className="text-[11px] text-orange-800">
                                  {win.schoolHolidayDaysOverlap} / {win.durationDays} {t.home.days} {t.home.schoolAgeBadge}
                                </span>
                              ) : (
                                <span className="text-[11px] text-orange-800">
                                  {t.home.schoolAgeBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Localized Seasonal Warning Banner */}
                        {win.seasonalWarning && (() => {
                          const localized = getLocalizedSeasonalWarning(win.seasonalWarning, t);
                          return (
                            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-2 text-xs text-amber-900">
                              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block">
                                  {t.home.seasonalWarningBadge}: {localized.title}
                                </span>
                                <span className="text-[11px] text-amber-800">
                                  {localized.description}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Metrics Bar */}
                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <span className="text-slate-500 block text-[10px]">{t.home.ptoConsumed}</span>
                            <span className="font-bold text-slate-800">
                              {win.ptoDaysConsumed} {t.home.days}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium block">
                              ({win.publicHolidaysCount} {t.home.ptoSaved})
                            </span>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <span className="text-slate-500 block text-[10px]">{t.home.ptoRatio}</span>
                            <span className="font-bold text-slate-800">
                              {win.ptoEfficiencyRatio}x
                            </span>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-2">
                            <span className="text-indigo-600 block text-[10px]">{t.home.score}</span>
                            <span className="font-extrabold text-indigo-900 text-sm">
                              {win.finalScore} / 100
                            </span>
                            <span className="text-[10px] text-indigo-700 block">#{globalRank}</span>
                          </div>
                        </div>

                        {win.isCachedBenchmark && (
                          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-slate-400" />
                            {t.home.cachedBenchmark}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Pagination Controls */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{t.home.resultsPerPage}:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white outline-none"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                      <span className="text-slate-400 ml-2">
                        {t.home.page} {currentPage} {t.home.of} {totalPages}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        {t.home.prevPage}
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 3 + i;
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {t.home.nextPage}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
