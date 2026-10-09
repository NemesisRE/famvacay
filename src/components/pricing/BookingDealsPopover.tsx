'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  Plane,
  Building2,
  Tag,
  ChevronDown,
  Settings2,
  Check,
  X,
  Globe,
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
  const [mounted, setMounted] = useState(false);

  const [coords, setCoords] = useState<{ top: number; left: number; openAbove: boolean }>({
    top: 0,
    left: 0,
    openAbove: false,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const portals = getActivePortals(countryCode);
    setActivePortalsList(portals);
    setSelectedPortalIds(portals.map((p) => p.id));
  }, [countryCode]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(360, window.innerWidth - 32);
    const popoverHeight = showPortalSettings ? 460 : 380;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    const top = openAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;

    // Align with trigger right edge or clamp
    let left = rect.right - popoverWidth;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    setCoords({
      top: Math.max(8, top),
      left,
      openAbove,
    });
  }, [showPortalSettings]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowPortalSettings(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
        title={t.home.viewPortalDeals || 'View booking portal deals & direct links'}
      >
        <Tag className="w-3 h-3 text-blue-500" />
        <span>{t.home.viewPortalDeals || 'View Deals'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && mounted && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
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
        </div>,
        document.body
      )}
    </div>
  );
}
