'use client';

import React, { useState } from 'react';
import { Calendar, Plane, Sun, Award, AlertCircle, Sparkles, Filter, CheckCircle2, ChevronRight, MapPin, Users } from 'lucide-react';
import { CandidateWindow, DestinationType } from '@/lib/optimizer/types';

export default function HomePage() {
  const [federalState, setFederalState] = useState('DE-BW');
  const [originAirports, setOriginAirports] = useState<string[]>(['STR', 'FRA', 'BSL']);
  const [destinationType, setDestinationType] = useState<DestinationType>('BEACH');
  const [targetRegion, setTargetRegion] = useState('');
  const [durationDays, setDurationDays] = useState(10);
  const [earliestDate, setEarliestDate] = useState('2026-07-25');
  const [latestDate, setLatestDate] = useState('2026-09-15');
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [childrenAges, setChildrenAges] = useState<number[]>([4, 8]);
  const [blackoutStart, setBlackoutStart] = useState('2026-08-10');
  const [blackoutEnd, setBlackoutEnd] = useState('2026-08-15');
  const [blackoutReason, setBlackoutReason] = useState('Job Release Freeze');
  const [useBlackout, setUseBlackout] = useState(true);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidateWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleAirport = (code: string) => {
    if (originAirports.includes(code)) {
      setOriginAirports(originAirports.filter((c) => c !== code));
    } else {
      setOriginAirports([...originAirports, code]);
    }
  };

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        destinationType,
        targetRegion: targetRegion || undefined,
        durationDays: Number(durationDays),
        earliestDate,
        latestDate,
        maxBudgetTotal: maxBudget ? Number(maxBudget) : undefined,
        userProfile: {
          homeLocation: 'Stuttgart / Region',
          federalState,
          originAirports,
          childrenAges,
          blackoutRanges: useBlackout && blackoutStart && blackoutEnd
            ? [{ startDate: blackoutStart, endDate: blackoutEnd, reason: blackoutReason }]
            : [],
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
            Automated Holiday & Neighboring State Arbitrage
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Family Vacation Optimizer (FamVacay)
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Mathematically solve constraint satisfaction problems for parents. Maximize school holiday compliance, leverage neighboring state flight arbitrage, and minimize consumed PTO leave.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Constraints Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Vacation Constraints
            </h2>
            <span className="text-xs text-slate-500 font-mono">CSP Engine</span>
          </div>

          <form onSubmit={handleOptimize} className="space-y-5">
            {/* Origin & State */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Home Federal State (School Holidays)
              </label>
              <select
                value={federalState}
                onChange={(e) => setFederalState(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DE-BW">Baden-Württemberg (DE-BW)</option>
                <option value="DE-BY">Bayern (DE-BY)</option>
                <option value="DE-HE">Hessen (DE-HE)</option>
                <option value="DE-NW">Nordrhein-Westfalen (DE-NW)</option>
                <option value="DE-BE">Berlin (DE-BE)</option>
              </select>
            </div>

            {/* Departure Airports */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Origin Airports (Select multiple for arbitrage)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'STR', label: 'STR (Stuttgart)' },
                  { code: 'FRA', label: 'FRA (Frankfurt - HE)' },
                  { code: 'BSL', label: 'BSL (Basel - CH/FR)' },
                  { code: 'FKB', label: 'FKB (Baden-Baden)' },
                  { code: 'MUC', label: 'MUC (Munich - BY)' },
                  { code: 'NUE', label: 'NUE (Nuremberg - BY)' },
                ].map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => toggleAirport(airport.code)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      originAirports.includes(airport.code)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {airport.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Children Ages */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Children Ages (determines school constraint & fare tier)
              </label>
              <div className="flex items-center gap-2">
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
                  placeholder="e.g. 4, 8"
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tiers: Infant (&lt;2y, 10%), Child (2–11y, 75%), Teen/Adult (12+y, 100%).
              </p>
            </div>

            {/* Destination Type & Target */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Trip Type
                </label>
                <select
                  value={destinationType}
                  onChange={(e) => setDestinationType(e.target.value as DestinationType)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BEACH">🏖️ Beach</option>
                  <option value="CITY">🏛️ City</option>
                  <option value="NATURE">🌲 Nature</option>
                  <option value="SKI">⛷️ Ski</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Search Window Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Earliest Departure
                </label>
                <input
                  type="date"
                  value={earliestDate}
                  onChange={(e) => setEarliestDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Latest Return
                </label>
                <input
                  type="date"
                  value={latestDate}
                  onChange={(e) => setLatestDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Blackout Range Exclusion */}
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  Hard Blackout Dates Filter
                </span>
                <input
                  type="checkbox"
                  checked={useBlackout}
                  onChange={(e) => setUseBlackout(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
              </div>
              {useBlackout && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="date"
                    value={blackoutStart}
                    onChange={(e) => setBlackoutStart(e.target.value)}
                    className="text-xs rounded border border-amber-300 px-2 py-1.5 bg-white"
                  />
                  <input
                    type="date"
                    value={blackoutEnd}
                    onChange={(e) => setBlackoutEnd(e.target.value)}
                    className="text-xs rounded border border-amber-300 px-2 py-1.5 bg-white"
                  />
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
                  Calculating Global Pareto Optimal Windows...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  Run Multi-Objective Optimization
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Stream / Ranked Windows */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Optimal Vacation Windows
            </h2>
            {results && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                {results.length} Windows Found
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
                🏖️
              </div>
              <h3 className="text-slate-800 font-semibold text-base">
                Ready to find the cheapest vacation window
              </h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Set your family profile, constraints, and click optimize to evaluate school holiday overlaps, weather suitability, and neighboring state airport arbitrage.
              </p>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center space-y-2">
              <p className="font-semibold text-amber-900 text-sm">
                No matching vacation windows satisfied all constraints.
              </p>
              <p className="text-xs text-amber-700">
                Try widening your date boundaries or adjusting blackout dates.
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4">
              {results.slice(0, 10).map((win, idx) => (
                <div
                  key={`${win.startDate}-${win.originAirport}-${win.destinationAirport}`}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  {/* Arbitrage Banner */}
                  {win.isArbitrageOpportunity && (
                    <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 flex items-center justify-between -mx-5 -mt-5 mb-4">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        State Arbitrage Detected ({win.originAirport} in {win.arbitrageOriginState})
                      </span>
                      <span>30% Cheaper vs Home State Airport</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-lg">
                          {win.startDate} → {win.endDate}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {win.durationDays} Days
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
                          {win.weather.avgTempC}°C (Rain risk: {win.weather.precipitationRiskPercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col justify-between items-end">
                      <div>
                        <span className="text-xs text-slate-500 block">Est. Family Cost</span>
                        <span className="text-2xl font-black text-slate-900">
                          €{win.estimatedTotalCost}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ~€{win.pricePerPerson} / person
                      </span>
                    </div>
                  </div>

                  {/* Metrics bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="text-slate-500 block text-[10px]">PTO Consumed</span>
                      <span className="font-bold text-slate-800">
                        {win.ptoDaysConsumed} Days
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium block">
                        ({win.publicHolidaysCount} Public Holiday saved)
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="text-slate-500 block text-[10px]">PTO Ratio</span>
                      <span className="font-bold text-slate-800">
                        {win.ptoEfficiencyRatio}x
                      </span>
                      <span className="text-[10px] text-slate-400 block">window/leave</span>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2">
                      <span className="text-indigo-600 block text-[10px]">Optimizer Score</span>
                      <span className="font-extrabold text-indigo-900 text-sm">
                        {win.finalScore} / 100
                      </span>
                      <span className="text-[10px] text-indigo-700 block">Rank #{idx + 1}</span>
                    </div>
                  </div>

                  {/* Benchmark indicator */}
                  {win.isCachedBenchmark && (
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-slate-400" />
                      Price based on Redis-cached historical flight pricing benchmark.
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

