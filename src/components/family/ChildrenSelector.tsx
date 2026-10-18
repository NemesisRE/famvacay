'use client';

import React from 'react';
import { Users, Plus, Trash2, Award } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface ChildItem {
  id: string;
  birthDate: string;
}

interface ChildrenSelectorProps {
  childrenList: ChildItem[];
  onChange: (items: ChildItem[]) => void;
  travelDate: string; // The earliest departure date (e.g., '2026-10-20')
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
    <div className={`space-y-2.5 ${className}`}>
      <div>
        <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-600" />
          {t.home.childrenAgesLabel} ({childrenList.length})
        </label>
      </div>

      <p className="text-[11px] text-slate-500">{t.home.childrenAgesHint}</p>

      {childrenList.length === 0 ? (
        <div className="p-2.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
          <p className="text-xs text-slate-500">{t.home.noChildrenTraveling}</p>
          <button
            type="button"
            onClick={handleAddChild}
            className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            + {t.home.addChild}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {childrenList.map((child, index) => {
            const age = calculateAgeAtTravel(child.birthDate);
            const isSchoolChild = age !== null && age >= 6;

            return (
              <div
                key={child.id}
                className="px-2.5 py-1.5 bg-slate-50/90 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs transition-all hover:bg-white"
              >
                {/* Number & Date Input */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 w-5 h-5 rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <input
                    type="date"
                    value={child.birthDate}
                    onChange={(e) => handleDateChange(child.id, e.target.value)}
                    className="text-xs rounded border border-slate-300 px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 outline-none w-32"
                  />
                </div>

                {/* Single-line Badges: Age + Tier + School Status */}
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto justify-end flex-grow">
                  {age !== null && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap">
                      {age}y
                    </span>
                  )}

                  {age !== null && age < 2 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 whitespace-nowrap" title={t.home.tierInfant}>
                      {t.home.tierInfantBadge}
                    </span>
                  )}

                  {age !== null && age >= 2 && age < 12 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 whitespace-nowrap" title={t.home.tierChild}>
                      {t.home.tierChildBadge}
                    </span>
                  )}

                  {age !== null && age >= 12 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 whitespace-nowrap" title={t.home.tierTeen}>
                      {t.home.tierTeenBadge}
                    </span>
                  )}

                  {isSchoolChild && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5 whitespace-nowrap"
                      title={t.home.schoolAgeBadge}
                    >
                      <Award className="w-2.5 h-2.5 text-amber-700" />
                      {t.home.schoolAgeBadgeShort}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveChild(child.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors ml-1 flex-shrink-0"
                    title={t.home.removeChild}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddChild}
            className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 hover:bg-blue-100/70 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.home.addChild}
          </button>
        </div>
      )}
    </div>
  );
}
