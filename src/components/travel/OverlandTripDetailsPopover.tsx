'use client';

import React, { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop } from '@/components/ui/responsive-popover';
import { Car, Train, Bus, Ship, MapPin, Clock, X, ChevronDown, ExternalLink, Leaf, Wallet, BedDouble, Fuel, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { getDestinationPoint, getLocalizedDestinationLabel } from '@/lib/geo/destination-points';
import type { TravelVehicle, VehicleTravelMetrics } from '@/lib/optimizer/types';
import type { OverlandAccessClass } from '@/lib/optimizer/vehicles';

export interface OverlandTripDetailsPopoverProps {
  vehicle: Exclude<TravelVehicle, 'PLANE'>;
  vehicleDetails?: VehicleTravelMetrics;
  destinationAirport: string;
  destinationCity?: string;
  destinationCountry?: string;
  departureLocation?: string;
  departureCoords?: { lat: number; lon: number } | null;
  overlandAccess?: OverlandAccessClass;
  ferryTransitMinutes?: number;
  ferrySurchargeEur?: number;
  className?: string;
}

const VEHICLE_ICONS = { CAR: Car, TRAIN: Train, BUS: Bus } as const;

// Drives longer than this are realistically split over two days with young children.
const OVERNIGHT_STOP_THRESHOLD_MINUTES = 9 * 60;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

/**
 * Overland counterpart of FlightDetailsPopover: shown instead of flight logistics when the
 * candidate is travelled by car, train or coach. Surfaces door-to-door duration, distance,
 * round-trip cost, CO2, ferry legs and mode-appropriate planning links (route planner for the
 * car, rail/coach search for public transport) rather than airports and layovers.
 */
export function OverlandTripDetailsPopover({
  vehicle,
  vehicleDetails,
  destinationAirport,
  destinationCity,
  destinationCountry,
  departureLocation,
  departureCoords,
  overlandAccess,
  ferryTransitMinutes,
  ferrySurchargeEur,
  className = '',
}: OverlandTripDetailsPopoverProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip({ fallbackAxisSideDirection: 'end', padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const Icon = VEHICLE_ICONS[vehicle];
  const vehicleLabel =
    vehicle === 'CAR' ? t.home.vehicleCar : vehicle === 'TRAIN' ? t.home.vehicleTrain : t.home.vehicleBus;
  const durationMinutes = vehicleDetails?.durationMinutes;
  const hasFerry = overlandAccess === 'SHORT_FERRY' || overlandAccess === 'LONG_FERRY';
  const needsOvernightStop = vehicle === 'CAR' && (durationMinutes || 0) > OVERNIGHT_STOP_THRESHOLD_MINUTES;

  const destPoint = getDestinationPoint(destinationAirport);
  const localized = getLocalizedDestinationLabel(destinationAirport, locale, { city: destinationCity, country: destinationCountry });
  const destLabel = localized.city;
  const destQuery = destPoint ? `${destPoint.lat},${destPoint.lon}` : encodeURIComponent(`${destLabel} ${destinationCountry || ''}`.trim());
  const originQuery = departureCoords
    ? `${departureCoords.lat},${departureCoords.lon}`
    : encodeURIComponent(departureLocation || '');
  const travelMode = vehicle === 'CAR' ? 'driving' : 'transit';
  const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destQuery}&travelmode=${travelMode}`;
  const ticketSearchUrl =
    vehicle === 'TRAIN'
      ? `https://www.thetrainline.com/${locale === 'de' ? 'de/' : ''}`
      : vehicle === 'BUS'
      ? `https://global.flixbus.com/`
      : null;

  const fuelType = vehicle === 'CAR' ? vehicleDetails?.fuelType : undefined;
  const fuelLabel =
    fuelType === 'PETROL' ? t.home.fuelPetrol : fuelType === 'DIESEL' ? t.home.fuelDiesel : fuelType === 'ELECTRIC' ? t.home.fuelElectric : undefined;
  const chargingStops = vehicleDetails?.chargingStops || 0;
  const costNote =
    vehicle === 'CAR'
      ? (fuelType === 'ELECTRIC' ? t.home.evTripCostNote : t.home.carTripCostNote)
      : vehicle === 'TRAIN' ? t.home.trainTripCostNote : t.home.busTripCostNote;
  const distanceLabel = vehicle === 'TRAIN' ? t.home.overlandRailDistance : t.home.overlandRoadDistance;
  const homeLabel = departureLocation ? departureLocation.split(',')[0] : t.home.overlandFromHome;

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-7 inline-flex items-center gap-1.5 font-semibold text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700/60 hover:text-teal-800 dark:hover:text-teal-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-300 transition-colors cursor-pointer group shadow-2xs"
        title={t.home.overlandRouteTitle}
      >
        <Icon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="font-bold tracking-tight">{t.home.tripDetailsButton}</span>
        {durationMinutes ? (
          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 flex-shrink-0">
            {formatDuration(durationMinutes)}
          </span>
        ) : null}
        {hasFerry && <Ship className="w-3 h-3 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />}
        <ChevronDown className={`w-3 h-3 text-slate-400 group-hover:text-teal-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            className="animate-in fade-in zoom-in-95 w-80 sm:w-[380px] max-w-[95vw] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 text-slate-800 dark:text-slate-100 space-y-3"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.home.overlandRouteTitle}</span>
                <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  {vehicleLabel}
                  {fuelLabel ? ` · ${fuelLabel}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Route: home -> destination */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                <MapPin className="w-3 h-3 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span className="truncate">{homeLabel}</span>
                <span className="text-slate-400">➔</span>
                <span className="truncate font-bold text-slate-900 dark:text-slate-100">
                  {destLabel}
                  {localized.country ? `, ${localized.country}` : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {durationMinutes ? (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.home.overlandDoorToDoor}
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">{formatDuration(durationMinutes)}</div>
                </div>
              ) : null}
              {vehicleDetails?.distanceKm ? (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {distanceLabel}
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">~{vehicleDetails.distanceKm} km</div>
                </div>
              ) : null}
              {vehicleDetails ? (
                <div className="p-2 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/60">
                  <span className="text-[10px] text-teal-700 dark:text-teal-300 font-bold flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {t.home.overlandRoundTripCost}
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">~{vehicleDetails.estimatedTravelCost} €</div>
                </div>
              ) : null}
              {vehicleDetails?.co2KgEstimate ? (
                <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                    <Leaf className="w-3 h-3" />
                    {t.home.overlandCo2}
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">~{vehicleDetails.co2KgEstimate} kg</div>
                </div>
              ) : null}
            </div>

            {fuelType && vehicleDetails?.energyCostEur !== undefined && (
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold">
                  {fuelType === 'ELECTRIC' ? <Zap className="w-3 h-3 text-amber-500" /> : <Fuel className="w-3 h-3 text-slate-500" />}
                  {t.home.energyCostLabel}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">~{vehicleDetails.energyCostEur} €</span>
              </div>
            )}
            {chargingStops > 0 && (
              <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 text-[11px] flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t.home.chargingStopsLabel.replace('{count}', String(chargingStops))}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
              {costNote}
              {vehicle === 'CAR' ? ` · ${t.home.restStopsIncluded}` : ''}
            </p>

            {hasFerry && (
              <div className="p-2 rounded-lg bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/60 text-[11px] flex items-start gap-1.5 text-cyan-900 dark:text-cyan-200">
                <Ship className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{overlandAccess === 'SHORT_FERRY' ? t.home.shortFerryBadge : t.home.longFerryBadge}</strong>
                  {ferryTransitMinutes
                    ? ` · ${t.home.ferryCrossingDetail
                        .replace('{minutes}', String(ferryTransitMinutes))
                        .replace('{eur}', String(ferrySurchargeEur || 0))}`
                    : ''}
                </span>
              </div>
            )}

            {needsOvernightStop && (
              <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 text-[11px] flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <BedDouble className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t.home.overnightStopRecommended}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center py-1.5 px-2 rounded-lg font-semibold text-[11px] shadow-xs flex items-center justify-between bg-teal-600 hover:bg-teal-700 text-white transition-colors"
              >
                <span className="truncate">{t.home.openRoutePlanner}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 ml-1" />
              </a>
              {ticketSearchUrl && (
                <a
                  href={ticketSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center py-1.5 px-2 rounded-lg font-semibold text-[11px] shadow-xs flex items-center justify-between bg-slate-700 hover:bg-slate-800 text-white transition-colors"
                >
                  <span className="truncate">{vehicle === 'TRAIN' ? t.home.searchTrainTickets : t.home.searchBusTickets}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 ml-1" />
                </a>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
