'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Plane, Building2, Tag, ChevronDown, CheckCircle2 } from 'lucide-react';
import { AggregatedTripPricing } from '@/lib/pricing/types';
import { useI18n } from '@/lib/i18n/i18n-context';

interface BookingDealsPopoverProps {
  pricingDetails?: AggregatedTripPricing;
  estimatedTotalCost: number;
  originAirport: string;
  destinationAirport: string;
  className?: string;
}

export function BookingDealsPopover({
  pricingDetails,
  estimatedTotalCost,
  originAirport,
  destinationAirport,
  className = '',
}: BookingDealsPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  const { flight, lodging, deepLinks } = pricingDetails;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
        title={t.home.viewPortalDeals || 'View booking portal deals & direct links'}
      >
        <Tag className="w-3 h-3 text-blue-500" />
        <span>{t.home.viewPortalDeals || 'View Deals'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              {t.home.bookingDealsTitle || 'Travel Portal Deals & Deep-Links'}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {originAirport} ➔ {destinationAirport}
            </span>
          </div>

          <div className="space-y-3 py-3 text-xs">
            {/* Flight Section */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                  <Plane className="w-3.5 h-3.5 text-blue-600" />
                  {t.home.flightShare || 'Return Flights'}: ~{flight.totalFlightCost} €
                </span>
                <span className="text-[10px] text-slate-400">
                  (~{flight.baseAdultFare} € / adult)
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={deepLinks.googleFlights}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-1.5 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Google Flights</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={deepLinks.skyscanner}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-1.5 px-2 rounded bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Skyscanner</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Lodging Section */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  {t.home.lodgingShare || 'Lodging'}: ~{lodging.totalLodgingCost} €
                </span>
                <span className="text-[10px] text-slate-400">
                  ({lodging.nights} nights @ ~{lodging.nightlyRate} €)
                </span>
              </div>

              <div className="pt-1">
                <a
                  href={deepLinks.bookingCom}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-1.5 px-2 rounded bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Booking.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>Provider: {pricingDetails.providerSource}</span>
            <span className="font-semibold text-slate-700">Total: ~{estimatedTotalCost} €</span>
          </div>
        </div>
      )}
    </div>
  );
}

