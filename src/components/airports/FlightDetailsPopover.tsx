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
import {
  Plane,
  MapPin,
  Clock,
  Train,
  Car,
  Sparkles,
  X,
  ExternalLink,
  ChevronDown,
  Navigation,
  ArrowRightLeft,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { getAirportByIata, getLocalizedAirportDetails } from '@/lib/airports/airport-service';
import type { FlightLayover, FlightSegment } from '@/lib/airports/flight-routes';

export interface FlightDetailsPopoverProps {
  originAirport: string;
  destinationAirport: string;
  originName?: string;
  originCity?: string;
  originCountry?: string;
  destinationName?: string;
  destinationCity?: string;
  destinationCountry?: string;
  originDistanceKm?: number;
  originDriveMinutes?: number;
  originHighSpeedRail?: boolean;
  flightDistanceKm?: number;
  flightDurationMinutes?: number;
  departureLocation?: string;
  isArbitrage?: boolean;
  arbitrageOriginState?: string;
  arbitrageNote?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  baseAdultFare?: number;
  totalFlightCost?: number;
  isDirectFlight?: boolean;
  stops?: number;
  layovers?: FlightLayover[];
  segments?: FlightSegment[];
  directFlightPremiumMultiplier?: number;
  connectingSavingsDiscount?: number;
  className?: string;
}

export function FlightDetailsPopover({
  originAirport,
  destinationAirport,
  originName,
  originCity,
  originCountry,
  destinationName,
  destinationCity,
  destinationCountry,
  originDistanceKm,
  originDriveMinutes,
  originHighSpeedRail,
  flightDistanceKm,
  flightDurationMinutes,
  departureLocation,
  isArbitrage,
  arbitrageOriginState,
  arbitrageNote,
  startDate,
  endDate,
  adults = 2,
  baseAdultFare,
  totalFlightCost,
  isDirectFlight = true,
  stops = 0,
  layovers = [],
  segments = [],
  directFlightPremiumMultiplier,
  connectingSavingsDiscount,
  className = '',
}: FlightDetailsPopoverProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const origObj = originAirport ? getAirportByIata(originAirport) : null;
  const destObj = destinationAirport ? getAirportByIata(destinationAirport) : null;
  const localizedOrig = origObj ? getLocalizedAirportDetails(origObj, locale) : null;
  const localizedDest = destObj ? getLocalizedAirportDetails(destObj, locale) : null;

  const displayDestName = localizedDest?.name || destinationName || `${destinationCity || destinationAirport} Airport`;
  const displayDestCity = localizedDest?.city || destinationCity;
  const displayDestCountry = localizedDest?.country || destinationCountry;
  const displayOrigName = localizedOrig?.name || originName || `${originCity || originAirport} Airport`;
  const displayOrigCity = localizedOrig?.city || originCity;
  const displayOrigCountry = localizedOrig?.country || originCountry;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  // Format flight duration
  const flightDurationStr = flightDurationMinutes
    ? `${Math.floor(flightDurationMinutes / 60)}h ${(flightDurationMinutes % 60).toString().padStart(2, '0')}m`
    : '~2h 15m';

  // Format driving time to airport
  const driveTimeStr = originDriveMinutes
    ? originDriveMinutes >= 60
      ? `~${Math.floor(originDriveMinutes / 60)}h ${originDriveMinutes % 60 > 0 ? `${originDriveMinutes % 60}m` : ''}`
      : `~${originDriveMinutes}m`
    : undefined;

  const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${destinationAirport}%20from%20${originAirport}${
    startDate ? `%20on%20${startDate}` : ''
  }${endDate ? `%20through%20${endDate}` : ''}`;

  const isActuallyDirect = isDirectFlight !== false && stops === 0;

  return (
    <div className={`inline-block ${className}`}>
      {/* Interactive Trigger Button */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 px-2 py-0.5 rounded-md border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group shadow-2xs"
        title="View airport logistics, flight time, and distance from home"
      >
        <Plane className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="font-bold tracking-tight">
          {originAirport} ➔ {destinationAirport}
        </span>
        {isActuallyDirect ? (
          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-200 flex-shrink-0">
            {t.home.nonStopFlight}
          </span>
        ) : (
          <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-200 flex-shrink-0">
            {stops === 1 ? t.home.oneStopFlight : t.home.multipleStopsFlight.replace('{stops}', String(stops))}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Card anchored via FloatingPortal */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 9999,
            }}
            {...getFloatingProps()}
            className="w-84 sm:w-[420px] max-w-[95vw] bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-slate-800 transition-opacity duration-150 ease-out space-y-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Plane className="w-4 h-4 text-blue-600" />
                <span>{t.home.flightDetailsTitle}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isActuallyDirect ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {t.home.directFlight}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <ArrowRightLeft className="w-2.5 h-2.5" />
                    {stops === 1 ? t.home.oneStopFlight : t.home.multipleStopsFlight.replace('{stops}', String(stops))}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Departure Origin Airport Section */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-blue-500" />
                  {t.home.departureAirportTitle}
                </span>
                <span className="text-[11px] font-black text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200">
                  {originAirport}
                </span>
              </div>

              <div>
                <span className="block font-bold text-xs text-slate-900">
                  {displayOrigName}
                </span>
                {displayOrigCity && (
                  <span className="text-[11px] text-slate-500 block">
                    {displayOrigCity}{displayOrigCountry ? `, ${displayOrigCountry}` : ''}
                  </span>
                )}
              </div>

              {/* Distance & Drive from Home */}
              <div className="pt-1 border-t border-slate-200/70 text-[11px] space-y-1">
                {originDistanceKm !== undefined && (
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-900">~{originDistanceKm} km</strong>{' '}
                      {departureLocation ? `${t.home.distanceFromHome} (${departureLocation.split(',')[0]})` : t.home.distanceFromHome}
                    </span>
                  </div>
                )}

                {driveTimeStr && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Car className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>
                      {t.home.driveTime}: <strong className="text-slate-800">{driveTimeStr}</strong>
                    </span>
                  </div>
                )}

                {originHighSpeedRail && (
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 font-medium text-[10px]">
                    <Train className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>{t.home.railConnected} (On-Site Mainline Train Station)</span>
                  </div>
                )}

                {isArbitrage && (
                  <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-[10px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>
                      {arbitrageNote || `${t.home.arbitrageBadge} (${arbitrageOriginState || originAirport})`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Arrival Destination Airport Section */}
            <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  {t.home.destinationAirportTitle}
                </span>
                <span className="text-[11px] font-black text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                  {destinationAirport}
                </span>
              </div>

              <div>
                <span className="block font-bold text-xs text-slate-900">
                  {displayDestName}
                </span>
                {displayDestCity && (
                  <span className="text-[11px] text-slate-500 block">
                    {displayDestCity}{displayDestCountry ? `, ${displayDestCountry}` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Flight Itinerary & Stopover Breakdown for connecting routes */}
            {stops > 0 && segments.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                    {t.home.flightSegmentsTitle}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-800 bg-white px-1.5 py-0.2 rounded border border-amber-300">
                    {stops === 1 ? t.home.oneStopFlight : t.home.multipleStopsFlight.replace('{stops}', String(stops))}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {segments.map((seg, idx) => {
                    const nextLayover = layovers[idx];
                    const segDurStr = `${Math.floor(seg.durationMinutes / 60)}h ${(seg.durationMinutes % 60).toString().padStart(2, '0')}m`;
                    return (
                      <React.Fragment key={idx}>
                        <div className="p-2 rounded-lg bg-white border border-amber-200/80 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                            <span>
                              {seg.departureAirport} ({seg.departureCity || seg.departureAirport}) ➔ {seg.arrivalAirport} ({seg.arrivalCity || seg.arrivalAirport})
                            </span>
                            <span className="text-slate-600 font-semibold">{segDurStr}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                            <span>{seg.carrier || 'Flight Leg'}</span>
                            <span>~{seg.distanceKm.toLocaleString()} km</span>
                          </div>
                        </div>

                        {nextLayover && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/90 text-amber-950 font-medium text-[10px] border border-amber-300/80">
                            <Clock className="w-3 h-3 text-amber-700 flex-shrink-0" />
                            <span>
                              <strong>{t.home.layoverDuration}:</strong> {Math.floor(nextLayover.durationMinutes / 60)}h {nextLayover.durationMinutes % 60}m {t.home.connectionAtHub.replace('{hub}', nextLayover.airportCode)} ({nextLayover.city})
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Flight Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  {t.home.flightDuration}
                </span>
                <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {flightDurationStr}
                  <span className="text-[9px] font-normal text-slate-500 ml-1">
                    {isActuallyDirect ? 'non-stop' : `${stops} stop(s)`}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <Plane className="w-3 h-3 text-indigo-600" />
                  {t.home.flightDistance}
                </span>
                <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {flightDistanceKm ? `~${flightDistanceKm.toLocaleString()} km` : '—'}
                  <span className="text-[9px] font-normal text-slate-400 ml-1">geodesic</span>
                </div>
              </div>
            </div>

            {/* Fare Breakdown Summary if available */}
            {baseAdultFare !== undefined && (
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">
                    {t.home.flightShare} ({adults} adult{adults > 1 ? 's' : ''}):
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {totalFlightCost ? `~${totalFlightCost} €` : `~${baseAdultFare} € / adult`}
                  </span>
                </div>
                {isActuallyDirect ? (
                  <div className="flex items-center justify-between text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <span className="font-semibold">{t.home.directFlightPremiumBadge}</span>
                    <span className="text-emerald-700 font-bold">Non-Stop Corridor</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <span className="font-semibold">{t.home.connectingSavingsBadge}</span>
                    <span className="text-blue-700 font-bold">Connecting Savings Applied</span>
                  </div>
                )}
              </div>
            )}

            {/* Direct Google Flights Deep Link */}
            <div className="pt-1">
              <a
                href={googleFlightsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span>Check Live Flights on Google Flights</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

