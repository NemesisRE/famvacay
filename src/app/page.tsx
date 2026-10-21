'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Plane,
  Car,
  Train,
  Bus,
  Sun,
  Award,
  AlertCircle,
  Sparkles,
  Filter,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  Info,
  MapPin,
  Compass,
  Mountain,
  Building2,
  Trees,
  Globe,
  List,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  X,
  RotateCcw,
  Snowflake,
  ChevronsUpDown,
  ChevronsDownUp,
  ShieldCheck,
  Utensils,
  Share2,
  Loader2,
  Wallet,
  Ship,
  ThumbsUp,
  ThumbsDown,
  Star,
  BadgeCheck,
} from 'lucide-react';
import { differenceInYears, addDays } from 'date-fns';
import { CandidateWindow, DestinationType, TravelVehicle, BoardType } from '@/lib/optimizer/types';
import { curateDistinctAlternativeWindows } from '@/lib/optimizer/curation';
import { MetricExplanationPopover } from '@/components/metrics/MetricExplanationPopover';
import { useI18n } from '@/lib/i18n/i18n-context';
import {
  COUNTRIES,
  getCountryCodeFromSubdivision,
  getAllCountries,
  getLocalizedCountryName,
  getDeterministicCountryList,
} from '@/lib/regions/subdivisions';
import { AirportSelector } from '@/components/airports/AirportSelector';
import { getAirportByIata, getLocalizedAirportDetails } from '@/lib/airports/airport-service';
import { LocationInput, GeocodedLocation } from '@/components/geo/LocationInput';
import { ChildrenSelector, ChildItem } from '@/components/family/ChildrenSelector';
import { MultiDestinationInput } from '@/components/destination/MultiDestinationInput';
import { ClimateDetailsPopover } from '@/components/climate/ClimateDetailsPopover';
import { BookingDealsPopover } from '@/components/pricing/BookingDealsPopover';
import { FlightDetailsPopover } from '@/components/airports/FlightDetailsPopover';
import { getLocalizedSeasonalWarning } from '@/lib/optimizer/localized-warnings';
import { DestinationMapModal } from '@/components/destination/DestinationMapModal';
import { DestinationSafetyPopover } from '@/components/destination/DestinationSafetyPopover';
import { DestinationFilterDropdown, DestinationOption } from '@/components/destination/DestinationFilterDropdown';
import { getDestinationVacationStyles } from '@/lib/optimizer/destination-styles';
import { getAnnualSpecialTimes, SpecialHolidayPeriod } from '@/lib/holidays/special-dates';
import { BeachTemperaturePopover } from '@/components/preferences/BeachTemperaturePopover';
import { FlightStopsPopover } from '@/components/preferences/FlightStopsPopover';
import { DateRangePicker } from '@/components/calendar/DateRangePicker';

