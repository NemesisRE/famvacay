'use client';

import { useEffect, useCallback, useState } from 'react';
import {
  X,
  MapPin,
  ExternalLink,
  Plane,
  Clock,
  Compass,
  Navigation,
  Sun,
  Mountain,
  Building2,
  Trees,
  Globe,
} from 'lucide-react';
import { getDestinationPoint, getLocalizedDestinationLabel } from '@/lib/geo/destination-points';
import type { TravelVehicle } from '@/lib/optimizer/types';
import { DestinationType } from '@/lib/optimizer/types';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface DestinationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationCode: string;
  destinationName: string;
  destinationCity?: string;
  destinationCountry?: string;
  vacationTypes?: DestinationType[];
  flightDistanceKm?: number;
  flightDurationMinutes?: number;
  departureLocation?: string;
  originAirport?: string;
  /** Mode of the featured trip; overland trips show door-to-door time from home, not flight time. */
  travelVehicle?: TravelVehicle;
  overlandDistanceKm?: number;
  overlandDurationMinutes?: number;
}

export function DestinationMapModal({
  isOpen,
  onClose,
  destinationCode,
  destinationName,
  destinationCity,
  destinationCountry,
  vacationTypes = [],
  flightDistanceKm,
  flightDurationMinutes,
  departureLocation,
  originAirport,
  travelVehicle,
  overlandDistanceKm,
  overlandDurationMinutes,
}: DestinationMapModalProps) {
  const { t, locale } = useI18n();
  const [mapProvider, setMapProvider] = useState<'google' | 'osm'>('google');

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const airport = getDestinationPoint(destinationCode);
  const isOverland = Boolean(travelVehicle && travelVehicle !== 'PLANE');
  const lat = airport?.lat ?? 0;
  const lon = airport?.lon ?? 0;

  // Compute bounding box for OpenStreetMap embed with responsive regional framing
  const deltaLon = 0.55;
  const deltaLat = 0.35;
  const minLon = (lon - deltaLon).toFixed(4);
  const minLat = (lat - deltaLat).toFixed(4);
  const maxLon = (lon + deltaLon).toFixed(4);
  const maxLat = (lat + deltaLat).toFixed(4);

  const mapLanguage = (locale || 'de').slice(0, 2);
  const googleEmbedUrl = `https://maps.google.com/maps?q=${lat},${lon}&hl=${mapLanguage}&z=10&output=embed`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik&marker=${lat},${lon}`;
  const activeEmbedUrl = mapProvider === 'google' ? googleEmbedUrl : osmEmbedUrl;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&hl=${mapLanguage}`;
  const osmFullUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`;

  const formatFlightTime = (mins?: number) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m > 0 ? `${m}m` : ''}`;
  };

  const getStyleLabel = (style: DestinationType) => {
    switch (style) {
      case 'BEACH':
        return t.home.vacationKindBeach;
      case 'ALPINE':
      case 'SKI':
        return t.home.vacationKindAlpine;
      case 'CITY':
        return t.home.vacationKindCity;
      case 'NATURE':
        return t.home.vacationKindNature;
      case 'LONGRANGE':
        return t.home.vacationKindLongrange;
      default:
        return style;
    }
  };

  const renderStyleIcon = (style: DestinationType) => {
    switch (style) {
      case 'BEACH':
        return <Sun className="w-3 h-3 text-amber-500" />;
      case 'ALPINE':
      case 'SKI':
        return <Mountain className="w-3 h-3 text-sky-600" />;
      case 'CITY':
        return <Building2 className="w-3 h-3 text-indigo-600" />;
      case 'NATURE':
        return <Trees className="w-3 h-3 text-emerald-600" />;
      case 'LONGRANGE':
        return <Globe className="w-3 h-3 text-purple-600" />;
      default:
        return <Compass className="w-3 h-3 text-teal-600" />;
    }
  };

  // Deduplicate styles (e.g. SKI and ALPINE map to the same category)
  const uniqueStyles = Array.from(
    new Set(
      vacationTypes
        .filter((s) => s !== 'ALL')
        .map((s) => (s === 'SKI' ? 'ALPINE' : s))
    )
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-50 via-teal-50/40 to-slate-100/50 dark:from-slate-800 dark:via-slate-800/60 dark:to-teal-950/20 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600 dark:bg-teal-700 text-white flex flex-col items-center justify-center font-black text-xs shadow-xs flex-shrink-0">
              {airport?.kind === 'AIRPORT' ? (
                <>
                  <span className="leading-none">{destinationCode}</span>
                  <Plane className="w-2.5 h-2.5 mt-0.5 opacity-80" />
                </>
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="map-modal-title" className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-xl">
                  {destinationName}
                </h3>
                {uniqueStyles.map((style) => (
                  <span
                    key={style}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs"
                  >
                    {renderStyleIcon(style)}
                    <span>{getStyleLabel(style)}</span>
                  </span>
                ))}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  {getLocalizedDestinationLabel(destinationCode, locale, { city: destinationCity, country: destinationCountry }).label}
                </span>
                <span>•</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer flex-shrink-0"
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Flight & Distance Quick Metrics Bar */}
        <div className="bg-slate-50/80 dark:bg-slate-850/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">
                {isOverland ? (travelVehicle === 'TRAIN' ? t.home.overlandRailDistance : t.home.overlandRoadDistance) : 'Distance'}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {isOverland
                  ? (overlandDistanceKm ? `~${overlandDistanceKm.toLocaleString()} km` : '-')
                  : (flightDistanceKm ? `~${flightDistanceKm.toLocaleString()} km` : 'Geodesic corridor')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">
                {isOverland ? t.home.overlandDoorToDoor : 'Flight Time'}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {isOverland
                  ? (overlandDurationMinutes ? `~${formatFlightTime(overlandDurationMinutes)}` : 'Variable')
                  : (flightDurationMinutes ? `~${formatFlightTime(flightDurationMinutes)} (non-stop)` : 'Variable')}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {isOverland ? (
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <Plane className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            )}
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">Departure Origin</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                {isOverland ? (departureLocation || t.home.overlandFromHome) : (originAirport || departureLocation || 'Home')}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Map Embed */}
        <div className="relative w-full flex-1 min-h-[320px] sm:min-h-[400px] bg-slate-100 dark:bg-slate-950">
          <iframe
            title={`Map of ${destinationName}`}
            src={activeEmbedUrl}
            className="w-full h-full min-h-[320px] sm:min-h-[400px] border-0"
            loading="lazy"
          />
        </div>

        {/* Modal Footer with External Links & Provider Switcher */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setMapProvider('google')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                mapProvider === 'google'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Google Maps ({mapLanguage.toUpperCase()})
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('osm')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                mapProvider === 'osm'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              OpenStreetMap
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800 inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <span>{t.home.mapOpenGoogleMaps || 'Open in Google Maps'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={osmFullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <span>{t.home.mapOpenOsm || 'Open in OpenStreetMap'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

