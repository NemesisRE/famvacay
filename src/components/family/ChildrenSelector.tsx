'use client';

import { Users, Plus, Trash2 } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { useI18n } from '@/lib/i18n/i18n-context';
import { SchoolRegionSelect } from '@/components/forms/RegionSelectors';
import { ChildAgeBadges } from './ChildAgeBadges';

export interface ChildItem {
  id: string;
  birthDate: string;
  /** ISO 3166-2 region whose school calendar this child follows; omitted = home region. */
  schoolRegion?: string;
}

interface ChildrenSelectorProps {
  childrenList: ChildItem[];
  onChange: (items: ChildItem[]) => void;
  travelDate: string; // The earliest departure date (e.g., '2026-10-20')
  /** Family home region (ISO 3166-2); enables the per-child school region selector. */
  homeRegion?: string;
  className?: string;
}

export function ChildrenSelector({
  childrenList,
  onChange,
  travelDate,
  homeRegion,
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

  const handleSchoolRegionChange = (id: string, region: string | undefined) => {
    onChange(
      childrenList.map((c) => (c.id === id ? { ...c, schoolRegion: region } : c))
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
      {homeRegion && childrenList.some((c) => (calculateAgeAtTravel(c.birthDate) ?? 0) >= 6) && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.schoolRegionHint}</p>
      )}

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
                className="px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs transition-all hover:bg-white dark:hover:bg-slate-800 space-y-1.5"
              >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {/* Number & Date Input */}
                <div className="order-1 flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 w-5 h-5 rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <input
                    type="date"
                    value={child.birthDate}
                    onChange={(e) => handleDateChange(child.id, e.target.value)}
                    className="text-xs rounded border border-slate-300 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 outline-hidden w-32"
                  />
                </div>

                {/* Single-line Badges: Age + Tier + School Status */}
                <div className="order-3 basis-full sm:order-2 sm:basis-auto sm:flex-1 flex flex-wrap items-center gap-1.5 min-w-0 sm:justify-end pl-7 sm:pl-0">
                  <ChildAgeBadges age={age} />

                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveChild(child.id)}
                  className="order-2 ml-auto sm:order-3 sm:ml-0 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors shrink-0 cursor-pointer"
                  title={t.home.removeChild}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {homeRegion && isSchoolChild && (
                <SchoolRegionSelect
                  homeRegion={homeRegion}
                  value={child.schoolRegion}
                  onChange={(region) => handleSchoolRegionChange(child.id, region)}
                  label={t.home.schoolRegionLabel}
                />
              )}
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