export default function HomePage() {
  const { status } = useSession();
  const { locale, t, formatDate, formatCurrency } = useI18n();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const allCountries = useMemo(() => {
    if (!mounted) {
      return getDeterministicCountryList();
    }
    return getAllCountries(locale);
  }, [mounted, locale]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultEarliest = useMemo(
    () => addDays(new Date(), 14).toISOString().split('T')[0],
    []
  );
  const defaultLatest = useMemo(
    () => addDays(new Date(), 90).toISOString().split('T')[0],
    []
  );

  // 1. Departure & School District State
  const [departureLocation, setDepartureLocation] = useState('Karlsruhe, Germany');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lon: number } | null>({
    lat: 49.0069,
    lon: 8.4037,
  });
  const [country, setCountry] = useState('DE');
  const [federalState, setFederalState] = useState('DE-BW');

  // 2. Travel Destinations & Vacation Style State (default open/all discovery, multi-selectable)
  const [selectedStyles, setSelectedStyles] = useState<DestinationType[]>(['ALL']);
  const [targetDestinations, setTargetDestinations] = useState<string[]>([]);

  const vacationStyles: {
    type: DestinationType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = useMemo(
    () => [
      { type: 'ALL', label: t.home.vacationKindAll, icon: Compass },
      { type: 'BEACH', label: t.home.vacationKindBeach, icon: Sun },
      { type: 'ALPINE', label: t.home.vacationKindAlpine, icon: Mountain },
      { type: 'CITY', label: t.home.vacationKindCity, icon: Building2 },
      { type: 'NATURE', label: t.home.vacationKindNature, icon: Trees },
      { type: 'LONGRANGE', label: t.home.vacationKindLongrange, icon: Globe },
    ],
    [t]
  );

  const ALL_SPECIFIC_STYLES: DestinationType[] = useMemo(
    () => ['BEACH', 'ALPINE', 'CITY', 'NATURE', 'LONGRANGE'],
    []
  );

  const isAllStylesSelected =
    selectedStyles.includes('ALL') ||
    (selectedStyles.length >= 5 && ALL_SPECIFIC_STYLES.every((s) => selectedStyles.includes(s)));

  const toggleVacationStyle = (style: DestinationType) => {
    if (style === 'ALL') {
      setSelectedStyles(['ALL']);
      return;
    }

    setSelectedStyles((prev) => {
      const prevIsAll =
        prev.includes('ALL') ||
        (prev.length >= 5 && ALL_SPECIFIC_STYLES.every((s) => prev.includes(s)));

      if (prevIsAll) {
        return [style];
      }
      if (prev.includes(style)) {
        const next = prev.filter((s) => s !== style);
        return next.length === 0 ? ['ALL'] : next;
      }
      const next = [...prev, style];
      if (ALL_SPECIFIC_STYLES.every((s) => next.includes(s))) {
        return ['ALL'];
      }
      return next;
    });
  };

  const getStyleMeta = (type: DestinationType) => {
    switch (type) {
      case 'BEACH':
        return { label: t.home.vacationKindBeach, icon: Sun, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'ALPINE':
      case 'SKI':
        return { label: t.home.vacationKindAlpine, icon: Mountain, color: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'CITY':
        return { label: t.home.vacationKindCity, icon: Building2, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'NATURE':
        return { label: t.home.vacationKindNature, icon: Trees, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'LONGRANGE':
        return { label: t.home.vacationKindLongrange, icon: Globe, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: type, icon: Compass, color: 'bg-teal-50 text-teal-700 border-teal-200' };
    }
  };

  const getDedupedStyleMetas = (styles?: DestinationType[]) => {
    if (!styles || styles.length === 0) return [];
    const map = new Map<string, ReturnType<typeof getStyleMeta>>();
    for (const st of styles) {
      if (st === 'ALL') continue;
      const meta = getStyleMeta(st);
      if (!map.has(meta.label)) {
        map.set(meta.label, meta);
      }
    }
    return Array.from(map.values());
  };

  const getVehicleMeta = (vehicle?: TravelVehicle) => {
    switch (vehicle) {
      case 'CAR':
        return {
          label: t.home.vehicleCar,
          icon: Car,
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'TRAIN':
        return {
          label: t.home.vehicleTrain,
          icon: Train,
          color: 'bg-teal-50 text-teal-700 border-teal-200',
        };
      case 'BUS':
        return {
          label: t.home.vehicleBus,
          icon: Bus,
          color: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'PLANE':
      default:
        return {
          label: t.home.vehiclePlane,
          icon: Plane,
          color: 'bg-sky-50 text-sky-700 border-sky-200',
        };
    }
  };

  const getFormattedLocalizedDestination = useCallback(
    (destCode: string, fallbackName?: string) => {
      const airport = getAirportByIata(destCode);
      if (!airport) return fallbackName || destCode;
      const locAirport = getLocalizedAirportDetails(airport, locale);
      if (locAirport.city && locAirport.country) {
        return `${locAirport.city}, ${locAirport.country}`;
      }
      return locAirport.name || fallbackName || destCode;
    },
    [locale]
  );

  // 3. Flight / Origin Airports State
  const [originAirports, setOriginAirports] = useState<string[]>(['FKB', 'STR', 'FRA']);

  // 4. Travelers Party Composition (Adults & Children)
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenList, setChildrenList] = useState<ChildItem[]>([]);

  // 5. Duration Range
  const [durationDaysMin, setDurationDaysMin] = useState(10);
  const [durationDaysMax, setDurationDaysMax] = useState(14);

  // 6. Date Boundaries
  const [earliestDate, setEarliestDate] = useState(defaultEarliest);
  const [latestDate, setLatestDate] = useState(defaultLatest);
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [selectedVehicles, setSelectedVehicles] = useState<TravelVehicle[]>(['PLANE']);

  const toggleVehicle = (vehicle: TravelVehicle) => {
    setSelectedVehicles((prev) => {
      if (prev.includes(vehicle)) {
        if (prev.length === 1) return prev; // Do not allow deselecting all
        return prev.filter((v) => v !== vehicle);
      }
      return [...prev, vehicle];
    });
  };

  // Vacation style specific constraints: Minimum beach temperature & Winter sports / Snow guarantee
  const [minBeachTemp, setMinBeachTemp] = useState<number | undefined>(undefined);
  const [requireSnow, setRequireSnow] = useState<boolean>(false);
  const [showBeachTempMenu, setShowBeachTempMenu] = useState(false);
  const [showFlightStopsMenu, setShowFlightStopsMenu] = useState(false);
  const [preferredBoardType, setPreferredBoardType] = useState<BoardType | undefined>(undefined);
  const [maxOverlandDurationHours, setMaxOverlandDurationHours] = useState<number | undefined>(undefined);
  const [maxFlightStops, setMaxFlightStops] = useState<number | undefined>(undefined);

  // 7. Blackout Dates (Starts empty by default, loaded from profile if configured)
  const [searchBlackouts, setSearchBlackouts] = useState<
    { startDate: string; endDate: string; reason?: string }[]
  >([]);
  const [isAddingBlackout, setIsAddingBlackout] = useState(false);

  // Profile preferences & travel comfort state
  const [preferredCabinClass, setPreferredCabinClass] = useState<string | undefined>(undefined);
  const [travelModes, setTravelModes] = useState<string[] | undefined>(undefined);

  // Profile sync states
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Search Results & Filter / Pagination State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidateWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [shareCopiedToast, setShareCopiedToast] = useState<boolean>(false);
  const [liveEnrichedPrices, setLiveEnrichedPrices] = useState<Record<string, { estimatedTotalCost: number; pricePerPerson: number }>>({});
  const [voterName, setVoterName] = useState<string>('');
  const [voteTallies, setVoteTallies] = useState<Record<string, { upvotes: number; favorites: number; vetoes: number }>>({});

  const [viewMode, setViewMode] = useState<'list' | 'destination' | 'timeframe'>('destination');
  const [selectedDestinationsList, setSelectedDestinationsList] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [maxCostFilter, setMaxCostFilter] = useState<number | undefined>(undefined);
  const [schoolHolidayFilter, setSchoolHolidayFilter] = useState<'all' | 'holidaysOnly'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'pto' | 'duration' | 'date-asc' | 'date-desc'>('score');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [timeframePageSize, setTimeframePageSize] = useState<number>(4);
  const [timeframeCurrentPage, setTimeframeCurrentPage] = useState<number>(1);
  const [expandedDestinations, setExpandedDestinations] = useState<Record<string, boolean>>({});
  const [expandedTimeframes, setExpandedTimeframes] = useState<Record<string, boolean>>({});
  const [destinationSearchFilter, setDestinationSearchFilter] = useState<string>('');
  const [selectedCountryFilters, setSelectedCountryFilters] = useState<string[]>([]);
  const toggleCountryFilter = (countryName: string) => {
    setSelectedCountryFilters((prev) =>
      prev.includes(countryName)
        ? prev.filter((c) => c !== countryName)
        : [...prev, countryName]
    );
  };
  const [resultStyleFilter, setResultStyleFilter] = useState<DestinationType>('ALL');
  const [distanceFilter, setDistanceFilter] = useState<string>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');
  const [safetyFilter, setSafetyFilter] = useState<'SAFE_ONLY' | 'ALL'>('SAFE_ONLY');
  const [warningFilter, setWarningFilter] = useState<'CLEAN_ONLY' | 'ALL'>('CLEAN_ONLY');
  const [heatFilter, setHeatFilter] = useState<'ALL' | 'AVOID_EXTREME_HEAT'>('ALL');
  const [boardTypeFilter, setBoardTypeFilter] = useState<string>('ALL');
  const [overlandDurationFilter, setOverlandDurationFilter] = useState<string>('ALL');
  const [flightStopsFilter, setFlightStopsFilter] = useState<string>('ALL'); // 'ALL' | 'DIRECT_ONLY' | 'MAX_1_STOP'
  const [showResultFilters, setShowResultFilters] = useState<boolean>(false);
  const [isDestinationSearchOpen, setIsDestinationSearchOpen] = useState<boolean>(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedDestinationsList.length > 0) count++;
    if (selectedMonth !== 'ALL') count++;
    if (resultStyleFilter !== 'ALL') count++;
    if (distanceFilter !== 'ALL') count++;
    if (vehicleFilter !== 'ALL') count++;
    if (safetyFilter !== 'SAFE_ONLY') count++;
    if (warningFilter !== 'CLEAN_ONLY') count++;
    if (heatFilter !== 'ALL') count++;
    if (boardTypeFilter !== 'ALL') count++;
    if (overlandDurationFilter !== 'ALL') count++;
    if (flightStopsFilter !== 'ALL') count++;
    if (schoolHolidayFilter !== 'all') count++;
    if (maxCostFilter !== undefined && maxCostFilter > 0) count++;
    if (sortBy !== 'score') count++;
    return count;
  }, [
    selectedDestinationsList,
    selectedMonth,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    heatFilter,
    boardTypeFilter,
    overlandDurationFilter,
    flightStopsFilter,
    schoolHolidayFilter,
    maxCostFilter,
    sortBy,
  ]);

  const resetAllFilters = () => {
    setSelectedDestinationsList([]);
    setSelectedMonth('ALL');
    setResultStyleFilter('ALL');
    setDistanceFilter('ALL');
    setVehicleFilter('ALL');
    setSafetyFilter('SAFE_ONLY');
    setWarningFilter('CLEAN_ONLY');
    setHeatFilter('ALL');
    setBoardTypeFilter('ALL');
    setOverlandDurationFilter('ALL');
    setFlightStopsFilter('ALL');
    setSchoolHolidayFilter('all');
    setMaxCostFilter(undefined);
    setSortBy('score');
    setCurrentPage(1);
    setTimeframeCurrentPage(1);
  };

  // Map Modal State
  const [mapModalDestination, setMapModalDestination] = useState<{
    destinationCode: string;
    destinationName: string;
    destinationCity?: string;
    destinationCountry?: string;
    vacationTypes?: DestinationType[];
    flightDistanceKm?: number;
    flightDurationMinutes?: number;
    originAirport?: string;
  } | null>(null);

  const vehicleOptions: {
    type: TravelVehicle;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hint: string;
  }[] = useMemo(() => {
    const isDe = locale.startsWith('de');
    return [
      {
        type: 'PLANE',
        label: t.home.vehiclePlane,
        icon: Plane,
        hint: isDe ? 'Direkt- & Gabelflüge' : 'Flights & corridors',
      },
      {
        type: 'CAR',
        label: t.home.vehicleCar,
        icon: Car,
        hint: isDe ? 'Flexibel über Land' : 'Road trip & overland',
      },
      {
        type: 'TRAIN',
        label: t.home.vehicleTrain,
        icon: Train,
        hint: isDe ? 'Entspannt auf Schiene' : 'Rail & scenic transit',
      },
      {
        type: 'BUS',
        label: t.home.vehicleBus,
        icon: Bus,
        hint: isDe ? 'Günstig per Fernbus' : 'Coach & budget transit',
      },
    ];
  }, [t, locale]);

  const [hasRestoredFromStorage, setHasRestoredFromStorage] = useState(false);

  // Restore form and filter state, plus recent search results from localStorage
  useEffect(() => {
    try {
      const savedForm = localStorage.getItem('famvac_form_state');
      if (savedForm) {
        const parsed = JSON.parse(savedForm);
        if (parsed.departureLocation) setDepartureLocation(parsed.departureLocation);
        if (parsed.departureCoords) setDepartureCoords(parsed.departureCoords);
        if (parsed.country) setCountry(parsed.country);
        if (parsed.federalState) setFederalState(parsed.federalState);
        if (Array.isArray(parsed.selectedStyles) && parsed.selectedStyles.length > 0) setSelectedStyles(parsed.selectedStyles);
        if (Array.isArray(parsed.targetDestinations)) setTargetDestinations(parsed.targetDestinations);
        if (Array.isArray(parsed.originAirports) && parsed.originAirports.length > 0) setOriginAirports(parsed.originAirports);
        if (typeof parsed.adultsCount === 'number') setAdultsCount(parsed.adultsCount);
        if (Array.isArray(parsed.childrenList)) setChildrenList(parsed.childrenList);
        if (typeof parsed.durationDaysMin === 'number') setDurationDaysMin(parsed.durationDaysMin);
        if (typeof parsed.durationDaysMax === 'number') setDurationDaysMax(parsed.durationDaysMax);
        if (parsed.earliestDate) setEarliestDate(parsed.earliestDate);
        if (parsed.latestDate) setLatestDate(parsed.latestDate);
        if (parsed.maxBudget !== undefined) setMaxBudget(parsed.maxBudget);
        if (Array.isArray(parsed.selectedVehicles) && parsed.selectedVehicles.length > 0) {
          setSelectedVehicles(parsed.selectedVehicles);
        } else if (parsed.travelVehicle) {
          setSelectedVehicles([parsed.travelVehicle]);
        }
        if (typeof parsed.minBeachTemp === 'number') setMinBeachTemp(parsed.minBeachTemp);
        if (typeof parsed.requireSnow === 'boolean') setRequireSnow(parsed.requireSnow);
        if (parsed.preferredBoardType) setPreferredBoardType(parsed.preferredBoardType);
        if (typeof parsed.maxOverlandDurationHours === 'number') setMaxOverlandDurationHours(parsed.maxOverlandDurationHours);
        if (typeof parsed.maxFlightStops === 'number') setMaxFlightStops(parsed.maxFlightStops);
        if (parsed.preferredCabinClass) setPreferredCabinClass(parsed.preferredCabinClass);
        if (Array.isArray(parsed.searchBlackouts)) setSearchBlackouts(parsed.searchBlackouts);
      }

      const savedFilters = localStorage.getItem('famvac_filter_settings');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (Array.isArray(parsed.selectedDestinationsList)) setSelectedDestinationsList(parsed.selectedDestinationsList);
        if (parsed.selectedMonth) setSelectedMonth(parsed.selectedMonth);
        if (parsed.maxCostFilter !== undefined) setMaxCostFilter(parsed.maxCostFilter);
        if (parsed.schoolHolidayFilter) setSchoolHolidayFilter(parsed.schoolHolidayFilter);
        if (parsed.sortBy) setSortBy(parsed.sortBy);
        if (parsed.pageSize) setPageSize(parsed.pageSize);
        if (parsed.destinationSearchFilter !== undefined) setDestinationSearchFilter(parsed.destinationSearchFilter);
        if (parsed.selectedCountryFilters && Array.isArray(parsed.selectedCountryFilters)) {
          setSelectedCountryFilters(parsed.selectedCountryFilters);
        } else if (parsed.destinationCountryFilter && parsed.destinationCountryFilter !== 'ALL') {
          setSelectedCountryFilters([parsed.destinationCountryFilter]);
        }
        if (parsed.resultStyleFilter) setResultStyleFilter(parsed.resultStyleFilter);
        if (parsed.distanceFilter) setDistanceFilter(parsed.distanceFilter);
        if (parsed.vehicleFilter) setVehicleFilter(parsed.vehicleFilter);
        if (parsed.safetyFilter) setSafetyFilter(parsed.safetyFilter);
        if (parsed.warningFilter) setWarningFilter(parsed.warningFilter);
        if (parsed.boardTypeFilter) setBoardTypeFilter(parsed.boardTypeFilter);
        if (parsed.overlandDurationFilter) setOverlandDurationFilter(parsed.overlandDurationFilter);
        if (parsed.flightStopsFilter) setFlightStopsFilter(parsed.flightStopsFilter);
      }

      // Check URL parameters for shared search state, view mode, and filter states
      const urlParams = new URLSearchParams(window.location.search);
      let shareParam = urlParams.get('s') || urlParams.get('share');
      if (!shareParam && window.location.hash) {
        const hashMatch = window.location.hash.match(/^#s=([a-zA-Z0-9_-]+)/);
        if (hashMatch) shareParam = hashMatch[1];
      }

      // URL parameters take precedence over localStorage for direct links & sharing
      const urlView = urlParams.get('view');
      if (urlView === 'list' || urlView === 'destination' || urlView === 'timeframe') {
        setViewMode(urlView);
      }
      const urlDest = urlParams.get('dest');
      if (urlDest) {
        setSelectedDestinationsList(urlDest.split(',').filter(Boolean));
      }
      const urlMonth = urlParams.get('month');
      if (urlMonth) setSelectedMonth(urlMonth);
      const urlStyle = urlParams.get('style');
      if (urlStyle) setResultStyleFilter(urlStyle as DestinationType);
      const urlDist = urlParams.get('dist');
      if (urlDist) setDistanceFilter(urlDist);
      const urlVehicle = urlParams.get('vehicle');
      if (urlVehicle) setVehicleFilter(urlVehicle);
      const urlSafety = urlParams.get('safety');
      if (urlSafety === 'SAFE_ONLY' || urlSafety === 'ALL') setSafetyFilter(urlSafety);
      const urlWarning = urlParams.get('warning');
      if (urlWarning === 'CLEAN_ONLY' || urlWarning === 'ALL') setWarningFilter(urlWarning);
      const urlHeat = urlParams.get('heat');
      if (urlHeat === 'ALL' || urlHeat === 'AVOID_EXTREME_HEAT') setHeatFilter(urlHeat);
      const urlBoard = urlParams.get('board');
      if (urlBoard) setBoardTypeFilter(urlBoard);
      const urlStops = urlParams.get('stops');
      if (urlStops) setFlightStopsFilter(urlStops);
      const urlHoliday = urlParams.get('holiday');
      if (urlHoliday === 'all' || urlHoliday === 'holidaysOnly') setSchoolHolidayFilter(urlHoliday);
      const urlMaxCost = urlParams.get('maxcost');
      if (urlMaxCost && Number(urlMaxCost) > 0) setMaxCostFilter(Number(urlMaxCost));
      const urlSort = urlParams.get('sort');
      if (urlSort) setSortBy(urlSort as any);

      if (shareParam) {
        fetch(`/api/vacations/share?id=${encodeURIComponent(shareParam)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((res) => {
            if (res && res.success && res.payload) {
              const { formState, windows, shareId } = res.payload;
              if (Array.isArray(windows) && windows.length > 0) {
                setResults(windows);
                setActiveShareId(shareId || shareParam);
                if (formState) {
                  if (formState.departureLocation) setDepartureLocation(formState.departureLocation);
                  if (formState.departureCoords) setDepartureCoords(formState.departureCoords);
                  if (formState.country) setCountry(formState.country);
                  if (formState.federalState) setFederalState(formState.federalState);
                  if (Array.isArray(formState.selectedStyles) && formState.selectedStyles.length > 0) setSelectedStyles(formState.selectedStyles);
                  if (Array.isArray(formState.targetDestinations)) setTargetDestinations(formState.targetDestinations);
                  if (Array.isArray(formState.originAirports) && formState.originAirports.length > 0) setOriginAirports(formState.originAirports);
                  if (typeof formState.adultsCount === 'number') setAdultsCount(formState.adultsCount);
                  if (Array.isArray(formState.childrenList)) setChildrenList(formState.childrenList);
                  if (typeof formState.durationDaysMin === 'number') setDurationDaysMin(formState.durationDaysMin);
                  if (typeof formState.durationDaysMax === 'number') setDurationDaysMax(formState.durationDaysMax);
                  if (formState.earliestDate) setEarliestDate(formState.earliestDate);
                  if (formState.latestDate) setLatestDate(formState.latestDate);
                  if (formState.maxBudget !== undefined) setMaxBudget(formState.maxBudget);
                  if (Array.isArray(formState.selectedVehicles) && formState.selectedVehicles.length > 0) setSelectedVehicles(formState.selectedVehicles);
                  if (formState.preferredBoardType) setPreferredBoardType(formState.preferredBoardType);
                  if (typeof formState.minBeachTemp === 'number') setMinBeachTemp(formState.minBeachTemp);
                  if (typeof formState.requireSnow === 'boolean') setRequireSnow(formState.requireSnow);
                  if (typeof formState.maxFlightStops === 'number') setMaxFlightStops(formState.maxFlightStops);
                  if (typeof formState.maxOverlandDurationHours === 'number') setMaxOverlandDurationHours(formState.maxOverlandDurationHours);
                }
              }
            }
          })
          .catch((err) => console.warn('[Share Hydration Failed]', err));
      } else {
        const savedResults = localStorage.getItem('famvac_cached_results');
        if (savedResults) {
          const parsed = JSON.parse(savedResults);
          const ageHours = (Date.now() - (parsed.timestamp || 0)) / (1000 * 60 * 60);
          // Restore recent search results if less than 2.5 hours old
          if (ageHours < 2.5 && Array.isArray(parsed.windows) && parsed.windows.length > 0) {
            setResults(parsed.windows);
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setHasRestoredFromStorage(true);
    }
  }, []);

  // Restore the remembered voter display name used for shared-board voting
  useEffect(() => {
    try {
      const saved = localStorage.getItem('famvac_voter_name');
      if (saved) setVoterName(saved);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save form state to localStorage on changes
  useEffect(() => {
    if (!hasRestoredFromStorage) return;
    try {
      const stateToSave = {
        departureLocation,
        departureCoords,
        country,
        federalState,
        selectedStyles,
        targetDestinations,
        originAirports,
        adultsCount,
        childrenList,
        durationDaysMin,
        durationDaysMax,
        earliestDate,
        latestDate,
        maxBudget,
        selectedVehicles,
        travelVehicle: selectedVehicles[0] || 'PLANE',
        minBeachTemp,
        requireSnow,
        preferredBoardType,
        maxOverlandDurationHours,
        maxFlightStops,
        preferredCabinClass,
        searchBlackouts,
      };
      localStorage.setItem('famvac_form_state', JSON.stringify(stateToSave));
    } catch {
      // Storage error
    }
  }, [
    hasRestoredFromStorage,
    departureLocation,
    departureCoords,
    country,
    federalState,
    selectedStyles,
    targetDestinations,
    originAirports,
    adultsCount,
    childrenList,
    durationDaysMin,
    durationDaysMax,
    earliestDate,
    latestDate,
    maxBudget,
    selectedVehicles,
    minBeachTemp,
    requireSnow,
    preferredBoardType,
    maxOverlandDurationHours,
    maxFlightStops,
    preferredCabinClass,
    searchBlackouts,
  ]);

  // Save filter settings to localStorage on changes
  useEffect(() => {
    if (!hasRestoredFromStorage) return;
    try {
      const filtersToSave = {
        viewMode,
        selectedDestinationsList,
        selectedMonth,
        maxCostFilter,
        schoolHolidayFilter,
        sortBy,
        pageSize,
        destinationSearchFilter,
        selectedCountryFilters,
        resultStyleFilter,
        distanceFilter,
        vehicleFilter,
        safetyFilter,
        warningFilter,
        boardTypeFilter,
        overlandDurationFilter,
        flightStopsFilter,
      };
      localStorage.setItem('famvac_filter_settings', JSON.stringify(filtersToSave));
    } catch {
      // Storage error
    }
  }, [
    hasRestoredFromStorage,
    viewMode,
    selectedDestinationsList,
    selectedMonth,
    maxCostFilter,
    schoolHolidayFilter,
    sortBy,
    pageSize,
    destinationSearchFilter,
    selectedCountryFilters,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    boardTypeFilter,
    overlandDurationFilter,
    flightStopsFilter,
  ]);

  // Synchronize viewMode and active filters to URL search parameters without page reload
  useEffect(() => {
    if (!hasRestoredFromStorage) return;
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      if (viewMode !== 'destination') params.set('view', viewMode);
      else params.delete('view');

      if (selectedDestinationsList.length > 0) params.set('dest', selectedDestinationsList.join(','));
      else params.delete('dest');

      if (selectedMonth !== 'ALL') params.set('month', selectedMonth);
      else params.delete('month');

      if (resultStyleFilter !== 'ALL') params.set('style', resultStyleFilter);
      else params.delete('style');

      if (distanceFilter !== 'ALL') params.set('dist', distanceFilter);
      else params.delete('dist');

      if (vehicleFilter !== 'ALL') params.set('vehicle', vehicleFilter);
      else params.delete('vehicle');

      if (safetyFilter !== 'SAFE_ONLY') params.set('safety', safetyFilter);
      else params.delete('safety');

      if (warningFilter !== 'CLEAN_ONLY') params.set('warning', warningFilter);
      else params.delete('warning');

      if (heatFilter !== 'ALL') params.set('heat', heatFilter);
      else params.delete('heat');

      if (boardTypeFilter !== 'ALL') params.set('board', boardTypeFilter);
      else params.delete('board');

      if (flightStopsFilter !== 'ALL') params.set('stops', flightStopsFilter);
      else params.delete('stops');

      if (schoolHolidayFilter !== 'all') params.set('holiday', schoolHolidayFilter);
      else params.delete('holiday');

      if (maxCostFilter !== undefined && maxCostFilter > 0) params.set('maxcost', String(maxCostFilter));
      else params.delete('maxcost');

      if (sortBy !== 'score') params.set('sort', sortBy);
      else params.delete('sort');

      const nextUrl = url.pathname + (params.toString() ? `?${params.toString()}` : '') + url.hash;
      window.history.replaceState(null, '', nextUrl);
    } catch {
      // Ignore URL replacement errors in restricted environments
    }
  }, [
    hasRestoredFromStorage,
    viewMode,
    selectedDestinationsList,
    selectedMonth,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    heatFilter,
    boardTypeFilter,
    flightStopsFilter,
    schoolHolidayFilter,
    maxCostFilter,
    sortBy,
  ]);

  const handleResetForm = () => {
    try {
      localStorage.removeItem('famvac_form_state');
      localStorage.removeItem('famvac_filter_settings');
      localStorage.removeItem('famvac_cached_results');
    } catch {}
    setDepartureLocation('Karlsruhe, Germany');
    setDepartureCoords({ lat: 49.0069, lon: 8.4037 });
    setCountry('DE');
    setFederalState('DE-BW');
    setSelectedStyles(['ALL']);
    setTargetDestinations([]);
    setOriginAirports(['FKB', 'STR', 'FRA']);
    setAdultsCount(2);
    setChildrenList([]);
    setDurationDaysMin(10);
    setDurationDaysMax(14);
    setEarliestDate(defaultEarliest);
    setLatestDate(defaultLatest);
    setMaxBudget(undefined);
    setSelectedVehicles(['PLANE']);
    setMinBeachTemp(undefined);
    setRequireSnow(false);
    setPreferredBoardType(undefined);
    setMaxOverlandDurationHours(undefined);
    setMaxFlightStops(undefined);
    setPreferredCabinClass(undefined);
    setSearchBlackouts([]);
    setResults(null);
  };

  // Auto-prefill if family profile exists
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/family-profile')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then(async (data) => {
        if (data?.profile) {
          const p = data.profile;
          if (p.homeLocation) {
            try {
              const geoRes = await fetch(
                `/api/locations/geocode?q=${encodeURIComponent(p.homeLocation)}`
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.locations && geoData.locations.length > 0) {
                  const loc0 = geoData.locations[0];
                  const cityName = loc0.city || loc0.name;
                  const parts: string[] = [];
                  if (loc0.postcode && !loc0.name.includes(loc0.postcode)) {
                    parts.push(`${loc0.postcode} ${cityName}`);
                  } else {
                    parts.push(cityName);
                  }
                  if (loc0.state && loc0.state !== cityName) parts.push(loc0.state);
                  if (loc0.country) parts.push(loc0.country);
                  const formatted = parts.join(', ');

                  setDepartureLocation(formatted);
                  setDepartureCoords({
                    lat: loc0.lat,
                    lon: loc0.lon,
                  });
                } else {
                  setDepartureLocation(p.homeLocation);
                }
              } else {
                setDepartureLocation(p.homeLocation);
              }
            } catch (err) {
              setDepartureLocation(p.homeLocation);
              console.error('Failed to geocode saved home location:', err);
            }
          }

          if (p.federalState) {
            setFederalState(p.federalState);
            setCountry(getCountryCodeFromSubdivision(p.federalState));
          }

          if (Array.isArray(p.originAirports) && p.originAirports.length > 0) {
            setOriginAirports(p.originAirports);
          }

          if (Array.isArray(p.members) && p.members.length > 0) {
            const adultMembers = p.members.filter(
              (m: any) => m.role === 'PARENT' || m.role === 'MEMBER' || m.role === 'OTHER' || (m.role !== 'CHILD' && m.role !== 'INFANT')
            );
            if (adultMembers.length > 0) {
              setAdultsCount(adultMembers.length);
            } else if (typeof p.adultsCount === 'number' && p.adultsCount >= 1) {
              setAdultsCount(p.adultsCount);
            }

            const childMembers = p.members.filter(
              (m: any) => m.role === 'CHILD' || m.role === 'INFANT'
            );
            if (childMembers.length > 0) {
              setChildrenList(
                childMembers.map((m: any) => ({
                  id: m.id || Math.random().toString(36).substring(2, 9),
                  birthDate: m.birthDate ? m.birthDate.split('T')[0] : '2020-01-01',
                }))
              );
            }
          } else if (typeof p.adultsCount === 'number' && p.adultsCount >= 1) {
            setAdultsCount(p.adultsCount);
          } else if (Array.isArray(p.memberships) && p.memberships.length > 0) {
            setAdultsCount(p.memberships.length);
          }

          if (Array.isArray(p.blackoutRanges) && p.blackoutRanges.length > 0) {
            setSearchBlackouts(
              p.blackoutRanges.map((b: any) => ({
                startDate: b.startDate ? b.startDate.split('T')[0] : '',
                endDate: b.endDate ? b.endDate.split('T')[0] : '',
                reason: b.reason || '',
              }))
            );
          }

          if (p.preferredCabinClass) {
            setPreferredCabinClass(p.preferredCabinClass);
          }
          if (Array.isArray(p.travelModes) && p.travelModes.length > 0) {
            setTravelModes(p.travelModes);
            const normalizedVehicles = p.travelModes
              .map((m: string) => (m === 'FLIGHT' ? 'PLANE' : m === 'CAMPER' ? 'CAR' : m))
              .filter((m: string): m is TravelVehicle => ['PLANE', 'CAR', 'TRAIN', 'BUS'].includes(m));
            if (normalizedVehicles.length > 0) {
              setSelectedVehicles([...new Set(normalizedVehicles)] as TravelVehicle[]);
            }
          }
          if (p.maxTravelHours !== null && p.maxTravelHours !== undefined) {
            setMaxOverlandDurationHours(Number(p.maxTravelHours));
          }
          if (p.scoringWeights) {
            const sw = typeof p.scoringWeights === 'string' ? JSON.parse(p.scoringWeights) : p.scoringWeights;
            if (sw.preferredBoardType) {
              setPreferredBoardType(sw.preferredBoardType);
            }
            if (sw.preferredVacationStyle && sw.preferredVacationStyle !== 'ALL') {
              setSelectedStyles([sw.preferredVacationStyle === 'SKI' ? 'ALPINE' : sw.preferredVacationStyle]);
            }
            if ((p.maxTravelHours === null || p.maxTravelHours === undefined) && sw.maxOverlandTravelMinutes) {
              setMaxOverlandDurationHours(Math.round(sw.maxOverlandTravelMinutes / 60));
            }
            if (typeof sw.minBeachTemp === 'number') {
              setMinBeachTemp(sw.minBeachTemp);
            }
            if (typeof sw.requireSnow === 'boolean') {
              setRequireSnow(sw.requireSnow);
            }
            if (typeof sw.maxFlightStops === 'number') {
              setMaxFlightStops(sw.maxFlightStops);
            }
          }

          setProfileLoaded(true);
        }
      })
      .catch(() => {});
  }, [status]);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryData = COUNTRIES[newCountry];
    if (countryData && countryData.subdivisions.length > 0) {
      if (!countryData.subdivisions.some((s) => s.code === federalState)) {
        setFederalState(countryData.subdivisions[0].code);
      }
    } else {
      setFederalState(newCountry);
    }
  };

  const handleLocationChange = (
    loc: string,
    coords?: { lat: number; lon: number },
    locationData?: GeocodedLocation
  ) => {
    setDepartureLocation(loc);
    if (coords) {
      setDepartureCoords(coords);
    }
    if (locationData && locationData.countryCode) {
      const cCode = locationData.countryCode.toUpperCase();
      const countryData = COUNTRIES[cCode];
      setCountry(cCode);

      if (countryData && countryData.subdivisions.length > 0) {
        let matchedSub = '';
        if (locationData.state) {
          const normState = locationData.state.toLowerCase().trim();
          const found = countryData.subdivisions.find(
            (s) =>
              s.name.toLowerCase().trim() === normState ||
              normState.includes(s.name.toLowerCase().trim()) ||
              s.name.toLowerCase().trim().includes(normState)
          );
          if (found) {
            matchedSub = found.code;
          }
        }
        if (!matchedSub) {
          matchedSub = countryData.subdivisions[0].code;
        }
        setFederalState(matchedSub);
      } else {
        setFederalState(cCode);
      }
    }
  };

  const addBlackout = () => {
    setIsAddingBlackout(true);
    setSearchBlackouts([...searchBlackouts, { startDate: '', endDate: '', reason: '' }]);
  };

  const removeBlackout = (index: number) => {
    const next = searchBlackouts.filter((_, i) => i !== index);
    setSearchBlackouts(next);
    if (next.length === 0) {
      setIsAddingBlackout(false);
    }
  };

  const updateBlackout = (index: number, field: 'startDate' | 'endDate' | 'reason', val: string) => {
    const updated = [...searchBlackouts];
    updated[index] = { ...updated[index], [field]: val };
    setSearchBlackouts(updated);
  };

  const updateBlackoutRange = (index: number, start: string, end: string) => {
    const updated = [...searchBlackouts];
    updated[index] = { ...updated[index], startDate: start, endDate: end };
    setSearchBlackouts(updated);
  };

  // Moving annual special holiday periods (Easter, Pentecost, Ascension, Corpus Christi, Christmas/Silvester)
  const annualSpecialTimes = useMemo(() => {
    const startYear = earliestDate ? new Date(earliestDate).getFullYear() : new Date().getFullYear();
    const endYear = latestDate ? new Date(latestDate).getFullYear() : startYear;
    const yearSet = new Set<number>([startYear, endYear]);
    if (endYear === startYear) {
      yearSet.add(startYear + 1);
    }
    const years = Array.from(yearSet).filter((y) => !isNaN(y) && y >= 2024 && y <= 2040);

    const result: (SpecialHolidayPeriod & { displayName: string })[] = [];
    for (const yr of years) {
      const list = getAnnualSpecialTimes(yr, locale);
      for (const item of list) {
        if (item.endDate >= todayStr) {
          result.push({
            ...item,
            displayName: years.length > 1 ? `${item.name} '${String(yr).slice(-2)}` : item.name,
          });
        }
      }
    }
    return result.slice(0, 8);
  }, [earliestDate, latestDate, locale, todayStr]);

  const toggleSpecialPeriod = (period: SpecialHolidayPeriod) => {
    const existingIdx = searchBlackouts.findIndex(
      (b) => b.startDate === period.startDate && b.endDate === period.endDate
    );
    if (existingIdx >= 0) {
      const next = searchBlackouts.filter((_, i) => i !== existingIdx);
      setSearchBlackouts(next);
      if (next.length === 0) {
        setIsAddingBlackout(false);
      }
    } else {
      setIsAddingBlackout(true);
      setSearchBlackouts((prev) => [
        ...prev,
        {
          startDate: period.startDate,
          endDate: period.endDate,
          reason: period.name,
        },
      ]);
    }
  };

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    try {
      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);
      const minDur = Number(durationDaysMin) || 7;
      const maxDur = Math.max(minDur, Number(durationDaysMax) || minDur);

      const tripDate = earliestDate ? new Date(earliestDate) : new Date();
      const computedAges = childrenList
        .map((c) => {
          const b = new Date(c.birthDate);
          return isNaN(b.getTime()) ? 6 : Math.max(0, differenceInYears(tripDate, b));
        })
        .sort((a, b) => a - b);

      const childrenBirthDates = childrenList
        .map((c) => c.birthDate)
        .filter(Boolean);

      const hasDestinations = targetDestinations.length > 0;
      const isBeachSelected = isAllStylesSelected || selectedStyles.includes('BEACH');
      const isAlpineSelected = isAllStylesSelected || selectedStyles.includes('ALPINE');

      const payload = {
        targetDestinations: hasDestinations ? targetDestinations : undefined,
        destinationTypes: hasDestinations ? undefined : (isAllStylesSelected ? undefined : selectedStyles),
        destinationType: hasDestinations ? undefined : (selectedStyles.length === 1 && !isAllStylesSelected ? selectedStyles[0] : undefined),
        minBeachTemp: (!hasDestinations && isBeachSelected) ? minBeachTemp : undefined,
        requireSnow: (!hasDestinations && isAlpineSelected) ? requireSnow : false,
        preferredBoardType,
        maxOverlandTravelMinutes: maxOverlandDurationHours ? maxOverlandDurationHours * 60 : undefined,
        maxFlightStops,
        avoidExtremeHeat: heatFilter === 'AVOID_EXTREME_HEAT',
        durationDays: minDur,
        durationDaysMin: minDur,
        durationDaysMax: maxDur,
        earliestDate,
        latestDate,
        maxBudgetTotal: maxBudget ? Number(maxBudget) : undefined,
        strictSchoolHolidays: false,
        travelVehicle: selectedVehicles[0] || 'PLANE',
        travelVehicles: selectedVehicles,
        searchBlackouts: validBlackouts,
        userProfile: {
          homeLocation: departureLocation,
          departureLat: departureCoords?.lat,
          departureLon: departureCoords?.lon,
          federalState,
          originAirports,
          adults: adultsCount,
          childrenAges: computedAges,
          childrenBirthDates,
          blackoutRanges: validBlackouts,
          preferredCabinClass,
          travelModes,
          maxFlightStops,
        },
      };

      const res = await fetch('/api/vacations/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Optimization request failed');
      }

      const data = await res.json();
      setResults(data.windows);
      setSelectedDestinationsList([]);
      setTimeframeCurrentPage(1);
      try {
        localStorage.setItem(
          'famvac_cached_results',
          JSON.stringify({ timestamp: Date.now(), windows: data.windows })
        );
      } catch {
        // Storage quota / disabled
      }

      // Persist results for reload-safety and direct shareable URL
      fetch('/api/vacations/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: payload,
          formState: {
            departureLocation,
            departureCoords,
            country,
            federalState,
            selectedStyles,
            targetDestinations,
            originAirports,
            adultsCount,
            childrenList,
            durationDaysMin,
            durationDaysMax,
            earliestDate,
            latestDate,
            maxBudget,
            selectedVehicles,
            preferredBoardType,
            minBeachTemp,
            requireSnow,
            maxFlightStops,
            maxOverlandDurationHours,
          },
          windows: data.windows,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((shareData) => {
          if (shareData?.shareId) {
            setActiveShareId(shareData.shareId);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('s', shareData.shareId);
            window.history.replaceState(null, '', newUrl.toString());
          }
        })
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleShareSearch = async () => {
    if (!results || results.length === 0) return;
    try {
      let shareId = activeShareId;
      if (!shareId) {
        const res = await fetch('/api/vacations/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formState: {
              departureLocation,
              departureCoords,
              country,
              federalState,
              selectedStyles,
              targetDestinations,
              originAirports,
              adultsCount,
              childrenList,
              durationDaysMin,
              durationDaysMax,
              earliestDate,
              latestDate,
              maxBudget,
              selectedVehicles,
              preferredBoardType,
              minBeachTemp,
              requireSnow,
              maxFlightStops,
              maxOverlandDurationHours,
            },
            windows: results,
          }),
        });
        const data = await res.json();
        if (data.shareId) {
          const newShareId: string = data.shareId;
          shareId = newShareId;
          setActiveShareId(newShareId);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('s', newShareId);
          window.history.replaceState(null, '', newUrl.toString());
        }
      }
      if (shareId) {
        const finalShareId: string = shareId;
        const shareUrl = `${window.location.origin}/?s=${finalShareId}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareCopiedToast(true);
        setTimeout(() => setShareCopiedToast(false), 3000);
      }
    } catch (err) {
      console.warn('Share copy failed:', err);
    }
  };

  // Filtered and Sorted Results
  const filteredResults = useMemo(() => {
    if (!results) return [];
    let list = [...results];

    // Destination multi-select filter across all views
    if (selectedDestinationsList.length > 0) {
      list = list.filter((w) => selectedDestinationsList.includes(w.destinationAirport));
    }

    if (selectedMonth !== 'ALL') {
      list = list.filter((w) => {
        const m = w.startDate.split('-')[1];
        return m === selectedMonth;
      });
    }

    if (resultStyleFilter !== 'ALL') {
      list = list.filter((w) => {
        const styles = getDestinationVacationStyles(w.destinationAirport, w.flightDistanceKm);
        if (resultStyleFilter === 'BEACH') {
          return styles.includes('BEACH') && !styles.includes('LONGRANGE');
        }
        return styles.includes(resultStyleFilter);
      });
    }

    if (distanceFilter !== 'ALL') {
      list = list.filter((w) => {
        const dist = w.flightDistanceKm || 0;
        switch (distanceFilter) {
          case 'SHORT':
            return dist <= 1000;
          case 'MID':
            return dist <= 2500;
          case 'EXTENDED':
            return dist <= 3500;
          case 'LONG':
            return dist <= 6000;
          case 'INTERCONTINENTAL':
            return dist > 3500;
          default:
            return true;
        }
      });
    }

    if (vehicleFilter !== 'ALL') {
      list = list.filter((w) => {
        return (
          w.travelVehicle === vehicleFilter ||
          (w.availableVehicles && w.availableVehicles.includes(vehicleFilter as TravelVehicle))
        );
      });
    }

    if (safetyFilter === 'SAFE_ONLY') {
      list = list.filter((w) => {
        const s = w.destinationSafety || w.safetyAssessment;
        return s ? s.isSafe : true;
      });
    }

    if (warningFilter === 'CLEAN_ONLY') {
      list = list.filter((w) => !w.seasonalWarning || w.seasonalWarning.seasonType === 'EXTREME_HEAT');
    }

    if (heatFilter === 'AVOID_EXTREME_HEAT') {
      list = list.filter((w) => w.seasonalWarning?.seasonType !== 'EXTREME_HEAT');
    }

    if (boardTypeFilter !== 'ALL') {
      list = list.filter((w) => w.boardType === boardTypeFilter);
    }

    if (overlandDurationFilter !== 'ALL') {
      const maxMinutes = Number(overlandDurationFilter);
      list = list.filter((w) => {
        if (w.travelVehicle === 'PLANE') return true;
        if (!w.vehicleDetails?.durationMinutes) return true;
        return w.vehicleDetails.durationMinutes <= maxMinutes;
      });
    }

    if (flightStopsFilter === 'DIRECT_ONLY') {
      list = list.filter((w) => {
        if (w.travelVehicle !== 'PLANE') return true;
        return w.isDirectFlight || w.flightStops === 0;
      });
    } else if (flightStopsFilter === 'MAX_1_STOP') {
      list = list.filter((w) => {
        if (w.travelVehicle !== 'PLANE') return true;
        return (w.flightStops ?? 0) <= 1;
      });
    }

    if (schoolHolidayFilter === 'holidaysOnly') {
      list = list.filter((w) => !w.requiresSchoolExemption);
    }

    if (maxCostFilter !== undefined && maxCostFilter > 0) {
      list = list.filter((w) => w.estimatedTotalCost <= maxCostFilter);
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.estimatedTotalCost - b.estimatedTotalCost;
        case 'pto':
          return b.ptoEfficiencyRatio - a.ptoEfficiencyRatio;
        case 'duration':
          return b.durationDays - a.durationDays;
        case 'date-asc':
          return a.startDate.localeCompare(b.startDate);
        case 'date-desc':
          return b.startDate.localeCompare(a.startDate);
        case 'score':
        default:
          return b.finalScore - a.finalScore;
      }
    });

    return list;
  }, [
    results,
    viewMode,
    selectedDestinationsList,
    selectedMonth,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    heatFilter,
    boardTypeFilter,
    overlandDurationFilter,
    flightStopsFilter,
    schoolHolidayFilter,
    maxCostFilter,
    sortBy,
  ]);

  const activeQueryDestinations = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, { code: string; name: string; country?: string; count: number }>();
    for (const w of results) {
      const existing = map.get(w.destinationAirport);
      if (existing) {
        existing.count++;
      } else {
        map.set(w.destinationAirport, {
          code: w.destinationAirport,
          name: getFormattedLocalizedDestination(w.destinationAirport, w.destinationName),
          country: w.destinationCountry,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [results, locale]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const displayedResults = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredResults.slice(startIdx, startIdx + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  const liveEnrichKeyFor = (win: CandidateWindow) =>
    `${win.originAirport}|${win.destinationAirport}|${win.startDate}|${win.endDate}`;

  // Asynchronous BYOK Live Price Enrichment: after the deterministic CSP results render,
  // silently request a live quote for the top 5 visible cards. If no provider is configured
  // or the request fails, the benchmark price is kept as-is (no error surfaced to the user).
  useEffect(() => {
    const topCards = displayedResults.slice(0, 5);
    if (topCards.length === 0) return;

    let cancelled = false;

    for (const win of topCards) {
      const key = liveEnrichKeyFor(win);
      if (liveEnrichedPrices[key]) continue;

      const ages = childrenList.map((c) => {
        const b = new Date(c.birthDate);
        return isNaN(b.getTime()) ? 6 : Math.max(0, differenceInYears(new Date(win.startDate), b));
      });

      fetch('/api/pricing/live-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originAirport: win.originAirport,
          destinationAirport: win.destinationAirport,
          startDate: win.startDate,
          endDate: win.endDate,
          durationDays: win.durationDays,
          party: { adults: adultsCount, childrenAges: ages, cabinClass: preferredCabinClass },
          isArbitrage: win.isArbitrageOpportunity,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (cancelled || !res?.success || !res.live || !res.pricing) return;
          setLiveEnrichedPrices((prev) => ({
            ...prev,
            [key]: {
              estimatedTotalCost: res.pricing.totalCost,
              pricePerPerson: res.pricing.pricePerPerson,
            },
          }));
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedResults, adultsCount, childrenList, preferredCabinClass]);

  const getInitialVoteTally = (win: CandidateWindow) => {
    const votes = win.votes || [];
    return {
      upvotes: votes.filter((v) => v.vote === 1).length,
      favorites: votes.filter((v) => v.vote === 2).length,
      vetoes: votes.filter((v) => v.vote === -1).length,
    };
  };

  const submitSharedBoardVote = async (win: CandidateWindow, vote: -1 | 1 | 2) => {
    const candidateId = win.shareCandidateId;
    if (!candidateId || !activeShareId) return;

    let name = voterName;
    if (!name) {
      name = (window.prompt(t.home.enterVoterNamePrompt) || '').trim();
      if (!name) return;
      try {
        localStorage.setItem('famvac_voter_name', name);
      } catch {
        // Ignore localStorage errors
      }
      setVoterName(name);
    }

    try {
      const res = await fetch(`/api/vacations/share/${encodeURIComponent(activeShareId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, voterName: name, vote }),
      });
      const data = await res.json();
      if (data?.success && data.tally) {
        setVoteTallies((prev) => ({ ...prev, [candidateId]: data.tally }));
      }
    } catch (err) {
      console.warn('[Shared Board Vote Failed]', err);
    }
  };

  // Destination Groups
  const destinationGroups = useMemo(() => {
    if (!filteredResults || filteredResults.length === 0) return [];

    const map = new Map<string, CandidateWindow[]>();
    for (const w of filteredResults) {
      const list = map.get(w.destinationAirport) || [];
      list.push(w);
      map.set(w.destinationAirport, list);
    }

    const groups = Array.from(map.entries()).map(([destCode, windows]) => {
      const featured = windows[0];
      const styles = getDestinationVacationStyles(destCode, featured.flightDistanceKm);
      const lowestPrice = Math.min(...windows.map((w) => w.estimatedTotalCost));
      const highestScore = Math.max(...windows.map((w) => w.finalScore));
      const destName = getFormattedLocalizedDestination(destCode, featured.destinationName);
      const alternativeWindows = curateDistinctAlternativeWindows(windows, featured, 8);

      return {
        destinationCode: destCode,
        destinationName: destName,
        destinationCity: featured.destinationCity,
        destinationCountry: featured.destinationCountry,
        destinationSafety: featured.destinationSafety || featured.safetyAssessment,
        vacationType: styles[0] || 'CITY',
        vacationStyles: styles,
        featuredWindow: featured,
        alternativeWindows,
        lowestPrice,
        highestScore,
        totalWindows: windows.length,
      };
    });

    groups.sort((g1, g2) => {
      switch (sortBy) {
        case 'price':
          return g1.lowestPrice - g2.lowestPrice;
        case 'date-asc':
          return g1.featuredWindow.startDate.localeCompare(g2.featuredWindow.startDate);
        case 'date-desc':
          return g2.featuredWindow.startDate.localeCompare(g1.featuredWindow.startDate);
        case 'pto':
          return g2.featuredWindow.ptoEfficiencyRatio - g1.featuredWindow.ptoEfficiencyRatio;
        case 'duration':
          return g2.featuredWindow.durationDays - g1.featuredWindow.durationDays;
        case 'score':
        default:
          return g2.highestScore - g1.highestScore;
      }
    });

    return groups;
  }, [filteredResults, sortBy, locale, getFormattedLocalizedDestination]);

  const expandAllDestinations = () => {
    const all: Record<string, boolean> = {};
    destinationGroups.forEach((g) => {
      all[g.destinationCode] = true;
    });
    setExpandedDestinations(all);
  };

  const collapseAllDestinations = () => {
    setExpandedDestinations({});
  };

  // Timeframe Groups (Grouped by Month/Period)
  const timeframeGroups = useMemo(() => {
    if (!filteredResults || filteredResults.length === 0) return [];

    const map = new Map<string, CandidateWindow[]>();
    for (const w of filteredResults) {
      const ym = w.startDate.substring(0, 7);
      const list = map.get(ym) || [];
      list.push(w);
      map.set(ym, list);
    }

    const sortedKeys = Array.from(map.keys()).sort();
    if (sortBy === 'date-desc') {
      sortedKeys.reverse();
    }

    return sortedKeys.map((ym) => {
      const windows = map.get(ym)!;
      const [yearStr, monthStr] = ym.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10) - 1;
      const monthDate = new Date(y, m, 1);
      const title = formatDate(monthDate, { month: 'long', year: 'numeric' });

      const lowestPrice = Math.min(...windows.map((w) => w.estimatedTotalCost));
      const highestScore = Math.max(...windows.map((w) => w.finalScore));
      const hasSchoolHolidays = windows.some((w) => !w.requiresSchoolExemption);

      // Interleave distinct destinations in this timeframe so first items are varied
      const destMap = new Map<string, CandidateWindow[]>();
      for (const w of windows) {
        const l = destMap.get(w.destinationAirport) || [];
        l.push(w);
        destMap.set(w.destinationAirport, l);
      }
      const sortedDestKeys = Array.from(destMap.keys());
      const interleaved: CandidateWindow[] = [];
      let round = 0;
      let hasMore = true;
      while (hasMore) {
        hasMore = false;
        for (const k of sortedDestKeys) {
          const l = destMap.get(k)!;
          if (round < l.length) {
            interleaved.push(l[round]);
            if (round + 1 < l.length) hasMore = true;
          }
        }
        round++;
      }

      return {
        key: ym,
        title,
        windows: sortBy === 'score' ? interleaved : windows,
        lowestPrice,
        highestScore,
        hasSchoolHolidays,
      };
    });
  }, [filteredResults, sortBy, formatDate]);

  const timeframeTotalPages = Math.max(1, Math.ceil(timeframeGroups.length / timeframePageSize));
  const displayedTimeframeGroups = useMemo(() => {
    const startIdx = (timeframeCurrentPage - 1) * timeframePageSize;
    return timeframeGroups.slice(startIdx, startIdx + timeframePageSize);
  }, [timeframeGroups, timeframeCurrentPage, timeframePageSize]);

  const toggleDestinationExpand = (destCode: string) => {
    setExpandedDestinations((prev) => ({
      ...prev,
      [destCode]: !prev[destCode],
    }));
  };

  const toggleTimeframeExpand = (key: string) => {
    setExpandedTimeframes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Extract available months from search results
  const availableMonths = useMemo(() => {
    if (!results) return [];
    const monthSet = new Set<string>();
    results.forEach((w) => {
      const m = w.startDate.split('-')[1];
      if (m) monthSet.add(m);
    });
    return Array.from(monthSet).sort();
  }, [results]);

  const formatLocalizedDate = (dateStr: string, withWeekday: boolean = false) => {
    try {
      if (withWeekday) {
        return formatDate(dateStr, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
      return formatDate(dateStr, { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderVacationCard = (
    win: CandidateWindow,
    options?: { rank?: number; hideDestinationHeader?: boolean }
  ) => {
    return (
      <div
        key={`${win.startDate}-${win.originAirport}-${win.destinationAirport}-${win.durationDays}`}
        className="bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow relative"
      >
        {/* Arbitrage Banner */}
        {win.isArbitrageOpportunity && (
          <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 flex items-center justify-between -mx-5 -mt-5 mb-4 rounded-t-xl">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              {t.home.arbitrageBadge} ({win.originAirport} in {win.arbitrageOriginState})
            </span>
            <span>{t.home.arbitrageSaving}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            {/* Destination Header in Top Space of Timeframe Column */}
            {!options?.hideDestinationHeader && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400 tracking-wide pb-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setMapModalDestination({
                      destinationCode: win.destinationAirport,
                      destinationName: getFormattedLocalizedDestination(win.destinationAirport, win.destinationName),
                      destinationCity: win.destinationCity,
                      destinationCountry: win.destinationCountry,
                      vacationTypes: getDestinationVacationStyles(win.destinationAirport, win.flightDistanceKm),
                      flightDistanceKm: win.flightDistanceKm,
                      flightDurationMinutes: win.flightDurationMinutes,
                      originAirport: win.originAirport,
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer group text-left transition-colors"
                  title={t.home.showOnMap}
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all flex-shrink-0" />
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:underline text-sm transition-colors">
                    {getFormattedLocalizedDestination(win.destinationAirport, win.destinationName)}
                  </span>
                </button>
                {getDedupedStyleMetas(getDestinationVacationStyles(win.destinationAirport, win.flightDistanceKm)).map((meta) => {
                  const StyleIcon = meta.icon;
                  return (
                    <span
                      key={meta.label}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs ${meta.color}`}
                    >
                      <StyleIcon className="w-2.5 h-2.5 flex-shrink-0" />
                      <span>{meta.label}</span>
                    </span>
                  );
                })}
                {win.travelVehicle && (
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs ${getVehicleMeta(win.travelVehicle).color}`}
                  >
                    {React.createElement(getVehicleMeta(win.travelVehicle).icon, { className: 'w-2.5 h-2.5 flex-shrink-0' })}
                    <span>{getVehicleMeta(win.travelVehicle).label}</span>
                    {win.vehicleDetails?.distanceKm ? (
                      <span className="opacity-75 font-normal">
                        ({win.vehicleDetails.distanceKm} km)
                      </span>
                    ) : null}
                  </span>
                )}
                {win.overlandAccess && (win.overlandAccess === 'SHORT_FERRY' || win.overlandAccess === 'LONG_FERRY') && (
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800"
                    title={win.overlandAccess === 'SHORT_FERRY' ? t.home.shortFerryBadge : t.home.longFerryBadge}
                  >
                    <Ship className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>
                      {win.overlandAccess === 'SHORT_FERRY' ? t.home.shortFerryBadge : t.home.longFerryBadge}
                      {win.ferrySurchargeEur ? ` (+${win.ferrySurchargeEur} €)` : ''}
                    </span>
                  </span>
                )}
                <DestinationSafetyPopover
                  safety={win.destinationSafety || win.safetyAssessment}
                  destinationName={getFormattedLocalizedDestination(win.destinationAirport, win.destinationName)}
                  countryName={win.destinationCountry}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                {formatLocalizedDate(win.startDate, true)} → {formatLocalizedDate(win.endDate, true)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {win.durationDays} {t.home.days}
              </span>
              {win.pricingDetails?.flight?.isMidweekSaving && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {t.home.midweekFlightDealBadge}
                </span>
              )}
              {win.weather?.hasSnow && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Snowflake className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  {t.home.winterSportsActiveBadge}
                  {win.weather.snowDepthCm ? ` (~${win.weather.snowDepthCm} cm)` : ''}
                </span>
              )}
              {win.weather && (
                <ClimateDetailsPopover
                  destinationAirport={win.destinationAirport}
                  weather={win.weather}
                />
              )}
              {win.boardType && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1">
                  <Utensils className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  {win.boardType === 'ALL_INCLUSIVE'
                    ? t.home.boardTypeAllInclusive
                    : win.boardType === 'HALF_BOARD'
                    ? t.home.boardTypeHalfBoard
                    : win.boardType === 'BREAKFAST'
                    ? t.home.boardTypeBreakfast
                    : t.home.boardTypeRoomOnly}
                </span>
              )}
            </div>
          </div>

          {/* Price Section */}
          <div className="flex flex-col sm:items-end justify-start gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 text-left sm:text-right shrink-0">
            {(() => {
              const livePrice = liveEnrichedPrices[liveEnrichKeyFor(win)];
              const displayTotalCost = livePrice?.estimatedTotalCost ?? win.estimatedTotalCost;
              const displayPricePerPerson = livePrice?.pricePerPerson ?? win.pricePerPerson;
              return (
                <div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:justify-end">
                    {t.home.estFamilyCost}
                    {livePrice && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-full"
                        title={t.home.liveVerifiedHint}
                      >
                        <BadgeCheck className="w-2.5 h-2.5" />
                        {t.home.liveVerifiedBadge}
                      </span>
                    )}
                  </span>
                  <div className="flex items-baseline gap-2 sm:justify-end flex-wrap">
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {formatCurrency(displayTotalCost)}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      (~{formatCurrency(displayPricePerPerson)} / {t.home.perPerson})
                    </span>
                  </div>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {t.home.flightAndLodgingIncluded}
                  </span>
                </div>
              );
            })()}
            {Boolean(win.effectiveCost) && win.boardType === 'ALL_INCLUSIVE' && typeof win.mealPlanValue === 'number' && win.mealPlanValue > 0 ? (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold sm:text-right mt-0.5 flex items-center gap-1 sm:justify-end">
                <Utensils className="w-2.5 h-2.5" />
                <span>{t.home.boardTypeSavingsBadge}: ~€{win.mealPlanValue}</span>
              </div>
            ) : null}

            {/* Shared Trip Board Voting */}
            {activeShareId && win.shareCandidateId && (() => {
              const tally = voteTallies[win.shareCandidateId] || getInitialVoteTally(win);
              return (
                <div className="flex items-center gap-1.5 mt-1.5 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => submitSharedBoardVote(win, 1)}
                    title={t.home.voteUpvoteTooltip}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                  >
                    <ThumbsUp className="w-3 h-3" /> {tally.upvotes}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitSharedBoardVote(win, 2)}
                    title={t.home.voteFavoriteTooltip}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer"
                  >
                    <Star className="w-3 h-3" /> {tally.favorites}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitSharedBoardVote(win, -1)}
                    title={t.home.voteVetoTooltip}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-700 transition-colors cursor-pointer"
                  >
                    <ThumbsDown className="w-3 h-3" /> {tally.vetoes}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* School Holiday Exemption Warning */}
        {win.requiresSchoolExemption && (
          <div className="mt-3 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/60 flex items-start gap-2 text-xs text-orange-900 dark:text-orange-200">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {t.home.requiresSchoolExemptionWarning}
              </span>
              {win.schoolHolidayDaysOverlap !== undefined && win.schoolHolidayDaysOverlap > 0 ? (
                <span className="text-[11px] text-orange-800 dark:text-orange-300">
                  {win.schoolHolidayDaysOverlap} / {win.durationDays} {t.home.days} {t.home.schoolAgeBadge}
                </span>
              ) : (
                <span className="text-[11px] text-orange-800 dark:text-orange-300">
                  {t.home.schoolAgeBadge}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Localized Seasonal Warning Banner */}
        {win.seasonalWarning && (() => {
          const localized = getLocalizedSeasonalWarning(win.seasonalWarning, t);
          return (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {t.home.seasonalWarningBadge}: {localized.title}
                </span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300">
                  {localized.description}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Bottom Bar: Action Buttons above Metrics */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {/* Action Buttons: Flight Details & Deals Popover */}
          <div className="flex flex-wrap items-center gap-2">
            <FlightDetailsPopover
              originAirport={win.originAirport}
              destinationAirport={win.destinationAirport}
              originName={win.originName}
              originCity={win.originCity}
              originCountry={win.originCountry}
              destinationName={win.destinationName}
              destinationCity={win.destinationCity}
              destinationCountry={win.destinationCountry}
              originDistanceKm={win.originDistanceKm}
              originDriveMinutes={win.originDriveMinutes}
              originHighSpeedRail={win.originHighSpeedRail}
              flightDistanceKm={win.flightDistanceKm}
              flightDurationMinutes={win.flightDurationMinutes}
              departureLocation={departureLocation}
              isArbitrage={win.isArbitrageOpportunity}
              arbitrageOriginState={win.arbitrageOriginState}
              arbitrageNote={win.arbitrageNote}
              startDate={win.startDate}
              endDate={win.endDate}
              adults={adultsCount}
              baseAdultFare={win.pricingDetails?.flight?.baseAdultFare}
              totalFlightCost={win.pricingDetails?.flight?.totalFlightCost}
              isDirectFlight={win.isDirectFlight}
              stops={win.flightStops}
              layovers={win.flightLayovers}
              segments={win.flightSegments}
              directFlightPremiumMultiplier={win.directFlightPremium}
              connectingSavingsDiscount={win.pricingDetails?.flight?.connectingSavingsDiscount}
            />
            <BookingDealsPopover
              pricingDetails={win.pricingDetails}
              estimatedTotalCost={win.estimatedTotalCost}
              originAirport={win.originAirport}
              originAirports={originAirports}
              destinationAirport={win.destinationAirport}
              countryCode={country}
              startDate={win.startDate}
              endDate={win.endDate}
              adults={adultsCount}
              className="w-full sm:w-auto"
              candidate={win}
            />
          </div>

          {/* Metrics: PTO consumed and Match Score, each on a dedicated line */}
          <div className="flex flex-col gap-2 text-xs">
            <MetricExplanationPopover window={win} trigger="ptoRatio" className="w-full">
              <div className="bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-700/60 transition rounded-lg p-2.5 flex items-center justify-between group border border-transparent hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1">
                  <span>{t.home.ptoConsumed}</span>
                  <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {win.ptoDaysConsumed} {t.home.days}
                </span>
              </div>
            </MetricExplanationPopover>

            {win.childcareArbitrageWarning && (
              <div
                className="bg-rose-50/80 dark:bg-rose-950/30 rounded-lg p-2.5 flex items-start gap-1.5 border border-rose-200/70 dark:border-rose-900/60 text-[11px] text-rose-800 dark:text-rose-300"
                title={t.home.childcareArbitrageWarningHint}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {t.home.childcareArbitrageWarningLabel}{' '}
                  <strong>{win.childcareArbitrageWarning.costPerSavedPtoDay} €</strong>
                  {' / '}{t.home.savedPtoDay}
                  {' '}({win.childcareArbitrageWarning.savedPtoDays} {t.home.days}, +{win.childcareArbitrageWarning.extraCostEur} €)
                </span>
              </div>
            )}

            <MetricExplanationPopover window={win} trigger="score" className="w-full">
              <div className="bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/40 transition rounded-lg p-2.5 flex items-center justify-between border border-indigo-100/60 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 group">
                <span className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1">
                  {t.home.score}
                  <Info className="w-3 h-3 text-indigo-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-indigo-900 dark:text-indigo-200 text-sm">
                    {win.finalScore} / 100
                  </span>
                  {options?.rank !== undefined && (
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">#{options.rank}</span>
                  )}
                </div>
              </div>
            </MetricExplanationPopover>
          </div>
        </div>

        {win.isCachedBenchmark && (
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            {t.home.cachedBenchmark}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Intro hero banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            {t.home.heroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t.home.heroTitle}
          </h1>
          <p className="text-teal-100 text-sm sm:text-base leading-relaxed">
            {t.home.heroDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Filter className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                {t.home.constraintsTitle}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
                  title="Reset form and cached settings"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
                {profileLoaded && (
                  <span
                    className="hidden sm:flex text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800 items-center gap-1.5"
                    title={t.home.prefilledFromProfile}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse"></span>
                    {t.home.prefilledFromProfile}
                  </span>
                )}
              </div>
            </div>
            {profileLoaded && (
              <span
                className="block sm:hidden text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800 w-fit items-center gap-1.5"
                title={t.home.prefilledFromProfile}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse inline-block mr-1.5"></span>
                {t.home.prefilledFromProfile}
              </span>
            )}
          </div>

          <form onSubmit={handleOptimize} className="space-y-6">
            {/* Step 1: Departure Location & School District */}
            <div className="space-y-3">
              <LocationInput
                label={t.home.departureLocationLabel}
                value={departureLocation}
                onChange={handleLocationChange}
                placeholder={t.home.departureLocationPlaceholder}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.home.countryLabel}
                </label>
                <select
                  suppressHydrationWarning
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                >
                  {allCountries.map((c) => (
                    <option key={c.code} value={c.code} suppressHydrationWarning>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.home.homeStateLabel}
                </label>
                <select
                  suppressHydrationWarning
                  value={federalState}
                  onChange={(e) => setFederalState(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                >
                  {(COUNTRIES[country]?.subdivisions || []).length > 0 ? (
                    (COUNTRIES[country]?.subdivisions || []).map((sub) => (
                      <option key={sub.code} value={sub.code} suppressHydrationWarning>
                        {sub.name} ({sub.code})
                      </option>
                    ))
                  ) : (
                    <option value={country} suppressHydrationWarning>
                      {mounted ? getLocalizedCountryName(country, locale) : (COUNTRIES[country]?.name || country)}
                    </option>
                  )}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span>{t.home.holidayScopeNotice}</span>
              </p>
            </div>

            {/* Step 2: Travel Destinations & Vacation Style */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {/* Multi-Entry Destination Input */}
              <MultiDestinationInput
                selectedDestinations={targetDestinations}
                onChange={setTargetDestinations}
              />

              {/* Kind of Vacation (Vacation Style) selector - Only visible when no destinations are defined */}
              {targetDestinations.length === 0 && (
                <div>
                  <div className="mb-2.5 space-y-0.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{t.home.vacationKindLabel}</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {t.home.vacationKindHint}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {vacationStyles.map((item) => {
                      const Icon = item.icon;
                      const isSelected =
                        isAllStylesSelected || selectedStyles.includes(item.type);

                      return (
                        <div
                          key={item.type}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleVacationStyle(item.type)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleVacationStyle(item.type);
                            }
                          }}
                          className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
                            showBeachTempMenu && item.type === 'BEACH' ? 'z-30' : 'z-10'
                          } ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-600/25'
                              : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {/* Top row: Icon & Selection indicator */}
                          <div className="flex items-center justify-between w-full">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                            )}
                          </div>

                          {/* Middle: Label */}
                          <span className="font-bold text-xs truncate block text-left w-full">
                            {item.label}
                          </span>

                          {/* Bottom: Sub-option or category hint */}
                          <div className="w-full text-left" onClick={(e) => e.stopPropagation()}>
                            {item.type === 'BEACH' ? (
                              isSelected ? (
                                <BeachTemperaturePopover
                                  minBeachTemp={minBeachTemp}
                                  onSelect={setMinBeachTemp}
                                  isOpen={showBeachTempMenu}
                                  onOpenChange={setShowBeachTempMenu}
                                  t={t}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {locale.startsWith('de') ? 'Sonne & Meer' : 'Sun & seaside'}
                                </span>
                              )
                            ) : item.type === 'ALPINE' ? (
                              isSelected ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRequireSnow((prev) => !prev);
                                  }}
                                  className={`w-full py-0.5 px-1.5 rounded text-[10px] font-bold flex items-center justify-between border cursor-pointer ${
                                    requireSnow
                                      ? 'bg-indigo-300 text-indigo-950 border-indigo-400 shadow-2xs'
                                      : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                                  }`}
                                  title={t.home.winterSportsDesc}
                                >
                                  <span className="flex items-center gap-1 truncate">
                                    <Snowflake className={`w-2.5 h-2.5 flex-shrink-0 ${requireSnow ? 'text-indigo-950' : 'text-teal-200'}`} />
                                    <span className="truncate">{requireSnow ? t.home.snowGuaranteeBadge : t.home.noSnowGuaranteeBadge}</span>
                                  </span>
                                  {requireSnow ? (
                                    <Check className="w-2.5 h-2.5 flex-shrink-0 text-indigo-950 stroke-[3]" />
                                  ) : (
                                    <span className="text-[9px] opacity-60">Off</span>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {locale.startsWith('de') ? 'Berge & Ski' : 'Mountains & ski'}
                                </span>
                              )
                            ) : item.type === 'ALL' ? (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Alle Stile & flexibel' : 'All styles & flexible'}
                              </span>
                            ) : item.type === 'CITY' ? (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Kultur & City' : 'Culture & city trip'}
                              </span>
                            ) : item.type === 'NATURE' ? (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Natur & Erholung' : 'Nature & outdoor'}
                              </span>
                            ) : (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Fernreise & Welt' : 'Long-haul & world'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Travel Vehicle Selection */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="mb-2.5 space-y-0.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.travelVehicleLabel}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t.home.travelVehicleHint}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {vehicleOptions.map((v) => {
                  const Icon = v.icon;
                  const isSelected = selectedVehicles.includes(v.type);
                  return (
                    <div
                      key={v.type}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleVehicle(v.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleVehicle(v.type);
                        }
                      }}
                      className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
                        showFlightStopsMenu && v.type === 'PLANE' ? 'z-30' : 'z-10'
                      } ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-600/25'
                          : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {/* Top row: Icon & Selection indicator */}
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                        )}
                      </div>

                      {/* Middle: Label */}
                      <span className="font-bold text-xs truncate block text-left w-full">
                        {v.label}
                      </span>

                      {/* Bottom: Vehicle Hint or Inline Popover */}
                      <div className="w-full text-left" onClick={(e) => e.stopPropagation()}>
                        {v.type === 'PLANE' ? (
                          isSelected ? (
                            <FlightStopsPopover
                              maxFlightStops={maxFlightStops}
                              onSelect={setMaxFlightStops}
                              isOpen={showFlightStopsMenu}
                              onOpenChange={setShowFlightStopsMenu}
                              t={t}
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 truncate block">
                              {v.hint}
                            </span>
                          )
                        ) : (
                          <span
                            className={`text-[10px] truncate block ${
                              isSelected ? 'text-teal-100' : 'text-slate-400'
                            }`}
                          >
                            {v.hint}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preferred Board Type & Max Overland Travel Time */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.home.filterByBoardType}</span>
                </label>
                <select
                  value={preferredBoardType || 'ALL'}
                  onChange={(e) => setPreferredBoardType(e.target.value === 'ALL' ? undefined : (e.target.value as BoardType))}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">{t.home.allBoardTypes}</option>
                  <option value="ALL_INCLUSIVE">{t.home.boardTypeAllInclusive}</option>
                  <option value="HALF_BOARD">{t.home.boardTypeHalfBoard}</option>
                  <option value="BREAKFAST">{t.home.boardTypeBreakfast}</option>
                  <option value="ROOM_ONLY">{t.home.boardTypeRoomOnly}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.home.filterByOverlandDuration}</span>
                </label>
                <select
                  value={maxOverlandDurationHours ? String(maxOverlandDurationHours) : 'ALL'}
                  onChange={(e) => setMaxOverlandDurationHours(e.target.value === 'ALL' ? undefined : Number(e.target.value))}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">{t.home.overlandDurationAny}</option>
                  <option value="6">{t.home.overlandDuration6h}</option>
                  <option value="10">{t.home.overlandDuration10h}</option>
                  <option value="14">{t.home.overlandDuration14h}</option>
                  {maxOverlandDurationHours && ![6, 10, 14].includes(maxOverlandDurationHours) && (
                    <option value={String(maxOverlandDurationHours)}>
                      {t.home.overlandDurationCustom} ({maxOverlandDurationHours}h)
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Travel Comfort Preferences synced with Traveler Profile: cabin class, budget */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 min-h-[2.2em]">
                  {t.profile.cabinClass}
                </label>
                <select
                  value={preferredCabinClass || 'ECONOMY'}
                  onChange={(e) => setPreferredCabinClass(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="ECONOMY">{t.profile.economy}</option>
                  <option value="PREMIUM_ECONOMY">{t.profile.premiumEconomy}</option>
                  <option value="BUSINESS">{t.profile.business}</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-start gap-1.5 min-h-[2.2em]"
                  title={t.home.maxBudgetLabel}
                >
                  <Wallet className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{t.home.maxBudgetLabel}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={maxBudget ?? ''}
                  onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={t.home.maxBudgetPlaceholder}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs font-medium text-slate-800 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Step 3: Departure Airports (for Plane) or Overland Transit Note (for Car/Train/Bus) */}
            {selectedVehicles.includes('PLANE') ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <AirportSelector
                  selectedAirports={originAirports}
                  onChange={setOriginAirports}
                  coordinates={departureCoords}
                  targetDestinations={targetDestinations}
                />
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-slate-800 dark:text-slate-100">
                      {selectedVehicles.map((v) => getVehicleMeta(v).label).join(' / ')}
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Reisedistanz, Transitzeit und Fahrtkosten werden direkt von Ihren Startkoordinaten über Land berechnet. Es werden nur erreichbare Destinationen ohne Flugstrecke vorgeschlagen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Travelers (Adults & Children) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  {t.home.partyTitle}
                </label>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {adultsCount + childrenList.length} {adultsCount + childrenList.length === 1 ? 'Traveler' : 'Travelers'}
                </span>
              </div>

              {/* Adults Selector */}
              <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {t.home.adultsLabel}
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t.home.adultsHint}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdultsCount((prev) => Math.max(1, prev - 1))}
                    disabled={adultsCount <= 1}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs text-xs cursor-pointer"
                    aria-label="Decrease adults"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-slate-100">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdultsCount((prev) => Math.min(10, prev + 1))}
                    disabled={adultsCount >= 10}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs text-xs cursor-pointer"
                    aria-label="Increase adults"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Participating Children */}
              <ChildrenSelector
                childrenList={childrenList}
                onChange={setChildrenList}
                travelDate={earliestDate}
              />
            </div>

            {/* Step 5: Flexible Vacation Duration */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.home.durationLabel}</span>
              </label>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t.home.durationMinLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMin}
                    onChange={(e) => setDurationDaysMin(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 shadow-sm"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t.home.durationMaxLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMax}
                    onChange={(e) => setDurationDaysMax(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 6: Search Date Range (Strictly Future Dates) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{locale.startsWith('de') ? 'Reisezeitraum' : 'Travel Dates'} ({t.home.earliestDateLabel} &amp; {t.home.latestDateLabel})</span>
              </label>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t.home.earliestDateLabel}
                  </span>
                  <input
                    type="date"
                    min={todayStr}
                    value={earliestDate}
                    onChange={(e) => setEarliestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 shadow-sm"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t.home.latestDateLabel}
                  </span>
                  <input
                    type="date"
                    min={earliestDate || todayStr}
                    value={latestDate}
                    onChange={(e) => setLatestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 7: Blackout Periods (Sperrzeiten) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200/90 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    {t.home.blackoutFilterTitle}
                  </span>
                  {searchBlackouts.length > 0 && (
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-700/60">
                      {searchBlackouts.length}
                    </span>
                  )}
                </div>

                {/* Blackout List & Presets: Only show holiday buttons when user is adding or has blackout periods */}
                {searchBlackouts.length === 0 && !isAddingBlackout ? (
                  <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 text-center">
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{t.home.noBlackouts}</p>
                    <button
                      type="button"
                      onClick={addBlackout}
                      className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      + {t.home.addBlackout}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Quick Add Special Moving Periods (Ostern, Pfingsten, Himmelfahrt, Fronleichnam, Silvester) */}
                    {annualSpecialTimes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900/75 dark:text-amber-300/75">
                          {t.home.quickSpecialTimes}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {annualSpecialTimes.map((period) => {
                            const isSelected = searchBlackouts.some(
                              (b) => b.startDate === period.startDate && b.endDate === period.endDate
                            );
                            return (
                              <button
                                key={`${period.id}-${period.startDate}`}
                                type="button"
                                onClick={() => toggleSpecialPeriod(period)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs'
                                }`}
                                title={`${period.name} (${period.startDate} - ${period.endDate}): ${period.description}`}
                              >
                                <span>{period.icon}</span>
                                <span>{period.displayName}</span>
                                {isSelected ? (
                                  <Check className="w-3 h-3 ml-0.5" />
                                ) : (
                                  <Plus className="w-3 h-3 ml-0.5 text-amber-600 dark:text-amber-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {searchBlackouts.map((b, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 bg-white/95 dark:bg-slate-800/80 rounded-lg border border-amber-200/90 dark:border-amber-800/60 flex items-center gap-1.5 text-xs transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-amber-300 dark:hover:border-amber-700 shadow-xs"
                        >
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700/60 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <DateRangePicker
                            startDate={b.startDate}
                            endDate={b.endDate}
                            onChange={(start, end) => updateBlackoutRange(idx, start, end)}
                            minDate={todayStr}
                            className="w-[108px] shrink-0"
                          />
                          <input
                            type="text"
                            placeholder={t.home.blackoutReasonPlaceholder}
                            value={b.reason || ''}
                            onChange={(e) => updateBlackout(idx, 'reason', e.target.value)}
                            className="flex-1 min-w-0 text-xs rounded border border-slate-300 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeBlackout(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer flex-shrink-0"
                            title={t.home.removeBlackout}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addBlackout}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.home.addBlackout}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Optimization Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t.home.optimizing}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  {t.home.runOptimization}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Stream */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5 space-y-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t.home.resultsTitle}
            </h2>
            {results && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 text-[11px]">
                  {filteredResults.length} / {results.length} {t.home.windowsFound}
                </span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm rounded-xl">
              {error}
            </div>
          )}

          {!results && !loading && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto text-xl">
                <Sun className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-base">{t.home.readyTitle}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">{t.home.readyDescription}</p>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationTitle
                  : t.home.noResultsTitle}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationHint
                  : t.home.noResultsHint}
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <>
              {/* Filter and Sort Toolbar */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Filter Toggle Button + Active Count + Reset */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResultFilters((prev) => !prev)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        showResultFilters
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{showResultFilters ? t.home.filterToggleHide : t.home.filterToggleShow}</span>
                      {activeFilterCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                          {activeFilterCount}
                        </span>
                      )}
                      {showResultFilters ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      )}
                    </button>

                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded transition hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        title={t.home.filterResetAll}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">{t.home.filterResetAll}</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Share Results & View Mode Switcher */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShareSearch}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title={t.home.shareSearch}
                    >
                      <Share2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span className="hidden sm:inline">{shareCopiedToast ? t.home.shareCopied : t.home.shareSearch}</span>
                      {shareCopiedToast && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-in fade-in" />}
                    </button>

                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setViewMode('destination')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                          viewMode === 'destination'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>{t.home.viewModeDestination}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('timeframe')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                          viewMode === 'timeframe'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{t.home.viewModeTimeframe}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                          viewMode === 'list'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>{t.home.viewModeList}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Filter Panel: Highlight active non-default filters clearly */}
                {showResultFilters && (() => {
                  const isMonthActive = selectedMonth !== 'ALL';
                  const isStyleActive = resultStyleFilter !== 'ALL';
                  const isDistanceActive = distanceFilter !== 'ALL';
                  const isVehicleActive = vehicleFilter !== 'ALL';
                  const isSafetyActive = safetyFilter !== 'SAFE_ONLY';
                  const isWarningActive = warningFilter !== 'CLEAN_ONLY';
                  const isHeatActive = heatFilter !== 'ALL';
                  const isBoardTypeActive = boardTypeFilter !== 'ALL';
                  const isOverlandDurationActive = overlandDurationFilter !== 'ALL';
                  const isFlightStopsActive = flightStopsFilter !== 'ALL';
                  const isSchoolHolidayActive = schoolHolidayFilter !== 'all';
                  const isMaxCostActive = maxCostFilter !== undefined && maxCostFilter > 0;
                  const isSortActive = sortBy !== 'score';

                  return (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {/* Line 1: Month Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isMonthActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isMonthActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Calendar className={`w-3.5 h-3.5 ${isMonthActive ? 'text-teal-600' : 'text-teal-600'}`} />
                          <span>{t.home.filterByMonth}</span>
                          {isMonthActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={selectedMonth}
                            onChange={(e) => {
                              setSelectedMonth(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isMonthActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.allMonths}</option>
                            {availableMonths.map((m) => {
                              const monthName = formatDate(new Date(2026, parseInt(m, 10) - 1, 1), {
                                month: 'long',
                              });
                              return (
                                <option key={m} value={m}>
                                  {monthName}
                                </option>
                              );
                            })}
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isMonthActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMonth('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 2: Vacation Style Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isStyleActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isStyleActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Compass className={`w-3.5 h-3.5 ${isStyleActive ? 'text-teal-600' : 'text-teal-600'}`} />
                          <span>{t.home.filterByVacationStyle}</span>
                          {isStyleActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={resultStyleFilter}
                            onChange={(e) => {
                              setResultStyleFilter(e.target.value as DestinationType);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isStyleActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.vacationKindAll}</option>
                            <option value="BEACH">{t.home.vacationKindBeach}</option>
                            <option value="ALPINE">{t.home.vacationKindAlpine}</option>
                            <option value="CITY">{t.home.vacationKindCity}</option>
                            <option value="NATURE">{t.home.vacationKindNature}</option>
                            <option value="LONGRANGE">{t.home.vacationKindLongrange}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isStyleActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setResultStyleFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 3: Flight Distance Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isDistanceActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isDistanceActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Plane className={`w-3.5 h-3.5 ${isDistanceActive ? 'text-indigo-600' : 'text-indigo-600'}`} />
                          <span>{t.home.filterByDistance}</span>
                          {isDistanceActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={distanceFilter}
                            onChange={(e) => {
                              setDistanceFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isDistanceActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.allDistances}</option>
                            <option value="SHORT">{t.home.distShort}</option>
                            <option value="MID">{t.home.distMid}</option>
                            <option value="EXTENDED">{t.home.distExtended}</option>
                            <option value="LONG">{t.home.distLong}</option>
                            <option value="INTERCONTINENTAL">{t.home.distIntercontinental}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isDistanceActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDistanceFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 4: Travel Vehicle Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isVehicleActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isVehicleActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Car className={`w-3.5 h-3.5 ${isVehicleActive ? 'text-emerald-600' : 'text-emerald-600'}`} />
                          <span>{t.home.filterByVehicle}</span>
                          {isVehicleActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={vehicleFilter}
                            onChange={(e) => {
                              setVehicleFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isVehicleActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.vehicleAll}</option>
                            <option value="PLANE">{t.home.vehiclePlane}</option>
                            <option value="CAR">{t.home.vehicleCar}</option>
                            <option value="TRAIN">{t.home.vehicleTrain}</option>
                            <option value="BUS">{t.home.vehicleBus}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isVehicleActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVehicleFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 5: Destination Safety Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isSafetyActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isSafetyActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <ShieldCheck className={`w-3.5 h-3.5 ${isSafetyActive ? 'text-emerald-600' : 'text-emerald-600'}`} />
                          <span>{t.home.filterBySafety}</span>
                          {isSafetyActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={safetyFilter}
                            onChange={(e) => {
                              setSafetyFilter(e.target.value as any);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isSafetyActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="SAFE_ONLY">{t.home.safetyFilterSafeOnly}</option>
                            <option value="ALL">{t.home.safetyFilterAll}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isSafetyActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSafetyFilter('SAFE_ONLY');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 6: Seasonal Warnings Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isWarningActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isWarningActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <AlertCircle className={`w-3.5 h-3.5 ${isWarningActive ? 'text-amber-500' : 'text-amber-500'}`} />
                          <span>{t.home.filterByWarnings}</span>
                          {isWarningActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={warningFilter}
                            onChange={(e) => {
                              setWarningFilter(e.target.value as any);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isWarningActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="CLEAN_ONLY">{t.home.warningsFilterCleanOnly}</option>
                            <option value="ALL">{t.home.warningsFilterAll}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isWarningActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWarningFilter('CLEAN_ONLY');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 7: Extreme Summer Heat Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isHeatActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isHeatActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Sun className={`w-3.5 h-3.5 ${isHeatActive ? 'text-amber-500' : 'text-amber-500'}`} />
                          <span>{t.home.filterByHeat}</span>
                          {isHeatActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={heatFilter}
                            onChange={(e) => {
                              setHeatFilter(e.target.value as any);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isHeatActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.heatFilterAll}</option>
                            <option value="AVOID_EXTREME_HEAT">{t.home.heatFilterAvoid}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isHeatActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setHeatFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 8: Board Type Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isBoardTypeActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isBoardTypeActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Utensils className={`w-3.5 h-3.5 ${isBoardTypeActive ? 'text-violet-600' : 'text-violet-600'}`} />
                          <span>{t.home.filterByBoardType}</span>
                          {isBoardTypeActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={boardTypeFilter}
                            onChange={(e) => {
                              setBoardTypeFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isBoardTypeActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.allBoardTypes}</option>
                            <option value="ALL_INCLUSIVE">{t.home.boardTypeAllInclusive}</option>
                            <option value="HALF_BOARD">{t.home.boardTypeHalfBoard}</option>
                            <option value="BREAKFAST">{t.home.boardTypeBreakfast}</option>
                            <option value="ROOM_ONLY">{t.home.boardTypeRoomOnly}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isBoardTypeActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBoardTypeFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 9: Max Overland Duration Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isOverlandDurationActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isOverlandDurationActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Car className={`w-3.5 h-3.5 ${isOverlandDurationActive ? 'text-teal-600' : 'text-teal-600'}`} />
                          <span>{t.home.filterByOverlandDuration}</span>
                          {isOverlandDurationActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={overlandDurationFilter}
                            onChange={(e) => {
                              setOverlandDurationFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isOverlandDurationActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.overlandDurationAny}</option>
                            <option value="360">{t.home.overlandDuration6h}</option>
                            <option value="600">{t.home.overlandDuration10h}</option>
                            <option value="840">{t.home.overlandDuration14h}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isOverlandDurationActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOverlandDurationFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 10: Flight Transit & Stops Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isFlightStopsActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isFlightStopsActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Plane className={`w-3.5 h-3.5 ${isFlightStopsActive ? 'text-teal-600' : 'text-teal-600'}`} />
                          <span>{t.home.filterByFlightStops}</span>
                          {isFlightStopsActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={flightStopsFilter}
                            onChange={(e) => {
                              setFlightStopsFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isFlightStopsActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="ALL">{t.home.flightStopsAny}</option>
                            <option value="DIRECT_ONLY">{t.home.flightStopsDirectOnly}</option>
                            <option value="MAX_1_STOP">{t.home.flightStopsMax1}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isFlightStopsActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFlightStopsFilter('ALL');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 11: School Calendar Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isSchoolHolidayActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isSchoolHolidayActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Award className={`w-3.5 h-3.5 ${isSchoolHolidayActive ? 'text-teal-600' : 'text-teal-600'}`} />
                          <span>{t.home.schoolHolidaysFilterLabel}</span>
                          {isSchoolHolidayActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={schoolHolidayFilter}
                            onChange={(e) => {
                              setSchoolHolidayFilter(e.target.value as any);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isSchoolHolidayActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="all">{t.home.filterAllDates}</option>
                            <option value="holidaysOnly">{t.home.filterSchoolHolidaysOnly}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isSchoolHolidayActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSchoolHolidayFilter('all');
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 12: Max Cost Filter */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all border-b ${isMaxCostActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : 'border-slate-100 dark:border-slate-800'}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isMaxCostActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <Sparkles className={`w-3.5 h-3.5 ${isMaxCostActive ? 'text-amber-500' : 'text-amber-500'}`} />
                          <span>{t.home.filterByCost}</span>
                          {isMaxCostActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <input
                            type="number"
                            placeholder="z. B. 3500 €"
                            value={maxCostFilter || ''}
                            onChange={(e) => {
                              setMaxCostFilter(e.target.value ? Number(e.target.value) : undefined);
                              setCurrentPage(1);
                            }}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isMaxCostActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          />
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isMaxCostActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMaxCostFilter(undefined);
                                  setCurrentPage(1);
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 13: Sort By */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 px-2.5 -mx-2.5 rounded-xl transition-all ${isSortActive ? 'bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200/90 dark:border-teal-800/60 shadow-2xs' : ''}`}>
                        <label className={`text-xs flex items-center gap-1.5 transition-colors ${isSortActive ? 'font-bold text-teal-900 dark:text-teal-200' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          <ArrowUpDown className={`w-3.5 h-3.5 ${isSortActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`} />
                          <span>{t.home.sortBy}</span>
                          {isSortActive && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 ring-2 ring-teal-300 dark:ring-teal-700/60 animate-pulse flex-shrink-0" title="Aktiv" />
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className={`w-full sm:w-64 text-xs rounded-lg px-3 py-1.5 outline-none transition font-medium ${
                              isSortActive
                                ? 'border border-teal-500 dark:border-teal-600 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-200 font-bold ring-2 ring-teal-500/20 dark:ring-teal-500/30 shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                            }`}
                          >
                            <option value="score">{t.home.sortScore}</option>
                            <option value="date-asc">{t.home.sortDateAsc}</option>
                            <option value="date-desc">{t.home.sortDateDesc}</option>
                            <option value="price">{t.home.sortPrice}</option>
                            <option value="pto">{t.home.sortPto}</option>
                            <option value="duration">{t.home.sortDuration}</option>
                          </select>
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {isSortActive && (
                              <button
                                type="button"
                                onClick={() => setSortBy('score')}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40 rounded-lg transition cursor-pointer"
                                title="Zurücksetzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {filteredResults.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No vacation windows match the active filters.
                </div>
              ) : viewMode === 'destination' ? (
                /* Group by Destination View */
                <div className="space-y-4">
                  {/* Destination View Controls & Filter Bar */}
                  {(activeQueryDestinations.length > 1 || destinationGroups.length > 0) && (
                    <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {activeQueryDestinations.length > 1 ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {t.home.filterByDestination}:
                          </span>
                          <DestinationFilterDropdown
                            destinations={activeQueryDestinations}
                            selectedDestinations={selectedDestinationsList}
                            onChange={(selected) => {
                              setSelectedDestinationsList(selected);
                              setCurrentPage(1);
                              setTimeframeCurrentPage(1);
                            }}
                            totalCount={results?.length || 0}
                          />
                        </div>
                      ) : <div />}

                      {destinationGroups.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={expandAllDestinations}
                            title={t.home.expandAllAlternativeDates}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700/60 text-teal-700 dark:text-teal-400 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:border-teal-300 dark:hover:border-slate-600 transition"
                          >
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">+</span>
                          </button>
                          <button
                            type="button"
                            onClick={collapseAllDestinations}
                            title={t.home.collapseAllAlternativeDates}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition"
                          >
                            <ChevronsDownUp className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">-</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state when destination filter matches 0 */}
                  {destinationGroups.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {t.home.noDestinationsMatchFilter}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedDestinationsList([])}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t.home.clearDestinationFilter}
                      </button>
                    </div>
                  ) : (
                    /* Destination Cards List */
                    <div className="space-y-6">
                      {destinationGroups.map((group, groupIdx) => {
                    const isExpanded = expandedDestinations[group.destinationCode];
                    return (
                      <div
                        key={group.destinationCode}
                        className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition"
                      >
                        {/* Group Header */}
                        <div className="bg-gradient-to-r from-slate-50 via-teal-50/40 to-emerald-50/20 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-teal-950/20 p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                          {/* Top: Destination Title & Vacation Style Tags (Wide full row) */}
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMapModalDestination({
                                      destinationCode: group.destinationCode,
                                      destinationName: group.destinationName,
                                      destinationCity: group.destinationCity,
                                      destinationCountry: group.destinationCountry,
                                      vacationTypes: group.vacationStyles,
                                      flightDistanceKm: group.featuredWindow.flightDistanceKm,
                                      flightDurationMinutes: group.featuredWindow.flightDurationMinutes,
                                      originAirport: group.featuredWindow.originAirport,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 text-left group/loc cursor-pointer hover:opacity-90 transition"
                                  title={t.home.showOnMap}
                                >
                                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 group-hover/loc:text-teal-600 dark:group-hover/loc:text-teal-400 group-hover/loc:underline text-base sm:text-lg transition-colors flex items-center gap-1.5">
                                    <span>{group.destinationName}</span>
                                    <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 opacity-60 group-hover/loc:opacity-100 group-hover/loc:scale-110 transition-all flex-shrink-0" />
                                  </h3>
                                </button>
                                {getDedupedStyleMetas(group.vacationStyles).map((meta) => {
                                  const StyleIcon = meta.icon;
                                  return (
                                    <span
                                      key={meta.label}
                                      className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs ${meta.color}`}
                                    >
                                      <StyleIcon className="w-3 h-3 flex-shrink-0" />
                                      <span>{meta.label}</span>
                                    </span>
                                  );
                                })}
                                {group.featuredWindow?.travelVehicle && (
                                  <span
                                    className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs ${getVehicleMeta(group.featuredWindow.travelVehicle).color}`}
                                  >
                                    {React.createElement(getVehicleMeta(group.featuredWindow.travelVehicle).icon, { className: 'w-3 h-3 flex-shrink-0' })}
                                    <span>{getVehicleMeta(group.featuredWindow.travelVehicle).label}</span>
                                    {group.featuredWindow.vehicleDetails?.distanceKm ? (
                                      <span className="opacity-75 font-normal">
                                        ({group.featuredWindow.vehicleDetails.distanceKm} km)
                                      </span>
                                    ) : null}
                                  </span>
                                )}
                                <DestinationSafetyPopover
                                  safety={group.destinationSafety || group.featuredWindow.destinationSafety || group.featuredWindow.safetyAssessment}
                                  destinationName={group.destinationName}
                                  countryName={group.destinationCountry}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Stats & Action Buttons (Pulled down for maximum room) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span title={`${group.totalWindows} raw date & duration combinations evaluated`}>
                                {t.home.destGroupTimeframesFound.replace(
                                  '{count}',
                                  String(group.alternativeWindows.length + 1)
                                )}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {t.home.destGroupFromPrice.replace(
                                  '{price}',
                                  formatCurrency(group.lowestPrice)
                                )}
                              </span>
                            </p>

                            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                              {groupIdx === 0 && (
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  {t.home.destGroupFeaturedBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Featured Top-Scoring Vacation Window */}
                        <div className="p-4 bg-white dark:bg-slate-900/90">
                          {renderVacationCard(group.featuredWindow, { rank: groupIdx + 1, hideDestinationHeader: true })}
                        </div>

                        {/* Alternative Dates Accordion */}
                        {group.alternativeWindows.length > 0 && (
                          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                            <button
                              type="button"
                              onClick={() => toggleDestinationExpand(group.destinationCode)}
                              className="w-full flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 transition py-1 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                {isExpanded
                                  ? t.home.destGroupHideAlternativeDates
                                  : t.home.destGroupAlternativeDates.replace('{count}', String(group.alternativeWindows.length))}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-4 space-y-3 pt-2">
                                {group.alternativeWindows.map((altWin, altIdx) => (
                                  <div
                                    key={`${altWin.startDate}-${altWin.originAirport}-${altWin.durationDays}`}
                                  >
                                    {renderVacationCard(altWin, { rank: altIdx + 2, hideDestinationHeader: true })}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : viewMode === 'timeframe' ? (
                /* Group by Timeframe View */
                <div className="space-y-6">
                  {/* Destination Filter Dropdown when query has > 1 destination */}
                  {activeQueryDestinations.length > 1 && (
                    <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t.home.filterByDestination}:
                        </span>
                        <DestinationFilterDropdown
                          destinations={activeQueryDestinations}
                          selectedDestinations={selectedDestinationsList}
                          onChange={(selected) => {
                            setSelectedDestinationsList(selected);
                            setTimeframeCurrentPage(1);
                            setCurrentPage(1);
                          }}
                          totalCount={results?.length || 0}
                        />
                      </div>
                    </div>
                  )}

                  {displayedTimeframeGroups.map((group) => {
                    const isExpanded = expandedTimeframes[group.key];
                    const shownWindows = isExpanded ? group.windows : group.windows.slice(0, 3);
                    return (
                      <div key={group.key} className="space-y-3">
                        {/* Timeframe Group Header */}
                        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-yellow-300" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-white text-base sm:text-lg">
                                {group.title}
                              </h3>
                              <p className="text-xs text-teal-100 flex items-center gap-2 mt-0.5">
                                <span>
                                  {t.home.timeframeGroupCount.replace('{count}', String(group.windows.length))}
                                </span>
                                <span>•</span>
                                <span>
                                  {t.home.destGroupFromPrice.replace('{price}', formatCurrency(group.lowestPrice))}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            {group.hasSchoolHolidays && (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-300/40">
                                {t.home.schoolAgeBadge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Windows in this timeframe */}
                        <div className="space-y-4">
                          {shownWindows.map((win, idx) =>
                            renderVacationCard(win, { rank: idx + 1 })
                          )}
                        </div>

                        {/* Show More toggle */}
                        {group.windows.length > 3 && (
                          <div className="text-center pt-1">
                            <button
                              type="button"
                              onClick={() => toggleTimeframeExpand(group.key)}
                              className="px-4 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>{t.home.timeframeGroupShowLess}</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>
                                    {t.home.timeframeGroupShowMore
                                      .replace('{count}', String(group.windows.length))
                                      .replace('{period}', group.title)}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Timeframe View Pagination Controls */}
                  {timeframeGroups.length > 0 && (
                    <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span>{t.home.resultsPerPage}:</span>
                        <select
                          value={timeframePageSize}
                          onChange={(e) => {
                            setTimeframePageSize(Number(e.target.value));
                            setTimeframeCurrentPage(1);
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                          <option value={2}>2</option>
                          <option value={4}>4</option>
                          <option value={6}>6</option>
                          <option value={12}>12</option>
                        </select>
                        <span className="text-slate-400 dark:text-slate-500 ml-2">
                          {t.home.page} {timeframeCurrentPage} {t.home.of} {timeframeTotalPages}
                        </span>
                      </div>

                      {timeframeTotalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={timeframeCurrentPage <= 1}
                            onClick={() => setTimeframeCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            {t.home.prevPage}
                          </button>

                          {Array.from({ length: Math.min(5, timeframeTotalPages) }, (_, i) => {
                            let pageNum = i + 1;
                            if (timeframeTotalPages > 5 && timeframeCurrentPage > 3) {
                              pageNum = timeframeCurrentPage - 3 + i;
                              if (pageNum > timeframeTotalPages) pageNum = timeframeTotalPages - (4 - i);
                            }
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setTimeframeCurrentPage(pageNum)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  timeframeCurrentPage === pageNum
                                    ? 'bg-teal-600 text-white shadow-xs'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            type="button"
                            disabled={timeframeCurrentPage >= timeframeTotalPages}
                            onClick={() => setTimeframeCurrentPage((p) => Math.min(timeframeTotalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                          >
                            {t.home.nextPage}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Flat List View */
                <div className="space-y-4">
                  {/* Destination Filter Dropdown when query has > 1 destination */}
                  {activeQueryDestinations.length > 1 && (
                    <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t.home.filterByDestination}:
                        </span>
                        <DestinationFilterDropdown
                          destinations={activeQueryDestinations}
                          selectedDestinations={selectedDestinationsList}
                          onChange={(selected) => {
                            setSelectedDestinationsList(selected);
                            setCurrentPage(1);
                            setTimeframeCurrentPage(1);
                          }}
                          totalCount={results?.length || 0}
                        />
                      </div>
                    </div>
                  )}

                  {displayedResults.map((win, idx) => {
                    const globalRank = (currentPage - 1) * pageSize + idx + 1;
                    return renderVacationCard(win, { rank: globalRank });
                  })}

                  {/* Pagination Controls */}
                  <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>{t.home.resultsPerPage}:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                      <span className="text-slate-400 dark:text-slate-500 ml-2">
                        {t.home.page} {currentPage} {t.home.of} {totalPages}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        {t.home.prevPage}
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 3 + i;
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        {t.home.nextPage}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Interactive Destination Map Modal */}
      {mapModalDestination && (
        <DestinationMapModal
          isOpen={Boolean(mapModalDestination)}
          onClose={() => setMapModalDestination(null)}
          destinationCode={mapModalDestination.destinationCode}
          destinationName={mapModalDestination.destinationName}
          destinationCity={mapModalDestination.destinationCity}
          destinationCountry={mapModalDestination.destinationCountry}
          vacationTypes={mapModalDestination.vacationTypes}
          flightDistanceKm={mapModalDestination.flightDistanceKm}
          flightDurationMinutes={mapModalDestination.flightDurationMinutes}
          originAirport={mapModalDestination.originAirport}
          departureLocation={departureLocation}
        />
      )}
    </div>
  );
}
