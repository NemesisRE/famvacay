'use client';

import React from 'react';
import { Compass, Sun, Mountain, Building2, Trees, Globe, Plane, Car, Train, Bus, Check, Thermometer, Snowflake } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { CarFuelType, DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import { isAllStylesSelection, isAnyLongRangeStyle, toggleLongRangeStyle } from '@/lib/optimizer/style-selection';
import { SelectDropdown } from '@/components/ui/select-dropdown';
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
}

/**
 * A plain toggle. Sub-settings of a tile (flight stops, car drivetrain, kind of long-haul trip)
 * live in a panel below the grid: a dropdown inside a tile went unnoticed.
 */
export function SelectionTile({ icon: Icon, label, hint, isSelected, onToggle }: SelectionTileProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onToggle}
      className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
        isSelected
          ? 'bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-600/25'
          : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <span className="flex items-center justify-between w-full">
        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
      </span>
      <span className="font-bold text-xs truncate block text-left w-full">{label}</span>
      <span className={`text-[10px] truncate block text-left w-full ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>{hint}</span>
    </button>
  );
}

const GRID_CLASS = 'grid grid-cols-2 gap-2.5';
const PANEL_CLASS = 'mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700';
const FIELD_LABEL_CLASS = 'text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5';

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
  const isAll = isAllStylesSelection(selectedStyles);
  // The kind of long-haul trip only narrows a search that picked long-haul trips explicitly
  const showLongRange = !isAll && selectedStyles.includes('LONGRANGE');

  const tiles: { type: DestinationType; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'ALL', label: t.home.vacationKindAll, hint: t.home.styleHintAll, icon: Compass },
    { type: 'BEACH', label: t.home.vacationKindBeach, hint: t.home.styleHintBeach, icon: Sun },
    { type: 'ALPINE', label: t.home.vacationKindAlpine, hint: t.home.styleHintAlpine, icon: Mountain },
    { type: 'CITY', label: t.home.vacationKindCity, hint: t.home.styleHintCity, icon: Building2 },
    { type: 'NATURE', label: t.home.vacationKindNature, hint: t.home.styleHintNature, icon: Trees },
    { type: 'LONGRANGE', label: t.home.vacationKindLongrange, hint: t.home.styleHintLongrange, icon: Globe },
  ];
  // Short names, so the four kinds fit in one row in every language
  const longRangeKinds: { type: DestinationType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'BEACH', label: t.home.longRangeKindBeach, icon: Sun },
    { type: 'CITY', label: t.home.longRangeKindCity, icon: Building2 },
    { type: 'NATURE', label: t.home.longRangeKindNature, icon: Trees },
    { type: 'ALPINE', label: t.home.longRangeKindAlpine, icon: Mountain },
  ];
  const anyLongRange = isAnyLongRangeStyle(longRangeStyles);

  return (
    <>
      <div className={className}>
        {tiles.map((tile) => (
          <SelectionTile
            key={tile.type}
            icon={tile.icon}
            label={tile.label}
            hint={tile.hint}
            isSelected={isAll || selectedStyles.includes(tile.type)}
            onToggle={() => onToggle(tile.type)}
          />
        ))}
      </div>
      {showLongRange && (
        <div className={`${PANEL_CLASS} space-y-2`} role="group" aria-labelledby="long-range-style-label">
          <span id="long-range-style-label" className={FIELD_LABEL_CLASS}>
            <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{t.home.longRangeStylePreference}</span>
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.home.longRangeStyleHint}</p>
          {/* Like the travel modes: all selected = any kind; with all selected a tap picks only one */}
          <div className="grid grid-cols-4 gap-1.5">
            {longRangeKinds.map(({ type, label, icon: Icon }) => {
              const active = anyLongRange || longRangeStyles.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onLongRangeStylesChange(toggleLongRangeStyle(longRangeStyles, type))}
                  className={`flex flex-col items-center justify-center gap-1 px-0.5 sm:px-1 py-2 rounded-lg border text-[10px] sm:text-[11px] font-semibold text-center leading-tight transition cursor-pointer min-w-0 ${
                    active
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
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
  /** Prefix for the ids of the settings below the tiles */
  idPrefix?: string;
}

export function TravelModeTiles({
  selectedVehicles,
  onToggle,
  maxFlightStops,
  onMaxFlightStopsChange,
  carFuelType,
  onCarFuelTypeChange,
  className = GRID_CLASS,
  idPrefix = 'travel',
}: TravelModeTilesProps) {
  const { t } = useI18n();
  const showPlane = selectedVehicles.includes('PLANE');
  const showCar = selectedVehicles.includes('CAR');

  const tiles: { type: TravelVehicle; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'PLANE', label: t.home.vehiclePlane, hint: t.home.vehicleHintPlane, icon: Plane },
    { type: 'CAR', label: t.home.vehicleCar, hint: t.home.vehicleHintCar, icon: Car },
    { type: 'TRAIN', label: t.home.vehicleTrain, hint: t.home.vehicleHintTrain, icon: Train },
    { type: 'BUS', label: t.home.vehicleBus, hint: t.home.vehicleHintBus, icon: Bus },
  ];

  return (
    <>
      <div className={className}>
        {tiles.map((tile) => (
          <SelectionTile
            key={tile.type}
            icon={tile.icon}
            label={tile.label}
            hint={tile.hint}
            isSelected={selectedVehicles.includes(tile.type)}
            onToggle={() => onToggle(tile.type)}
          />
        ))}
      </div>
      {(showPlane || showCar) && (
        <div className={`${PANEL_CLASS} grid grid-cols-1 sm:grid-cols-2 gap-3`}>
          {showPlane && (
            <div>
              <label htmlFor={`${idPrefix}-flight-stops`} className={FIELD_LABEL_CLASS}>
                <Plane className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.home.flightTransitPreference}</span>
              </label>
              <SelectDropdown
                id={`${idPrefix}-flight-stops`}
                variant="form"
                value={maxFlightStops === undefined ? 'ANY' : String(maxFlightStops)}
                onChange={(v) => onMaxFlightStopsChange(v === 'ANY' ? undefined : Number(v))}
                options={[
                  { value: 'ANY', label: t.home.flightStopsAny },
                  { value: '1', label: t.home.flightStopsMax1 },
                  { value: '0', label: t.home.flightStopsDirectOnly },
                ]}
              />
            </div>
          )}
          {showCar && (
            <div>
              <label htmlFor={`${idPrefix}-car-fuel`} className={FIELD_LABEL_CLASS}>
                <Car className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.home.carFuelPreference}</span>
              </label>
              <SelectDropdown
                id={`${idPrefix}-car-fuel`}
                variant="form"
                value={carFuelType ?? 'ANY'}
                onChange={(v) => onCarFuelTypeChange(v === 'ANY' ? undefined : (v as CarFuelType))}
                options={[
                  { value: 'ANY', label: t.home.carFuelAny },
                  { value: 'PETROL', label: t.home.fuelPetrol },
                  { value: 'DIESEL', label: t.home.fuelDiesel },
                  { value: 'ELECTRIC', label: t.home.fuelElectric },
                ]}
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t.home.carFuelHint}</p>
            </div>
          )}
        </div>
      )}
    </>
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
