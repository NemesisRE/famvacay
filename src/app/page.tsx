'use client';

import React, { useState, useEffect } from 'react';
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
  Info,
  BookmarkCheck,
  Save,
  Check,
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { CandidateWindow, DestinationType } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';
import { COUNTRIES, getCountryCodeFromSubdivision } from '@/lib/regions/subdivisions';
import { AirportSelector } from '@/components/airports/AirportSelector';
import { LocationInput } from '@/components/geo/LocationInput';
import { ChildrenSelector, ChildItem } from '@/components/family/ChildrenSelector';
import { DestinationInput } from '@/components/destination/DestinationInput';

export default function HomePage() {
  const { data: session } = useSession();
  const { t, formatCurrency } = useI18n();

  // Location and School District State
  const [departureLocation, setDepartureLocation] = useState('Karlsruhe, Germany');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lon: number } | null>({
    lat: 49.0069,
    lon: 8.4037,
  });
  const [country, setCountry] = useState('DE');
  const [federalState, setFederalState] = useState('DE-BW');

  // Flight & Destination State
  const [originAirports, setOriginAirports] = useState<string[]>(['FKB', 'STR', 'FRA']);
  const [destinationType, setDestinationType] = useState<DestinationType>('BEACH');
  const [targetRegion, setTargetRegion] = useState('');

  // Duration & Date Boundaries
  const [durationDaysMin, setDurationDaysMin] = useState(10);
  const [durationDaysMax, setDurationDaysMax] = useState(14);
  const [earliestDate, setEarliestDate] = useState('2026-07-25');
  const [latestDate, setLatestDate] = useState('2026-09-15');
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);

  // Dynamic Children with Birth Dates
  const [childrenList, setChildrenList] = useState<ChildItem[]>([
    { id: 'c1', birthDate: '2021-08-15' }, // ~5y
    { id: 'c2', birthDate: '2017-05-10' }, // ~9y
  ]);

  // Blackout Dates
  const [searchBlackouts, setSearchBlackouts] = useState<
    { startDate: string; endDate: string; reason?: string }[]
  >([
    { startDate: '2026-08-10', endDate: '2026-08-15', reason: 'Work exam' },
  ]);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidateWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            setDepartureLocation(p.homeLocation);
            // Geocode the saved home location to obtain precise coordinates
            try {
              const geoRes = await fetch(
                `/api/locations/geocode?q=${encodeURIComponent(p.homeLocation)}`
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.locations && geoData.locations.length > 0) {
                  setDepartureCoords({
                    lat: geoData.locations[0].lat,
                    lon: geoData.locations[0].lon,
                  });
                }
              }
            } catch (err) {
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

    try {
      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);
      const minDur = Number(durationDaysMin) || 7;
      const maxDur = Math.max(minDur, Number(durationDaysMax) || minDur);

      // Compute dynamic child ages relative to planned earliest departure date
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
        destinationType,
        targetRegion: targetRegion || undefined,
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
        {/* Constraints Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              {t.home.constraintsTitle}
            </h2>
            {profileLoaded && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-600" />
                {t.home.prefilledFromProfile}
              </span>
            )}
          </div>

          <form onSubmit={handleOptimize} className="space-y-5">
            {/* Explicit Departure Location with Geocoding */}
            <LocationInput
              label={t.home.departureLocationLabel}
              value={departureLocation}
              onChange={handleLocationChange}
              placeholder={t.home.departureLocationPlaceholder}
            />

            {/* Country & Subdivision (School Break Rules) */}
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
            </div>

            {/* Dynamic Airport Selector (Proximity, Worldwide Search, TGV Badges) */}
            <AirportSelector
              selectedAirports={originAirports}
              onChange={setOriginAirports}
              coordinates={departureCoords}
            />

            {/* Dynamic Children Management & Travel-Date Relative Ages */}
            <ChildrenSelector
              childrenList={childrenList}
              onChange={setChildrenList}
              travelDate={earliestDate}
            />

            {/* Trip Type & Dynamic Destination Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.home.tripTypeLabel}
                </label>
                <select
                  value={destinationType}
                  onChange={(e) => {
                    setDestinationType(e.target.value as DestinationType);
                    setTargetRegion('');
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="BEACH">{t.home.beach}</option>
                  <option value="CITY">{t.home.city}</option>
                  <option value="NATURE">{t.home.nature}</option>
                  <option value="SKI">{t.home.ski}</option>
                </select>
              </div>

              <DestinationInput
                value={targetRegion}
                onChange={setTargetRegion}
                destinationType={destinationType}
              />
            </div>

            {/* Flexible Duration Range (Min - Max Days) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t.home.durationLabel}
              </label>
              <div className="grid grid-cols-2 gap-3">
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

            {/* Search Window Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.home.earliestDateLabel}
                </label>
                <input
                  type="date"
                  value={earliestDate}
                  onChange={(e) => setEarliestDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.home.latestDateLabel}
                </label>
                <input
                  type="date"
                  value={latestDate}
                  onChange={(e) => setLatestDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* Multiple Blackout Periods (Sperrzeiten) */}
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

            {/* Two-Way Synchronization Action */}
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

            {/* Run Optimization Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60"
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
                {results.length} {t.home.windowsFound}
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
              <p className="font-semibold text-amber-900 text-sm">{t.home.noResultsTitle}</p>
              <p className="text-xs text-amber-700">{t.home.noResultsHint}</p>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4">
              {results.slice(0, 10).map((win, idx) => (
                <div
                  key={`${win.startDate}-${win.originAirport}-${win.destinationAirport}-${win.durationDays}`}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  {/* Arbitrage Banner */}
                  {win.isArbitrageOpportunity && (
                    <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 flex items-center justify-between -mx-5 -mt-5 mb-4">
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
                        <span className="font-extrabold text-slate-900 text-lg">
                          {win.startDate} → {win.endDate}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {win.durationDays} {t.home.days}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Plane className="w-3.5 h-3.5 text-slate-400" />
                          {win.originAirport} ➔ {win.destinationAirport}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          {win.weather.avgTempC}°C
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col justify-between items-end">
                      <div>
                        <span className="text-xs text-slate-500 block">{t.home.estFamilyCost}</span>
                        <span className="text-2xl font-black text-slate-900">
                          {formatCurrency(win.estimatedTotalCost)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ~{formatCurrency(win.pricePerPerson)} / {t.home.perPerson}
                      </span>
                    </div>
                  </div>

                  {/* Seasonal Warning Banner */}
                  {win.seasonalWarning && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-2 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          {t.home.seasonalWarningBadge}: {win.seasonalWarning.seasonType}
                        </span>
                        <span className="text-[11px] text-amber-800">
                          {win.seasonalWarning.fallbackMessage}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Metrics bar */}
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
                      <span className="text-[10px] text-indigo-700 block">#{idx + 1}</span>
                    </div>
                  </div>

                  {win.isCachedBenchmark && (
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-slate-400" />
                      {t.home.cachedBenchmark}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
