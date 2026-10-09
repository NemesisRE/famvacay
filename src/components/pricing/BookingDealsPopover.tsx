'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AggregatedTripPricing } from '@/lib/pricing/types';
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
  destinationAirport: string;
  countryCode?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
}

export function BookingDealsPopover({
  pricingDetails,
  estimatedTotalCost,
  originAirport,
  destinationAirport,
  countryCode = 'DE',
  startDate,
  endDate,
  className = '',
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

  if (!pricingDetails) {
    return null;
  }

  const { flight, lodging } = pricingDetails;
  const sDate = startDate || new Date().toISOString().split('T')[0];
  const eDate = endDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

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
      {/* Trigger Button: Smooth, anchored reference */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
        title={t.home.viewPortalDeals || 'View booking portal deals & direct links'}
      >
        <Tag className="w-3 h-3 text-blue-500" />
        <span>{t.home.viewPortalDeals || 'View Deals'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            className="w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-slate-800 transition-opacity duration-150 ease-out"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.home.bookingDealsTitle || 'Travel Portal Deals'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {originAirport} ➔ {destinationAirport}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPortalSettings(!showPortalSettings)}
                  className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                    showPortalSettings ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
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
                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Portal Customization Panel */}
            {showPortalSettings ? (
              <div className="py-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-blue-600" />
                    Customize Active Portals
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPortalSettings(false)}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
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
                            ? 'border-blue-400 bg-blue-50 text-blue-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{portal.name}</span>
                        {isChecked && <Check className="w-3 h-3 text-blue-600 flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-3 text-xs">
                {/* Trip Cost Breakdown Summary */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                    <span className="text-[10px] text-blue-700 font-bold flex items-center gap-1">
                      <Plane className="w-3 h-3" />
                      {t.home.flightShare || 'Return Flights'}
                    </span>
                    <div className="font-extrabold text-slate-900 text-xs mt-0.5">
                      ~{flight.totalFlightCost} €
                      <span className="text-[9px] font-normal text-slate-400 ml-1">
                        (~{flight.baseAdultFare} € / pp)
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {t.home.lodgingShare || 'Lodging'}
                    </span>
                    <div className="font-extrabold text-slate-900 text-xs mt-0.5">
                      ~{lodging.totalLodgingCost} €
                      <span className="text-[9px] font-normal text-slate-400 ml-1">
                        (~{lodging.nightlyRate} € / n)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Booking Portal Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Compare Live Rates Across Providers:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {activePortalsList.map((portal) => {
                      const url = portal.buildUrl({
                        originAirport,
                        destinationAirport,
                        startDate: sDate,
                        endDate: eDate,
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

            {/* Footer Transparency Notice */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Prices estimated from live seasonality benchmarks.</span>
              <span className="font-bold text-slate-700">{estimatedTotalCost} € Total</span>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
