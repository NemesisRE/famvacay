import { Building2, Bus, Car, Compass, Globe, Mountain, Plane, Sun, Train, Trees, type LucideIcon } from 'lucide-react';
import type { DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import type { TranslationDictionary } from '@/lib/i18n/types';

/**
 * Shared badge styles, so destination cards, groups and the map overlay look the same:
 * - category badges (vacation styles): tinted, uppercase, with a coloured left edge per category
 * - vehicle badges: neutral chassis with a coloured icon
 */

export interface BadgeMeta {
  label: string;
  icon: LucideIcon;
  /** Colour classes (background, text, borders incl. the category's left edge) */
  color: string;
  /** Icon colour (vehicle badges) */
  iconColor?: string;
}

/** Base classes of a category badge; add the meta's `color`. */
export const CATEGORY_BADGE_CLASS =
  'font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border border-l-[3px] inline-flex items-center gap-1 shadow-2xs';

/** Base classes of a vehicle badge; add the meta's `color`, and `iconColor` on the icon. */
export const VEHICLE_BADGE_CLASS = 'font-semibold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 shadow-2xs';

// Spelled out in full so Tailwind's class scanner finds every class
const CATEGORY_COLORS = {
  amber: 'bg-amber-50/90 text-amber-800 border-amber-200 border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 dark:border-l-amber-400',
  sky: 'bg-sky-50/90 text-sky-800 border-sky-200 border-l-sky-500 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800 dark:border-l-sky-400',
  purple: 'bg-purple-50/90 text-purple-800 border-purple-200 border-l-purple-500 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800 dark:border-l-purple-400',
  emerald: 'bg-emerald-50/90 text-emerald-800 border-emerald-200 border-l-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800 dark:border-l-emerald-400',
  indigo: 'bg-indigo-50/90 text-indigo-800 border-indigo-200 border-l-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800 dark:border-l-indigo-400',
  teal: 'bg-teal-50/90 text-teal-800 border-teal-200 border-l-teal-500 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800 dark:border-l-teal-400',
} as const;

export function getCategoryBadge(type: DestinationType, t: TranslationDictionary): BadgeMeta {
  switch (type) {
    case 'BEACH':
      return { label: t.home.vacationKindBeach, icon: Sun, color: CATEGORY_COLORS.amber };
    case 'ALPINE':
    case 'SKI':
      return { label: t.home.vacationKindAlpine, icon: Mountain, color: CATEGORY_COLORS.sky };
    case 'CITY':
      return { label: t.home.vacationKindCity, icon: Building2, color: CATEGORY_COLORS.purple };
    case 'NATURE':
      return { label: t.home.vacationKindNature, icon: Trees, color: CATEGORY_COLORS.emerald };
    case 'LONGRANGE':
      return { label: t.home.vacationKindLongrange, icon: Globe, color: CATEGORY_COLORS.indigo };
    default:
      return { label: type, icon: Compass, color: CATEGORY_COLORS.teal };
  }
}

/** Category badges for a destination's styles (ALL skipped, SKI/ALPINE merged). */
export function getCategoryBadges(styles: DestinationType[] | undefined, t: TranslationDictionary): BadgeMeta[] {
  const byLabel = new Map<string, BadgeMeta>();
  for (const style of styles || []) {
    if (style === 'ALL') continue;
    const meta = getCategoryBadge(style, t);
    if (!byLabel.has(meta.label)) byLabel.set(meta.label, meta);
  }
  return Array.from(byLabel.values());
}

const VEHICLE_CHASSIS = 'bg-slate-100/90 text-slate-700 border-slate-300/80 dark:bg-slate-800/90 dark:text-slate-200 dark:border-slate-700';

export function getVehicleBadge(vehicle: TravelVehicle | undefined, t: TranslationDictionary): BadgeMeta {
  switch (vehicle) {
    case 'CAR':
      return { label: t.home.vehicleCar, icon: Car, iconColor: 'text-emerald-600 dark:text-emerald-400', color: VEHICLE_CHASSIS };
    case 'TRAIN':
      return { label: t.home.vehicleTrain, icon: Train, iconColor: 'text-teal-600 dark:text-teal-400', color: VEHICLE_CHASSIS };
    case 'BUS':
      return { label: t.home.vehicleBus, icon: Bus, iconColor: 'text-amber-600 dark:text-amber-400', color: VEHICLE_CHASSIS };
    case 'PLANE':
    default:
      return { label: t.home.vehiclePlane, icon: Plane, iconColor: 'text-sky-600 dark:text-sky-400', color: VEHICLE_CHASSIS };
  }
}
