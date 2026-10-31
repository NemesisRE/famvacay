'use client';

import React from 'react';
import { Compass, Sun, Mountain, Building2, Trees, Globe, Plane, Car, Train, Bus, Check, Thermometer, Snowflake, Armchair } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { CarFuelType, DestinationType, TravelVehicle } from '@/lib/optimizer/types';
import { isAllStylesSelection, isAllTravelDistances, type TravelDistance } from '@/lib/optimizer/style-selection';
import { LONG_HAUL_KM } from '@/lib/optimizer/distance-bands';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { CabinClassSelect, MinTemperatureSelect, OverlandDurationSelect, OverlandModeIcons, SnowGuaranteeSelect } from './PreferenceSelects';

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
 * A plain toggle. Sub-settings of a tile (flight stops, car drivetrain)
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
// Two settings side by side only where the panel itself (not the window) is wide enough: the
// search form is a narrow column next to the results on tablets and small laptops
const PANEL_GRID_CLASS = 'grid grid-cols-1 @lg:grid-cols-2 gap-3';
const FIELD_LABEL_CLASS = 'text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5';

interface VacationStyleTilesProps {
  selectedStyles: DestinationType[];
  onToggle: (style: DestinationType) => void;
  className?: string;
}

/** What the holiday should be like; like the travel modes, all selected means any style. */
export function VacationStyleTiles({ selectedStyles, onToggle, className = GRID_CLASS }: VacationStyleTilesProps) {
  const { t } = useI18n();
  const isAll = isAllStylesSelection(selectedStyles);

  const tiles: { type: DestinationType; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'BEACH', label: t.home.vacationKindBeach, hint: t.home.styleHintBeach, icon: Sun },
    { type: 'ALPINE', label: t.home.vacationKindAlpine, hint: t.home.styleHintAlpine, icon: Mountain },
    { type: 'CITY', label: t.home.vacationKindCity, hint: t.home.styleHintCity, icon: Building2 },
    { type: 'NATURE', label: t.home.vacationKindNature, hint: t.home.styleHintNature, icon: Trees },
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
        />
      ))}
    </div>
  );
}

interface TravelDistanceTilesProps {
  selectedDistances: TravelDistance[];
  onToggle: (distance: TravelDistance) => void;
  className?: string;
}

/**
 * How far the trip may go, independent of the style: short/medium haul (up to LONG_HAUL_KM) and
 * long haul. Both selected means any distance.
 */
export function TravelDistanceTiles({ selectedDistances, onToggle, className = GRID_CLASS }: TravelDistanceTilesProps) {
  const { t, locale } = useI18n();
  const km = LONG_HAUL_KM.toLocaleString(locale);
  const isAll = isAllTravelDistances(selectedDistances);
  const tiles: { type: TravelDistance; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'NEARBY', label: t.home.travelDistanceNearbyRange.replace('{km}', km), hint: t.home.travelDistanceNearby, icon: Compass },
    { type: 'LONGHAUL', label: t.home.travelDistanceLongHaulRange.replace('{km}', km), hint: t.home.vacationKindLongrange, icon: Globe },
  ];

  return (
    <div className={className}>
      {tiles.map((tile) => (
        <SelectionTile
          key={tile.type}
          icon={tile.icon}
          label={tile.label}
          hint={tile.hint}
          isSelected={isAll || selectedDistances.includes(tile.type)}
          onToggle={() => onToggle(tile.type)}
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
  cabinClass: string | undefined;
  onCabinClassChange: (cabinClass: string) => void;
  maxOverlandHours: number | undefined;
  onMaxOverlandHoursChange: (hours: number | undefined) => void;
  className?: string;
  /** Prefix for the ids of the settings below the tiles */
  idPrefix?: string;
}

/**
 * The travel modes with the settings of the selected ones in a panel below: flight stops and
 * cabin class for the plane, the maximum travel time for car, train and bus, the drivetrain
 * for the car. A setting of an unselected mode is hidden (and its value kept).
 */
export function TravelModeTiles({
  selectedVehicles,
  onToggle,
  maxFlightStops,
  onMaxFlightStopsChange,
  carFuelType,
  onCarFuelTypeChange,
  cabinClass,
  onCabinClassChange,
  maxOverlandHours,
  onMaxOverlandHoursChange,
  className = GRID_CLASS,
  idPrefix = 'travel',
}: TravelModeTilesProps) {
  const { t } = useI18n();
  const showPlane = selectedVehicles.includes('PLANE');
  const showCar = selectedVehicles.includes('CAR');
  const showOverland = selectedVehicles.some((v) => v !== 'PLANE');

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
      <div className={`${PANEL_CLASS} @container`}>
        <div className={PANEL_GRID_CLASS}>
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
          {showPlane && (
            <div>
              <label htmlFor={`${idPrefix}-cabin-class`} className={FIELD_LABEL_CLASS}>
                <Armchair className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.profile.cabinClass}</span>
              </label>
              <CabinClassSelect id={`${idPrefix}-cabin-class`} value={cabinClass} onChange={onCabinClassChange} />
            </div>
          )}
          {showOverland && (
            <div>
              <label htmlFor={`${idPrefix}-max-travel-time`} className={FIELD_LABEL_CLASS}>
                <OverlandModeIcons />
                <span>{t.home.filterByOverlandDuration}</span>
              </label>
              <OverlandDurationSelect id={`${idPrefix}-max-travel-time`} value={maxOverlandHours} onChange={onMaxOverlandHoursChange} />
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
      </div>
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
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 @container">
      <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        {t.home.climatePreferencesLabel}
      </span>
      <div className={PANEL_GRID_CLASS}>
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
