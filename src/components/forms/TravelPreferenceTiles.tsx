'use client';

import React, { useState } from 'react';
import { Compass, Sun, Mountain, Building2, Trees, Globe, Plane, Car, Train, Bus, Check, Thermometer, Snowflake } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { CarFuelType, DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import { isAllStylesSelection } from '@/lib/optimizer/style-selection';
import { LongRangeStylePopover } from '@/components/preferences/LongRangeStylePopover';
import { FlightStopsPopover } from '@/components/preferences/FlightStopsPopover';
import { CarFuelPopover } from '@/components/preferences/CarFuelPopover';
import { MinTemperatureSelect, SnowGuaranteeSelect } from './PreferenceSelects';

/**
 * Tile selectors shared by the search form and the profile, so both pages present vacation
 * styles, travel modes and climate preferences with identical wording, order and visuals.
 */

interface SelectionTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  isSelected: boolean;
  onToggle: () => void;
  /** Inline sub-setting shown instead of the hint while selected (e.g. flight stops) */
  selectedControl?: React.ReactNode;
  /** Lift the tile above its neighbours while its inline popover is open */
  raised?: boolean;
}

export function SelectionTile({ icon: Icon, label, hint, isSelected, onToggle, selectedControl, raised }: SelectionTileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
        raised ? 'z-30' : 'z-10'
      } ${
        isSelected
          ? 'bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-600/25'
          : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
      </div>

      <span className="font-bold text-xs truncate block text-left w-full">{label}</span>

      {/* Inline controls stop their own clicks; keyboard events must not toggle the tile */}
      <div className="w-full text-left" onKeyDown={(e) => e.stopPropagation()}>
        {isSelected && selectedControl ? (
          selectedControl
        ) : (
          <span className={`text-[10px] truncate block ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>{hint}</span>
        )}
      </div>
    </div>
  );
}

const GRID_CLASS = 'grid grid-cols-2 gap-2.5';

interface VacationStyleTilesProps {
  selectedStyles: DestinationType[];
  onToggle: (style: DestinationType) => void;
  longRangeStyles: DestinationType[];
  onLongRangeStylesChange: (styles: DestinationType[]) => void;
  className?: string;
}

export function VacationStyleTiles({
  selectedStyles,
  onToggle,
  longRangeStyles,
  onLongRangeStylesChange,
  className = GRID_CLASS,
}: VacationStyleTilesProps) {
  const { t } = useI18n();
  const [longRangeMenuOpen, setLongRangeMenuOpen] = useState(false);
  const isAll = isAllStylesSelection(selectedStyles);

  const tiles: { type: DestinationType; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'ALL', label: t.home.vacationKindAll, hint: t.home.styleHintAll, icon: Compass },
    { type: 'BEACH', label: t.home.vacationKindBeach, hint: t.home.styleHintBeach, icon: Sun },
    { type: 'ALPINE', label: t.home.vacationKindAlpine, hint: t.home.styleHintAlpine, icon: Mountain },
    { type: 'CITY', label: t.home.vacationKindCity, hint: t.home.styleHintCity, icon: Building2 },
    { type: 'NATURE', label: t.home.vacationKindNature, hint: t.home.styleHintNature, icon: Trees },
    { type: 'LONGRANGE', label: t.home.vacationKindLongrange, hint: t.home.styleHintLongrange, icon: Globe },
  ];

  return (
    <div className={className}>
      {tiles.map((tile) => (
        <SelectionTile
          key={tile.type}
          icon={tile.icon}
          label={tile.label}
          hint={tile.hint}
          isSelected={isAll || selectedStyles.includes(tile.type)}
          onToggle={() => onToggle(tile.type)}
          raised={tile.type === 'LONGRANGE' && longRangeMenuOpen}
          selectedControl={
            tile.type === 'LONGRANGE' && !isAll ? (
              <LongRangeStylePopover
                longRangeStyles={longRangeStyles}
                onChange={onLongRangeStylesChange}
                isOpen={longRangeMenuOpen}
                onOpenChange={setLongRangeMenuOpen}
                t={t}
              />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

interface TravelModeTilesProps {
  selectedVehicles: TravelVehicle[];
  onToggle: (vehicle: TravelVehicle) => void;
  maxFlightStops: number | undefined;
  onMaxFlightStopsChange: (stops: number | undefined) => void;
  carFuelType: CarFuelType | undefined;
  onCarFuelTypeChange: (fuel: CarFuelType | undefined) => void;
  className?: string;
}

export function TravelModeTiles({
  selectedVehicles,
  onToggle,
  maxFlightStops,
  onMaxFlightStopsChange,
  carFuelType,
  onCarFuelTypeChange,
  className = GRID_CLASS,
}: TravelModeTilesProps) {
  const { t } = useI18n();
  const [flightStopsOpen, setFlightStopsOpen] = useState(false);
  const [carFuelOpen, setCarFuelOpen] = useState(false);

  const tiles: { type: TravelVehicle; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'PLANE', label: t.home.vehiclePlane, hint: t.home.vehicleHintPlane, icon: Plane },
    { type: 'CAR', label: t.home.vehicleCar, hint: t.home.vehicleHintCar, icon: Car },
    { type: 'TRAIN', label: t.home.vehicleTrain, hint: t.home.vehicleHintTrain, icon: Train },
    { type: 'BUS', label: t.home.vehicleBus, hint: t.home.vehicleHintBus, icon: Bus },
  ];

  return (
    <div className={className}>
      {tiles.map((tile) => (
        <SelectionTile
          key={tile.type}
          icon={tile.icon}
          label={tile.label}
          hint={tile.hint}
          isSelected={selectedVehicles.includes(tile.type)}
          onToggle={() => onToggle(tile.type)}
          raised={(tile.type === 'PLANE' && flightStopsOpen) || (tile.type === 'CAR' && carFuelOpen)}
          selectedControl={
            tile.type === 'PLANE' ? (
              <FlightStopsPopover
                maxFlightStops={maxFlightStops}
                onSelect={onMaxFlightStopsChange}
                isOpen={flightStopsOpen}
                onOpenChange={setFlightStopsOpen}
                t={t}
              />
            ) : tile.type === 'CAR' ? (
              <CarFuelPopover
                carFuelType={carFuelType}
                onSelect={onCarFuelTypeChange}
                isOpen={carFuelOpen}
                onOpenChange={setCarFuelOpen}
                t={t}
              />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

interface ClimatePreferencesPanelProps {
  showBeach: boolean;
  showAlpine: boolean;
  minBeachTemp: number | undefined;
  onMinBeachTempChange: (temp: number | undefined) => void;
  requireSnow: boolean;
  onRequireSnowChange: (required: boolean) => void;
  idPrefix?: string;
}

/**
 * Climate preferences independent of a single style tile, so they also apply to long-range
 * searches (e.g. long-haul beach >= 26 °C, long-haul ski with snow guarantee).
 */
export function ClimatePreferencesPanel({
  showBeach,
  showAlpine,
  minBeachTemp,
  onMinBeachTempChange,
  requireSnow,
  onRequireSnowChange,
  idPrefix = 'climate',
}: ClimatePreferencesPanelProps) {
  const { t } = useI18n();
  if (!showBeach && !showAlpine) return null;
  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
      <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        {t.home.climatePreferencesLabel}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {showBeach && (
          <div>
            <label htmlFor={`${idPrefix}-min-beach-temp`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {t.home.minBeachTempLabel}
            </label>
            <MinTemperatureSelect id={`${idPrefix}-min-beach-temp`} value={minBeachTemp} onChange={onMinBeachTempChange} />
          </div>
        )}
        {showAlpine && (
          <div>
            <label htmlFor={`${idPrefix}-require-snow`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {t.home.winterSportsLabel}
            </label>
            <SnowGuaranteeSelect id={`${idPrefix}-require-snow`} value={requireSnow} onChange={onRequireSnowChange} />
          </div>
        )}
      </div>
    </div>
  );
}
