'use client';

import React from 'react';
import { Users, Plus, Trash2, Calendar, Award, Sparkles } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface ChildItem {
  id: string;
  birthDate: string;
}

interface ChildrenSelectorProps {
  childrenList: ChildItem[];
  onChange: (items: ChildItem[]) => void;
  travelDate: string; // The earliest departure date (e.g., '2026-07-25')
  className?: string;
}

export function ChildrenSelector({
  childrenList,
  onChange,
  travelDate,
  className = '',
}: ChildrenSelectorProps) {
  const { t } = useI18n();

  const handleAddChild = () => {
    // Default new child birth date to ~6 years before current year
    const defaultYear = new Date().getFullYear() - 6;
    const newItem: ChildItem = {
      id: Math.random().toString(36).substring(2, 9),
      birthDate: `${defaultYear}-06-01`,
    };
    onChange([...childrenList, newItem]);
  };

  const handleRemoveChild = (id: string) => {
    onChange(childrenList.filter((c) => c.id !== id));
  };

  const handleDateChange = (id: string, newDate: string) => {
    onChange(
      childrenList.map((c) => (c.id === id ? { ...c, birthDate: newDate } : c))
    );
  };

  const calculateAgeAtTravel = (birthDateStr: string) => {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    const trip = travelDate ? new Date(travelDate) : new Date();
    if (isNaN(birth.getTime()) || isNaN(trip.getTime())) return null;
    return Math.max(0, differenceInYears(trip, birth));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-600" />
          {t.home.childrenAgesLabel} ({childrenList.length})
        </label>
        <button
          type="button"
          onClick={handleAddChild}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.home.addChild}
        </button>
      </div>

      <p className="text-[11px] text-slate-500">{t.home.childrenAgesHint}</p>

      {childrenList.length === 0 ? (
        <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
          <p className="text-xs text-slate-500">No children traveling (Adults only).</p>
          <button
            type="button"
            onClick={handleAddChild}
            className="mt-1.5 text-xs font-semibold text-blue-600 hover:underline"
          >
            + {t.home.addChild}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {childrenList.map((child, index) => {
            const age = calculateAgeAtTravel(child.birthDate);
            const isSchoolChild = age !== null && age >= 6;

            return (
              <div
                key={child.id}
                className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
              >
                <div className="flex items-center gap-2 flex-grow">
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-grow">
                    <label className="text-[11px] font-medium text-slate-500 flex-shrink-0">
                      {t.home.childBirthDate}:
                    </label>
                    <input
                      type="date"
                      value={child.birthDate}
                      onChange={(e) => handleDateChange(child.id, e.target.value)}
                      className="text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                    />
                  </div>
                </div>

                {/* Age & Fare Tiers Badges */}
                <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                  {age !== null && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                      {age} {age === 1 ? 'yr' : 'yrs'} ({t.home.ageAtTravel})
                    </span>
                  )}

                  {age !== null && age < 2 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                      {t.home.tierInfant}
                    </span>
                  )}

                  {age !== null && age >= 2 && age < 12 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {t.home.tierChild}
                    </span>
                  )}

                  {age !== null && age >= 12 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                      {t.home.tierTeen}
                    </span>
                  )}

                  {isSchoolChild && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                      title={t.home.schoolAgeBadge}
                    >
                      <Award className="w-3 h-3 text-amber-700" />
                      School Age (6+)
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveChild(child.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors ml-1"
                    title={t.home.removeChild}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

