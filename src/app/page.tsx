'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { CandidateWindow, DestinationType } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';
import { COUNTRIES, getCountryCodeFromSubdivision } from '@/lib/regions/subdivisions';
import { getRecommendedAirportsForRegion } from '@/lib/airports/airports-db';
import { POPULAR_DESTINATIONS } from '@/lib/optimizer/weather';

export default function HomePage() {
  const { t, formatCurrency } = useI18n();

  const [country, setCountry] = useState('DE');
  const [federalState, setFederalState] = useState('DE-BW');
  const [originAirports, setOriginAirports] = useState<string[]>(['STR', 'FRA', 'BSL']);
  const [destinationType, setDestinationType] = useState<DestinationType>('BEACH');
  const [targetRegion, setTargetRegion] = useState('');
  const [durationDaysMin, setDurationDaysMin] = useState(10);
  const [durationDaysMax, setDurationDaysMax] = useState(14);
  const [earliestDate, setEarliestDate] = useState('2026-07-25');
  const [latestDate, setLatestDate] = useState('2026-09-15');
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [childrenAges, setChildrenAges] = useState<number[]>([4, 8]);
  const [searchBlackouts, setSearchBlackouts] = useState<
    { startDate: string; endDate: string; reason?: string }[]
  >([
    { startDate: '2026-08-10', endDate: '2026-08-15', reason: 'Work exam' },
  ]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [homeLocation, setHomeLocation] = useState('Stuttgart / Region');

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
      .then((data) => {
        if (data?.profile) {
          const p = data.profile;
          if (p.federalState) {
            setFederalState(p.federalState);
            setCountry(getCountryCodeFromSubdivision(p.federalState));
          }
          if (Array.isArray(p.originAirports) && p.originAirports.length > 0) {
            setOriginAirports(p.originAirports);
          }
          if (p.homeLocation) {
            setHomeLocation(p.homeLocation);
          }
          if (Array.isArray(p.members) && p.members.length > 0) {
            const now = new Date();
            const derivedAges: number[] = [];
            for (const m of p.members) {
              if (m.birthDate) {
                const birth = new Date(m.birthDate);
                const age = Math.max(
                  0,
                  Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000))
                );
                if (m.role === 'CHILD' || m.role === 'INFANT' || age < 18) {
                  derivedAges.push(age);
                }
              }
            }
            if (derivedAges.length > 0) {
              setChildrenAges(derivedAges.sort((a, b) => a - b));
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

  const toggleAirport = (code: string) => {
    if (originAirports.includes(code)) {
      if (originAirports.length > 1) {
        setOriginAirports(originAirports.filter((c) => c !== code));
      }
    } else {
      setOriginAirports([...originAirports, code]);
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

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);
      const minDur = Number(durationDaysMin) || 7;
      const maxDur = Math.max(minDur, Number(durationDaysMax) || minDur);

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
          homeLocation,
          federalState,
          originAirports,
          childrenAges,
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

  const recommendedAirports = getRecommendedAirportsForRegion(federalState, 450);

  // Group destinations by type or show category destinations
  const categoryDestinations = Object.values(POPULAR_DESTINATIONS).filter(
    (d) => d.type === destinationType
  );

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
            {/* Country & Subdivision */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.home.countryLabel}
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(COUNTRIES[country]?.subdivisions || []).map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Departure Airports (Dynamic Proximity Recommendations) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {t.home.airportsLabel}
                </label>
                <span className="text-[10px] text-slate-400">Proximity sorted</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{t.home.airportsHint}</p>
              <div className="flex flex-wrap gap-2">
                {recommendedAirports.map((airport) => {
                  const isSelected = originAirports.includes(airport.code);
                  return (
                    <button
                      key={airport.code}
                      type="button"
                      onClick={() => toggleAirport(airport.code)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {airport.code} · {airport.city} ({Math.round(airport.distanceKm)} km)
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Children Ages & Automatic Derivation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {t.home.childrenAgesLabel}
                </label>
                {profileLoaded && (
                  <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                    Derived from Profile
                  </span>
                )}
              </div>
              <input
                type="text"
                value={childrenAges.join(', ')}
                onChange={(e) =>
                  setChildrenAges(
                    e.target.value
                      .split(',')
                      .map((s) => parseInt(s.trim()))
                      .filter((n) => !isNaN(n))
                  )
                }
                placeholder="e.g. 1, 5, 10"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">{t.home.childrenAgesHint}</p>
            </div>

            {/* Trip Type & Target Destination */}
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
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BEACH">{t.home.beach}</option>
                  <option value="CITY">{t.home.city}</option>
                  <option value="NATURE">{t.home.nature}</option>
                  <option value="SKI">{t.home.ski}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.home.targetDestinationLabel}
                </label>
                <select
                  value={targetRegion}
                  onChange={(e) => setTargetRegion(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t.home.allDestinations}</option>
                  {categoryDestinations.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} ({d.code} - {d.country})
                    </option>
                  ))}
                  {/* Also show global destinations if not already listed */}
                  {Object.values(POPULAR_DESTINATIONS)
                    .filter((d) => d.type !== destinationType)
                    .map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.code} - {d.country})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Flexible Duration Range (Min - Max Days) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t.home.durationLabel} (Flexible Range)
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
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
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
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
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
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
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
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
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
                      className="p-2 rounded-lg bg-white/90 border border-amber-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[9px] font-semibold text-slate-500 uppercase">
                          {t.home.blackoutStart}
                        </label>
                        <input
                          type="date"
                          value={b.startDate}
                          onChange={(e) => updateBlackout(idx, 'startDate', e.target.value)}
                          className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white"
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
                          className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white"
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
                          className="w-full text-[11px] rounded border border-slate-300 px-2 py-1 bg-white"
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
