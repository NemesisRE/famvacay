'use client';

import { Award } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Age, fare tier and school-age badges for a child, shared by the search form's children list
 * and the profile's traveler rows.
 */
export function ChildAgeBadges({ age }: { age: number | null }) {
  const { t } = useI18n();
  const isSchoolChild = age !== null && age >= 6;
  return (
    <>
      {age !== null && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 whitespace-nowrap">
          {t.home.childAgeShort.replace('{age}', String(age))}
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
    </>
  );
}
