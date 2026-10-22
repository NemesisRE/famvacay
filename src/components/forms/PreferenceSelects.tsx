'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { BoardType } from '@/lib/optimizer/types';
import { FORM_SELECT_CLASS } from './RegionSelectors';

/**
 * Minimum beach/daytime temperature presets, shared by the search form's beach tile popover
 * and the profile, so both offer the same values (the profile used to accept any number).
 */
export const MIN_BEACH_TEMP_PRESETS = [20, 22, 24, 26, 28] as const;

/**
 * Maximum overland travel-time presets in hours (search form and profile).
 */
export const OVERLAND_DURATION_PRESETS = [4, 6, 8, 10, 14] as const;

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
    <select
      id={id}
      value={value === undefined ? 'ANY' : String(value)}
      onChange={(e) => onChange(e.target.value === 'ANY' ? undefined : Number(e.target.value))}
      className={`${FORM_SELECT_CLASS} ${className}`}
    >
      <option value="ANY">{t.home.minBeachTempAny}</option>
      {MIN_BEACH_TEMP_PRESETS.map((temp) => (
        <option key={temp} value={String(temp)}>
          ≥ {temp}°C
        </option>
      ))}
      {/* Keep a previously saved non-preset value selectable instead of silently dropping it */}
      {isCustom && <option value={String(value)}>≥ {value}°C</option>}
    </select>
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
    <select
      id={id}
      value={value ? String(value) : 'ALL'}
      onChange={(e) => onChange(e.target.value === 'ALL' ? undefined : Number(e.target.value))}
      className={`${FORM_SELECT_CLASS} ${className}`}
    >
      <option value="ALL">{t.home.overlandDurationAny}</option>
      {OVERLAND_DURATION_PRESETS.map((hours) => (
        <option key={hours} value={String(hours)}>
          {t.home.overlandDurationUpTo.replace('{hours}', String(hours))}
        </option>
      ))}
      {isCustom && (
        <option value={String(value)}>
          {t.home.overlandDurationCustom} ({value}h)
        </option>
      )}
    </select>
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
    <select
      id={id}
      value={value || 'ALL'}
      onChange={(e) => onChange(e.target.value === 'ALL' ? undefined : (e.target.value as BoardType))}
      className={`${FORM_SELECT_CLASS} ${className}`}
    >
      <option value="ALL">{t.home.allBoardTypes}</option>
      {BOARD_TYPE_OPTIONS.map((type) => (
        <option key={type} value={type}>
          {labels[type]}
        </option>
      ))}
    </select>
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
    <select
      id={id}
      value={value ? 'REQUIRED' : 'ANY'}
      onChange={(e) => onChange(e.target.value === 'REQUIRED')}
      title={t.home.winterSportsDesc}
      className={`${FORM_SELECT_CLASS} ${className}`}
    >
      <option value="ANY">{t.home.noSnowGuaranteeBadge}</option>
      <option value="REQUIRED">{t.home.snowGuaranteeBadge}</option>
    </select>
  );
}
