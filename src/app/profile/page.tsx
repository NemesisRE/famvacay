'use client';

import React, { useState, useEffect } from 'react';
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
  Clock,
  Compass,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

interface FamilyMemberForm {
  firstName: string;
  role: 'PARENT' | 'CHILD' | 'INFANT' | 'OTHER';
  birthDate: string;
  schoolRequired: boolean;
  passportExpiry: string;
  specialDiet: string;
}

export default function FamilyProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [familyName, setFamilyName] = useState('');
  const [homeLocation, setHomeLocation] = useState('Stuttgart, Germany');
  const [federalState, setFederalState] = useState('DE-BW');
  const [originAirports, setOriginAirports] = useState<string[]>(['STR', 'FRA', 'BSL']);
  const [maxDrivingHours, setMaxDrivingHours] = useState(2.5);
  const [preferredCabinClass, setPreferredCabinClass] = useState('ECONOMY');
  const [climatePreference, setClimatePreference] = useState('MODERATE');
  const [passportCheckRequired, setPassportCheckRequired] = useState(true);
  const [travelModes, setTravelModes] = useState<string[]>(['FLIGHT', 'CAR']);

  const toggleTravelMode = (mode: string) => {
    if (travelModes.includes(mode)) {
      if (travelModes.length > 1) {
        setTravelModes(travelModes.filter((m) => m !== mode));
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
            setHomeLocation(p.homeLocation || 'Stuttgart, Germany');
            setFederalState(p.federalState || 'DE-BW');
            setOriginAirports(p.originAirports || ['STR', 'FRA']);
            setMaxDrivingHours(p.maxDrivingHours ?? 2.5);
            setPreferredCabinClass(p.preferredCabinClass || 'ECONOMY');
            setClimatePreference(p.climatePreference || 'MODERATE');
            setPassportCheckRequired(p.passportCheckRequired ?? true);
            if (Array.isArray(p.travelModes) && p.travelModes.length > 0) {
              setTravelModes(p.travelModes);
            }

            if (p.members && p.members.length > 0) {
              setMembers(
                p.members.map((m: any) => ({
                  firstName: m.firstName || '',
                  role: m.role || 'PARENT',
                  birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
                  schoolRequired: Boolean(m.schoolRequired),
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
      const res = await fetch('/api/family-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName,
          homeLocation,
          federalState,
          originAirports,
          maxDrivingHours,
          preferredCabinClass,
          climatePreference,
          passportCheckRequired,
          travelModes,
          members,
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
        <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
        <p className="mt-4 text-xs font-semibold text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              {t.profile.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t.profile.subtitle}</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 self-start sm:self-auto">
            {members.length} {t.profile.membersBadge}
          </span>
        </div>

        {message && (
          <div
            className={`my-4 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
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
          {/* Section 1 */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              {t.profile.sec1Title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.profile.familyName}
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="The Miller Family"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.profile.homeLocation}
                </label>
                <input
                  type="text"
                  required
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                  placeholder="70173 Stuttgart"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.profile.federalState}
                </label>
                <select
                  value={federalState}
                  onChange={(e) => setFederalState(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="DE-BW">Baden-Württemberg (DE-BW)</option>
                  <option value="DE-BY">Bayern (DE-BY)</option>
                  <option value="DE-HE">Hessen (DE-HE)</option>
                  <option value="DE-NW">Nordrhein-Westfalen (DE-NW)</option>
                  <option value="DE-BE">Berlin (DE-BE)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-slate-400" />
              {t.profile.sec2Title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t.profile.maxDrive}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={maxDrivingHours}
                  onChange={(e) => setMaxDrivingHours(Number(e.target.value))}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.profile.cabinClass}
                </label>
                <select
                  value={preferredCabinClass}
                  onChange={(e) => setPreferredCabinClass(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ECONOMY">{t.profile.economy}</option>
                  <option value="PREMIUM_ECONOMY">{t.profile.premiumEconomy}</option>
                  <option value="BUSINESS">{t.profile.business}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.profile.climatePref}
                </label>
                <select
                  value={climatePreference}
                  onChange={(e) => setClimatePreference(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="WARM">{t.profile.warm}</option>
                  <option value="MODERATE">{t.profile.moderate}</option>
                  <option value="COOL">{t.profile.cool}</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="passportCheck"
                checked={passportCheckRequired}
                onChange={(e) => setPassportCheckRequired(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="passportCheck" className="text-xs text-slate-700 font-medium">
                {t.profile.passportCheck}
              </label>
            </div>

            {/* Travel Modes (Multi-Select) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t.profile.travelModesLabel}
              </label>
              <p className="text-[11px] text-slate-500">{t.profile.travelModesHint}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: 'CAR', label: t.profile.modeCar },
                  { id: 'TRAIN', label: t.profile.modeTrain },
                  { id: 'FLIGHT', label: t.profile.modeFlight },
                  { id: 'CAMPER', label: t.profile.modeCamper },
                ].map((mode) => {
                  const isSelected = travelModes.includes(mode.id);
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => toggleTravelMode(mode.id)}
                      className={`text-xs px-3.5 py-2 rounded-xl border font-semibold transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {t.profile.sec3Title}
              </h2>
              <button
                type="button"
                onClick={addMember}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.profile.addMember}
              </button>
            </div>

            <div className="space-y-3">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                      {t.profile.name}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Liam"
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                      {t.profile.role}
                    </label>
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
                    >
                      <option value="PARENT">{t.profile.parent}</option>
                      <option value="CHILD">{t.profile.child}</option>
                      <option value="INFANT">{t.profile.infant}</option>
                      <option value="OTHER">{t.profile.other}</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                      {t.profile.birthDate}
                    </label>
                    <input
                      type="date"
                      required
                      value={member.birthDate}
                      onChange={(e) => updateMember(index, 'birthDate', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                      {t.profile.passportExpiry}
                    </label>
                    <input
                      type="date"
                      value={member.passportExpiry}
                      onChange={(e) => updateMember(index, 'passportExpiry', e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
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
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow transition flex items-center gap-2 disabled:opacity-60"
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
      </div>
    </div>
  );
}
