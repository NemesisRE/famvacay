'use client';

import { Bus, Car, Train } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { BoardType } from '@/lib/optimizer/types';
import { SelectDropdown } from '@/components/ui/select-dropdown';

/**
 * Minimum beach/daytime temperature presets, shared by the search form's beach tile popover
 * and the profile, so both offer the same values (the profile used to accept any number).
 */
export const MIN_BEACH_TEMP_PRESETS = [20, 22, 24, 26, 28] as const;

/**
 * Maximum overland travel-time presets in hours (search form and profile).
 */
export const OVERLAND_DURATION_PRESETS = [4, 6, 8, 10, 14] as const;

/**
 * Car, train and bus icons in front of the overland travel-time label: they say which trips the
 * limit applies to without a vehicle list in the text, which wrapped in the longer languages.
 */
export function OverlandModeIcons({ className = 'text-teal-600 dark:text-teal-400' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}
      title={[t.home.vehicleCar, t.home.vehicleTrain, t.home.vehicleBus].join(' · ')}
    >
      <Car className="w-3.5 h-3.5" aria-hidden />
      <Train className="w-3.5 h-3.5" aria-hidden />
      <Bus className="w-3.5 h-3.5" aria-hidden />
    </span>
  );
}

interface CabinClassSelectProps {
  value: string | undefined;
  onChange: (cabinClass: string) => void;
  id?: string;
}

/** Preferred cabin class (search form and profile); no value means economy. */
export function CabinClassSelect({ value, onChange, id }: CabinClassSelectProps) {
  const { t } = useI18n();
  return (
    <SelectDropdown
      id={id}
      variant="form"
      value={value || 'ECONOMY'}
      onChange={onChange}
      options={[
        { value: 'ECONOMY', label: t.profile.economy },
        { value: 'PREMIUM_ECONOMY', label: t.profile.premiumEconomy },
        { value: 'BUSINESS', label: t.profile.business },
      ]}
    />
  );
}

export const BOARD_TYPE_OPTIONS: BoardType[] = ['ALL_INCLUSIVE', 'HALF_BOARD', 'BREAKFAST', 'ROOM_ONLY'];

interface MinTemperatureSelectProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
  id?: string;
}

export function MinTemperatureSelect({ value, onChange, className = '', id }: MinTemperatureSelectProps) {
  const { t } = useI18n();
  const isCustom = value !== undefined && !(MIN_BEACH_TEMP_PRESETS as readonly number[]).includes(value);
  return (
    <SelectDropdown
      id={id}
      variant="form"
      value={value === undefined ? 'ANY' : String(value)}
      onChange={(v) => onChange(v === 'ANY' ? undefined : Number(v))}
      className={className}
      options={[
        { value: 'ANY', label: t.home.minBeachTempAny },
        ...MIN_BEACH_TEMP_PRESETS.map((temp) => ({ value: String(temp), label: `≥ ${temp}°C` })),
        // Keep a previously saved non-preset value selectable instead of silently dropping it
        ...(isCustom ? [{ value: String(value), label: `≥ ${value}°C` }] : []),
      ]}
    />
  );
}

interface OverlandDurationSelectProps {
  value: number | undefined;
  onChange: (hours: number | undefined) => void;
  className?: string;
  id?: string;
}

export function OverlandDurationSelect({ value, onChange, className = '', id }: OverlandDurationSelectProps) {
  const { t } = useI18n();
  const isCustom = value !== undefined && value > 0 && !(OVERLAND_DURATION_PRESETS as readonly number[]).includes(value);
  return (
    <SelectDropdown
      id={id}
      variant="form"
      value={value ? String(value) : 'ALL'}
      onChange={(v) => onChange(v === 'ALL' ? undefined : Number(v))}
      className={className}
      options={[
        { value: 'ALL', label: t.home.overlandDurationAny },
        ...OVERLAND_DURATION_PRESETS.map((hours) => ({
          value: String(hours),
          label: t.home.overlandDurationUpTo.replace('{hours}', String(hours)),
        })),
        ...(isCustom ? [{ value: String(value), label: `${t.home.overlandDurationCustom} (${value}h)` }] : []),
      ]}
    />
  );
}

interface BoardTypeSelectProps {
  value: BoardType | undefined;
  onChange: (value: BoardType | undefined) => void;
  className?: string;
  id?: string;
}

export function BoardTypeSelect({ value, onChange, className = '', id }: BoardTypeSelectProps) {
  const { t } = useI18n();
  const labels: Record<BoardType, string> = {
    ALL_INCLUSIVE: t.home.boardTypeAllInclusive,
    HALF_BOARD: t.home.boardTypeHalfBoard,
    BREAKFAST: t.home.boardTypeBreakfast,
    ROOM_ONLY: t.home.boardTypeRoomOnly,
  };
  return (
    <SelectDropdown
      id={id}
      variant="form"
      value={value || 'ALL'}
      onChange={(v) => onChange(v === 'ALL' ? undefined : (v as BoardType))}
      className={className}
      options={[
        { value: 'ALL', label: t.home.allBoardTypes },
        ...BOARD_TYPE_OPTIONS.map((type) => ({ value: type, label: labels[type] })),
      ]}
    />
  );
}

interface SnowGuaranteeSelectProps {
  value: boolean;
  onChange: (requireSnow: boolean) => void;
  className?: string;
  id?: string;
}

/**
 * Snow guarantee as the same select control as the other preferences (search form & profile),
 * rather than a lone native checkbox.
 */
export function SnowGuaranteeSelect({ value, onChange, className = '', id }: SnowGuaranteeSelectProps) {
  const { t } = useI18n();
  return (
    <SelectDropdown
      id={id}
      variant="form"
      value={value ? 'REQUIRED' : 'ANY'}
      onChange={(v) => onChange(v === 'REQUIRED')}
      title={t.home.winterSportsDesc}
      className={className}
      options={[
        { value: 'ANY', label: t.home.noSnowGuaranteeBadge },
        { value: 'REQUIRED', label: t.home.snowGuaranteeBadge },
      ]}
    />
  );
}
