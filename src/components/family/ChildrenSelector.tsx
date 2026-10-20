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
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          {t.home.childrenAgesLabel} ({childrenList.length})
        </label>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.childrenAgesHint}</p>

      {childrenList.length === 0 ? (
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.home.noChildrenTraveling}</p>
          <button
            type="button"
            onClick={handleAddChild}
            className="mt-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
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
                className="px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs transition-all hover:bg-white dark:hover:bg-slate-800"
              >
                {/* Number & Date Input */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 w-5 h-5 rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <input
                    type="date"
                    value={child.birthDate}
                    onChange={(e) => handleDateChange(child.id, e.target.value)}
                    className="text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-750 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 outline-none w-32"
                  />
                </div>

                {/* Single-line Badges: Age + Tier + School Status */}
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto justify-end flex-grow">
                  {age !== null && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 whitespace-nowrap">
                      {age}y
                    </span>
                  )}

                  {age !== null && age < 2 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 whitespace-nowrap" title={t.home.tierInfant}>
                      {t.home.tierInfantBadge}
                    </span>
                  )}

                  {age !== null && age >= 2 && age < 12 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 whitespace-nowrap" title={t.home.tierChild}>
                      {t.home.tierChildBadge}
                    </span>
                  )}

                  {age !== null && age >= 12 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 whitespace-nowrap" title={t.home.tierTeen}>
                      {t.home.tierTeenBadge}
                    </span>
                  )}

                  {isSchoolChild && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5 whitespace-nowrap"
                      title={t.home.schoolAgeBadge}
                    >
                      <Award className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                      {t.home.schoolAgeBadgeShort}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveChild(child.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors ml-1 flex-shrink-0 cursor-pointer"
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
            className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/70 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.home.addChild}
          </button>
        </div>
      )}
    </div>
  );
}
