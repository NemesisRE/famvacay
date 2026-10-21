'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  Plane,
  Building2,
  Tag,
  ChevronDown,
  Settings2,
  Check,
  X,
  Sliders,
  Download,
  ParkingCircle,
  Package,
} from 'lucide-react';
import { AggregatedTripPricing } from '@/lib/pricing/types';
import { CandidateWindow } from '@/lib/optimizer/types';
import { generateVacationIcs } from '@/lib/calendar/ics-export';
import { useI18n } from '@/lib/i18n/i18n-context';
import {
  TRAVEL_PORTALS,
  TravelPortal,
  getActivePortals,
  saveActivePortalIds,
} from '@/lib/pricing/portals';

interface BookingDealsPopoverProps {
  pricingDetails?: AggregatedTripPricing;
  estimatedTotalCost: number;
  originAirport: string;
  originAirports?: string[];
  destinationAirport: string;
  countryCode?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  className?: string;
  /** Full candidate window, used for the .ics export and Park-Sleep-Fly notice. */
  candidate?: CandidateWindow;
}

function downloadIcsFile(candidate: CandidateWindow, pricingDetails?: AggregatedTripPricing) {
  const ics = generateVacationIcs({
    destinationName: candidate.destinationName || candidate.destinationAirport,
    originAirport: candidate.originAirport,
    destinationAirport: candidate.destinationAirport,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    totalWeekdays: candidate.totalWeekdays,
    publicHolidaysCount: candidate.publicHolidaysCount,
    ptoDaysConsumed: candidate.ptoDaysConsumed,
    estimatedTotalCost: candidate.estimatedTotalCost,
    pricePerPerson: candidate.pricePerPerson,
    deepLinks: pricingDetails?.deepLinks,
  });

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `famvacay-${candidate.destinationAirport}-${candidate.startDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BookingDealsPopover({
  pricingDetails,
  estimatedTotalCost,
  originAirport,
  originAirports,
  destinationAirport,
  countryCode = 'DE',
  startDate,
  endDate,
  adults,
  className = '',
  candidate,
}: BookingDealsPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showPortalSettings, setShowPortalSettings] = useState(false);
  const [activePortalsList, setActivePortalsList] = useState<TravelPortal[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-end',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  useEffect(() => {
    const portals = getActivePortals(countryCode);
    setActivePortalsList(portals);
    setSelectedPortalIds(portals.map((p) => p.id));
  }, [countryCode]);

  const sDate = startDate || '';
  const eDate = endDate || '';

  if (!pricingDetails) {
    return null;
  }

  const { flight, lodging } = pricingDetails;

  const togglePortal = (portalId: string) => {
    let nextIds: string[];
    if (selectedPortalIds.includes(portalId)) {
      if (selectedPortalIds.length <= 1) return; // Keep at least one portal
      nextIds = selectedPortalIds.filter((id) => id !== portalId);
    } else {
      nextIds = [...selectedPortalIds, portalId];
    }
    setSelectedPortalIds(nextIds);
    saveActivePortalIds(nextIds);
    setActivePortalsList(TRAVEL_PORTALS.filter((p) => nextIds.includes(p.id)));
  };

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger Button: Standardized dimensions matching Flight Details */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-7 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
        title={t.home.viewPortalDeals || 'View booking portal deals & direct links'}
      >
        <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        <span>{t.home.viewPortalDeals || 'View Deals'}</span>
        <ChevronDown className={`w-3 h-3 text-teal-600 dark:text-teal-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Card anchored via Floating UI FloatingPortal */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 9999,
            }}
            {...getFloatingProps()}
            className="w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 text-slate-800 dark:text-slate-100 transition-opacity duration-150 ease-out"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.home.bookingDealsTitle || 'Travel Portal Deals'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {originAirport} ➔ {destinationAirport}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPortalSettings(!showPortalSettings)}
                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                    showPortalSettings ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40' : 'text-slate-400 dark:text-slate-500'
                  }`}
                  title="Customize preferred booking portals"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowPortalSettings(false);
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Portal Customization Panel */}
            {showPortalSettings ? (
              <div className="py-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    {t.home.customizePortals}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPortalSettings(false)}
                    className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Select your preferred portals based on your region (DACH, Oceania, North America, Global):
                </p>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {TRAVEL_PORTALS.map((portal) => {
                    const isChecked = selectedPortalIds.includes(portal.id);
                    return (
                      <button
                        key={portal.id}
                        type="button"
                        onClick={() => togglePortal(portal.id)}
                        className={`text-left p-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isChecked
                            ? 'border-teal-400 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <span className="truncate">{portal.name}</span>
                        {isChecked && <Check className="w-3 h-3 text-teal-600 dark:text-teal-400 flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-3 text-xs">
                {/* Trip Cost Breakdown Summary */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/60">
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 font-bold flex items-center gap-1">
                      <Plane className="w-3 h-3" />
                      {t.home.flightShare || 'Return Flights'}
                    </span>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
                      ~{flight.totalFlightCost} €
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                        (~{flight.baseAdultFare} € / pp)
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {t.home.lodgingShare || 'Lodging'}
                    </span>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
                      ~{lodging.totalLodgingCost} €
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                        (~{lodging.nightlyRate} € / n)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Package Tour Child Fixed-Price Discount (Kinderfestpreis) vs. Modular Booking */}
                {pricingDetails.packageTourDeal && (
                  <div className="p-2 rounded-lg bg-violet-50/70 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/60 text-[11px] flex items-start gap-1.5">
                    <Package className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                    <span className="text-violet-800 dark:text-violet-300">
                      {pricingDetails.packageTourDeal.cheaperStrategy === 'PACKAGE'
                        ? (t.home.packageTourCheaper || 'Package tour (Kinderfestpreis) is cheaper by')
                        : (t.home.modularCheaper || 'Modular flight + apartment booking is cheaper by')}
                      {' '}
                      <strong>{pricingDetails.packageTourDeal.savingsEur} €</strong>
                      {' '}
                      ({pricingDetails.packageTourDeal.packagePriceEur} € {t.home.packageWord || 'package'} vs.{' '}
                      {pricingDetails.packageTourDeal.modularPriceEur} € {t.home.modularWord || 'modular'})
                    </span>
                  </div>
                )}

                {/* Park-Sleep-Fly notice when airport driving duration exceeds 90 minutes */}
                {candidate?.parkSleepFlyRecommended && (
                  <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 text-[11px] flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <ParkingCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t.home.parkSleepFlyNotice || 'Long drive to the airport - consider a Park & Sleep & Fly hotel (+130 €)'}</span>
                  </div>
                )}

                {/* Direct Booking Portal Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Compare Live Rates Across Providers:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {activePortalsList.map((portal) => {
                      const partyAdults = pricingDetails.party?.adults ?? adults ?? 2;
                      const url = portal.buildUrl({
                        originAirport,
                        originAirports,
                        destinationAirport,
                        startDate: sDate,
                        endDate: eDate,
                        childrenAges: pricingDetails.party?.childrenAges,
                        adults: partyAdults,
                      });

                      return (
                        <a
                          key={portal.id}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-center py-1.5 px-2 rounded-lg font-semibold text-[11px] shadow-xs flex items-center justify-between transition-colors ${portal.colorClass}`}
                        >
                          <span className="truncate">{portal.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                            {portal.badge && (
                              <span className="text-[8px] uppercase font-extrabold bg-white/20 px-1 py-0.2 rounded">
                                {portal.badge}
                              </span>
                            )}
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Transparency Notice + .ics Export */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 gap-2">
              <span className="truncate">Prices estimated from live seasonality benchmarks.</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {candidate && (
                  <button
                    type="button"
                    onClick={() => downloadIcsFile(candidate, pricingDetails)}
                    title={t.home.downloadIcs || 'Download .ics'}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="font-bold text-slate-700 dark:text-slate-200">{estimatedTotalCost} € Total</span>
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
