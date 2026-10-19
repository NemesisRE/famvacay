'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Save,
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
  Thermometer,
  Waves,
  ChevronsUpDown,
  ChevronsDownUp,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { differenceInYears, addDays } from 'date-fns';
import { CandidateWindow, DestinationType, TravelVehicle, BoardType } from '@/lib/optimizer/types';
import { getDestinationProfile } from '@/lib/optimizer/weather';
import { curateDistinctAlternativeWindows } from '@/lib/optimizer/engine';
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
import { getDestinationVacationStyles } from '@/lib/optimizer/destination-styles';
import { getAnnualSpecialTimes, SpecialHolidayPeriod } from '@/lib/holidays/special-dates';
import { BeachTemperaturePopover } from '@/components/preferences/BeachTemperaturePopover';

export default function HomePage() {
  const { data: session, status } = useSession();
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
        return { label: type, icon: Compass, color: 'bg-blue-50 text-blue-700 border-blue-200' };
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
          color: 'bg-blue-50 text-blue-700 border-blue-200',
        };
    }
  };

  const getFormattedLocalizedDestination = (destCode: string, fallbackName?: string) => {
    const airport = getAirportByIata(destCode);
    if (!airport) return fallbackName || destCode;
    const locAirport = getLocalizedAirportDetails(airport, locale);
    if (locAirport.city && locAirport.country) {
      return `${locAirport.city}, ${locAirport.country}`;
    }
    return locAirport.name || fallbackName || destCode;
  };

  // 3. Flight / Origin Airports State
  const [originAirports, setOriginAirports] = useState<string[]>(['FKB', 'STR', 'FRA']);

  // 4. Travelers Party Composition (Adults & Children)
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [loadedAdultMembers, setLoadedAdultMembers] = useState<any[]>([]);
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
  const [preferredBoardType, setPreferredBoardType] = useState<BoardType | undefined>(undefined);
  const [maxOverlandDurationHours, setMaxOverlandDurationHours] = useState<number | undefined>(undefined);

  // 7. Blackout Dates (Starts empty by default, loaded from profile if configured)
  const [searchBlackouts, setSearchBlackouts] = useState<
    { startDate: string; endDate: string; reason?: string }[]
  >([]);
  const [isAddingBlackout, setIsAddingBlackout] = useState(false);

  // Profile preferences & travel comfort state
  const [maxDrivingHours, setMaxDrivingHours] = useState<number | undefined>(undefined);
  const [preferredCabinClass, setPreferredCabinClass] = useState<string | undefined>(undefined);
  const [climatePreference, setClimatePreference] = useState<string | undefined>(undefined);
  const [travelModes, setTravelModes] = useState<string[] | undefined>(undefined);

  // Profile sync states
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);

  // Search Results & Filter / Pagination State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidateWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'destination' | 'timeframe'>('destination');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [maxCostFilter, setMaxCostFilter] = useState<number | undefined>(undefined);
  const [schoolHolidayFilter, setSchoolHolidayFilter] = useState<'all' | 'holidaysOnly'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'pto' | 'duration' | 'date-asc' | 'date-desc'>('score');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedDestinations, setExpandedDestinations] = useState<Record<string, boolean>>({});
  const [expandedTimeframes, setExpandedTimeframes] = useState<Record<string, boolean>>({});
  const [destinationSearchFilter, setDestinationSearchFilter] = useState<string>('');
  const [destinationCountryFilter, setDestinationCountryFilter] = useState<string>('ALL');
  const [resultStyleFilter, setResultStyleFilter] = useState<DestinationType>('ALL');
  const [distanceFilter, setDistanceFilter] = useState<string>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');
  const [safetyFilter, setSafetyFilter] = useState<'SAFE_ONLY' | 'ALL'>('SAFE_ONLY');
  const [warningFilter, setWarningFilter] = useState<'CLEAN_ONLY' | 'ALL'>('CLEAN_ONLY');
  const [boardTypeFilter, setBoardTypeFilter] = useState<string>('ALL');
  const [overlandDurationFilter, setOverlandDurationFilter] = useState<string>('ALL');
  const [showResultFilters, setShowResultFilters] = useState<boolean>(false);
  const [isDestinationSearchOpen, setIsDestinationSearchOpen] = useState<boolean>(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedMonth !== 'ALL') count++;
    if (resultStyleFilter !== 'ALL') count++;
    if (distanceFilter !== 'ALL') count++;
    if (vehicleFilter !== 'ALL') count++;
    if (safetyFilter !== 'SAFE_ONLY') count++;
    if (warningFilter !== 'CLEAN_ONLY') count++;
    if (boardTypeFilter !== 'ALL') count++;
    if (overlandDurationFilter !== 'ALL') count++;
    if (schoolHolidayFilter !== 'all') count++;
    if (maxCostFilter !== undefined && maxCostFilter > 0) count++;
    if (sortBy !== 'score') count++;
    return count;
  }, [
    selectedMonth,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    boardTypeFilter,
    overlandDurationFilter,
    schoolHolidayFilter,
    maxCostFilter,
    sortBy,
  ]);

  const resetAllFilters = () => {
    setSelectedMonth('ALL');
    setResultStyleFilter('ALL');
    setDistanceFilter('ALL');
    setVehicleFilter('ALL');
    setSafetyFilter('SAFE_ONLY');
    setWarningFilter('CLEAN_ONLY');
    setBoardTypeFilter('ALL');
    setOverlandDurationFilter('ALL');
    setSchoolHolidayFilter('all');
    setMaxCostFilter(undefined);
    setSortBy('score');
    setCurrentPage(1);
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
        if (Array.isArray(parsed.searchBlackouts)) setSearchBlackouts(parsed.searchBlackouts);
      }

      const savedFilters = localStorage.getItem('famvac_filter_settings');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (parsed.selectedMonth) setSelectedMonth(parsed.selectedMonth);
        if (parsed.maxCostFilter !== undefined) setMaxCostFilter(parsed.maxCostFilter);
        if (parsed.schoolHolidayFilter) setSchoolHolidayFilter(parsed.schoolHolidayFilter);
        if (parsed.sortBy) setSortBy(parsed.sortBy);
        if (parsed.pageSize) setPageSize(parsed.pageSize);
        if (parsed.destinationSearchFilter !== undefined) setDestinationSearchFilter(parsed.destinationSearchFilter);
        if (parsed.destinationCountryFilter) setDestinationCountryFilter(parsed.destinationCountryFilter);
        if (parsed.resultStyleFilter) setResultStyleFilter(parsed.resultStyleFilter);
        if (parsed.distanceFilter) setDistanceFilter(parsed.distanceFilter);
        if (parsed.vehicleFilter) setVehicleFilter(parsed.vehicleFilter);
        if (parsed.safetyFilter) setSafetyFilter(parsed.safetyFilter);
        if (parsed.warningFilter) setWarningFilter(parsed.warningFilter);
        if (parsed.boardTypeFilter) setBoardTypeFilter(parsed.boardTypeFilter);
        if (parsed.overlandDurationFilter) setOverlandDurationFilter(parsed.overlandDurationFilter);
      }

      const savedResults = localStorage.getItem('famvac_cached_results');
      if (savedResults) {
        const parsed = JSON.parse(savedResults);
        const ageHours = (Date.now() - (parsed.timestamp || 0)) / (1000 * 60 * 60);
        // Restore recent search results if less than 2.5 hours old
        if (ageHours < 2.5 && Array.isArray(parsed.windows) && parsed.windows.length > 0) {
          setResults(parsed.windows);
        }
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setHasRestoredFromStorage(true);
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
    searchBlackouts,
  ]);

  // Save filter settings to localStorage on changes
  useEffect(() => {
    if (!hasRestoredFromStorage) return;
    try {
      const filtersToSave = {
        viewMode,
        selectedMonth,
        maxCostFilter,
        schoolHolidayFilter,
        sortBy,
        pageSize,
        destinationSearchFilter,
        destinationCountryFilter,
        resultStyleFilter,
        distanceFilter,
        vehicleFilter,
        safetyFilter,
        warningFilter,
        boardTypeFilter,
        overlandDurationFilter,
      };
      localStorage.setItem('famvac_filter_settings', JSON.stringify(filtersToSave));
    } catch {
      // Storage error
    }
  }, [
    hasRestoredFromStorage,
    viewMode,
    selectedMonth,
    maxCostFilter,
    schoolHolidayFilter,
    sortBy,
    pageSize,
    destinationSearchFilter,
    destinationCountryFilter,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    boardTypeFilter,
    overlandDurationFilter,
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
              setLoadedAdultMembers(adultMembers);
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

          if (p.maxDrivingHours !== undefined && p.maxDrivingHours !== null) {
            setMaxDrivingHours(Number(p.maxDrivingHours));
          }
          if (p.preferredCabinClass) {
            setPreferredCabinClass(p.preferredCabinClass);
          }
          if (p.climatePreference) {
            setClimatePreference(p.climatePreference);
          }
          if (Array.isArray(p.travelModes)) {
            setTravelModes(p.travelModes);
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
              setSelectedStyles([sw.preferredVacationStyle]);
            }
            if ((p.maxTravelHours === null || p.maxTravelHours === undefined) && sw.maxOverlandTravelMinutes) {
              setMaxOverlandDurationHours(Math.round(sw.maxOverlandTravelMinutes / 60));
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

  // Two-way sync: Save current travel filters to Family Profile
  const handleSaveToProfile = async () => {
    try {
      setSavingProfile(true);
      setSaveProfileSuccess(false);

      const validBlackouts = searchBlackouts.filter((b) => b.startDate && b.endDate);

      // Preserve existing adult details (names, birthdates) if available, or generate standard adult member records
      const adultRecords = [];
      for (let i = 0; i < adultsCount; i++) {
        const existing = loadedAdultMembers[i];
        if (existing) {
          adultRecords.push(existing);
        } else {
          adultRecords.push({
            role: 'PARENT',
            firstName: `Adult ${i + 1}`,
            birthDate: '1985-01-01',
            schoolRequired: false,
          });
        }
      }

      const childRecords = childrenList.map((c) => ({
        role: 'CHILD',
        birthDate: c.birthDate,
        schoolRequired: true,
      }));

      const membersToSave = [...adultRecords, ...childRecords];

      const payload = {
        homeLocation: departureLocation,
        federalState,
        originAirports,
        maxDrivingHours,
        maxTravelHours: maxOverlandDurationHours,
        travelModes: selectedVehicles,
        scoringWeights: {
          preferredBoardType,
          preferredVacationStyle: selectedStyles[0] || 'ALL',
          maxOverlandTravelMinutes: maxOverlandDurationHours ? maxOverlandDurationHours * 60 : undefined,
        },
        blackoutRanges: validBlackouts,
        members: membersToSave,
      };

      const res = await fetch('/api/family-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to update family profile');
      }

      setSaveProfileSuccess(true);
      setTimeout(() => setSaveProfileSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error saving to profile:', err);
      alert(err.message || 'Error saving to family profile');
    } finally {
      setSavingProfile(false);
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
          maxDrivingHours,
          preferredCabinClass,
          climatePreference,
          travelModes,
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
      try {
        localStorage.setItem(
          'famvac_cached_results',
          JSON.stringify({ timestamp: Date.now(), windows: data.windows })
        );
      } catch {
        // Storage quota / disabled
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filtered and Sorted Results
  const filteredResults = useMemo(() => {
    if (!results) return [];
    let list = [...results];

    if (selectedMonth !== 'ALL') {
      list = list.filter((w) => {
        const m = w.startDate.split('-')[1];
        return m === selectedMonth;
      });
    }

    if (resultStyleFilter !== 'ALL') {
      list = list.filter((w) => {
        const styles = getDestinationVacationStyles(w.destinationAirport, w.flightDistanceKm);
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
      list = list.filter((w) => !w.seasonalWarning);
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
    selectedMonth,
    resultStyleFilter,
    distanceFilter,
    vehicleFilter,
    safetyFilter,
    warningFilter,
    boardTypeFilter,
    overlandDurationFilter,
    schoolHolidayFilter,
    maxCostFilter,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const displayedResults = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredResults.slice(startIdx, startIdx + pageSize);
  }, [filteredResults, currentPage, pageSize]);

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
      const profile = getDestinationProfile(destCode);
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
        vacationType: profile?.type,
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
  }, [filteredResults, sortBy, locale]);

  // Available Countries across destination groups
  const availableDestinationCountries = useMemo(() => {
    const countrySet = new Set<string>();
    destinationGroups.forEach((g) => {
      const c = g.destinationCountry;
      if (c) countrySet.add(c);
    });
    return Array.from(countrySet).sort((a, b) => a.localeCompare(b));
  }, [destinationGroups]);

  // Filtered Destination Groups (filtered by search input and country filter)
  const filteredDestinationGroups = useMemo(() => {
    let list = destinationGroups;

    if (destinationCountryFilter !== 'ALL') {
      list = list.filter((g) => {
        const c = g.destinationCountry || '';
        return c.toLowerCase() === destinationCountryFilter.toLowerCase();
      });
    }

    if (destinationSearchFilter.trim()) {
      const q = destinationSearchFilter.trim().toLowerCase();
      list = list.filter((g) => {
        const name = g.destinationName.toLowerCase();
        const code = g.destinationCode.toLowerCase();
        const city = (g.destinationCity || '').toLowerCase();
        const country = (g.destinationCountry || '').toLowerCase();
        return name.includes(q) || code.includes(q) || city.includes(q) || country.includes(q);
      });
    }

    return list;
  }, [destinationGroups, destinationSearchFilter, destinationCountryFilter]);

  const expandAllDestinations = () => {
    const all: Record<string, boolean> = {};
    filteredDestinationGroups.forEach((g) => {
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
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative"
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Destination Header in Top Space of Timeframe Column */}
            {!options?.hideDestinationHeader && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-blue-700 tracking-wide pb-0.5">
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
                  className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 hover:underline cursor-pointer group text-left"
                  title={t.home.showOnMap}
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="font-extrabold text-slate-900 text-sm">
                    {getFormattedLocalizedDestination(win.destinationAirport, win.destinationName)}
                  </span>
                  <span className="text-[10px] font-normal text-blue-500">
                    ({t.home.showOnMap})
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
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base sm:text-lg">
                {formatLocalizedDate(win.startDate, true)} → {formatLocalizedDate(win.endDate, true)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {win.durationDays} {t.home.days}
              </span>
              {win.pricingDetails?.flight?.isMidweekSaving && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  {t.home.midweekFlightDealBadge}
                </span>
              )}
              {win.weather?.hasSnow && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Snowflake className="w-3 h-3 text-indigo-600" />
                  {t.home.winterSportsActiveBadge}
                  {win.weather.snowDepthCm ? ` (~${win.weather.snowDepthCm} cm)` : ''}
                </span>
              )}
              {win.weather?.waterTempC !== null && win.weather?.waterTempC !== undefined && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                  <Waves className="w-3 h-3 text-teal-600" />
                  {win.weather.waterTempC}°C {t.home.waterTempLabel}
                </span>
              )}
              {(() => {
                const safety = win.destinationSafety || win.safetyAssessment;
                if (!safety) return null;
                if (safety.isSafe) {
                  return (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {t.home.safeDestinationBadge}
                    </span>
                  );
                }
                return (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1"
                    title={safety.warningDetails || safety.safetyLabel}
                  >
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    {safety.advisoryTitle || safety.safetyLabel}
                  </span>
                );
              })()}
              {win.boardType && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200 flex items-center gap-1">
                  <Utensils className="w-3 h-3 text-violet-600" />
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
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
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
              />
              <span>•</span>
              <ClimateDetailsPopover
                destinationAirport={win.destinationAirport}
                weather={win.weather}
              />
            </div>
          </div>

          {/* Price & Travel Portal Deals Section */}
          <div className="flex flex-col sm:items-end justify-between gap-2.5 sm:gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div className="flex items-baseline justify-between sm:justify-end sm:text-right gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  {t.home.estFamilyCost}
                </span>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(win.estimatedTotalCost)}
                </span>
                {win.effectiveCost && win.mealPlanValue && win.mealPlanValue > 0 && win.boardType === 'ALL_INCLUSIVE' && (
                  <div className="text-[10px] text-emerald-700 font-semibold sm:text-right mt-0.5 flex items-center gap-1 sm:justify-end">
                    <Utensils className="w-2.5 h-2.5" />
                    <span>{t.home.boardTypeSavingsBadge}: ~€{win.mealPlanValue}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <span>~{formatCurrency(win.pricePerPerson)} / {t.home.perPerson}</span>
                <span className="block text-[10px] text-slate-400">
                  ({t.home.flightAndLodgingIncluded})
                </span>
              </div>
            </div>

            <div className="w-full sm:w-auto flex sm:justify-end">
              <BookingDealsPopover
                pricingDetails={win.pricingDetails}
                estimatedTotalCost={win.estimatedTotalCost}
                originAirport={win.originAirport}
                destinationAirport={win.destinationAirport}
                countryCode={country}
                startDate={win.startDate}
                endDate={win.endDate}
                adults={adultsCount}
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </div>

        {/* School Holiday Exemption Warning */}
        {win.requiresSchoolExemption && (
          <div className="mt-3 p-2.5 rounded-lg bg-orange-50 border border-orange-300 flex items-start gap-2 text-xs text-orange-900">
            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {t.home.requiresSchoolExemptionWarning}
              </span>
              {win.schoolHolidayDaysOverlap !== undefined && win.schoolHolidayDaysOverlap > 0 ? (
                <span className="text-[11px] text-orange-800">
                  {win.schoolHolidayDaysOverlap} / {win.durationDays} {t.home.days} {t.home.schoolAgeBadge}
                </span>
              ) : (
                <span className="text-[11px] text-orange-800">
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
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {t.home.seasonalWarningBadge}: {localized.title}
                </span>
                <span className="text-[11px] text-amber-800">
                  {localized.description}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Metrics Bar with MetricExplanationPopover */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 rounded-lg p-2.5 sm:p-2 flex sm:flex-col items-center sm:items-stretch justify-between sm:text-center">
            <span className="text-slate-500 text-xs sm:text-[10px] font-medium">{t.home.ptoConsumed}</span>
            <div className="text-right sm:text-center">
              <span className="font-bold text-slate-800 sm:block">
                {win.ptoDaysConsumed} {t.home.days}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium sm:block ml-1.5 sm:ml-0">
                ({win.publicHolidaysCount} {t.home.ptoSaved})
              </span>
            </div>
          </div>

          <MetricExplanationPopover window={win} trigger="ptoRatio" className="w-full">
            <div className="bg-slate-50 hover:bg-slate-100/90 transition rounded-lg p-2.5 sm:p-2 flex sm:flex-col items-center sm:items-stretch justify-between sm:text-center group border border-transparent hover:border-slate-300">
              <span className="text-slate-500 text-xs sm:text-[10px] font-medium flex items-center justify-between sm:justify-center gap-1">
                {t.home.ptoRatio}
                <Info className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
              </span>
              <span className="font-bold text-slate-800 text-right sm:text-center">
                {win.ptoEfficiencyRatio}x
              </span>
            </div>
          </MetricExplanationPopover>

          <MetricExplanationPopover window={win} trigger="score" className="w-full">
            <div className="bg-indigo-50/80 hover:bg-indigo-100/90 transition rounded-lg p-2.5 sm:p-2 flex sm:flex-col items-center sm:items-stretch justify-between sm:text-center border border-indigo-100/60 hover:border-indigo-300 group">
              <span className="text-indigo-700 text-xs sm:text-[10px] font-semibold flex items-center justify-between sm:justify-center gap-1">
                {t.home.score}
                <Info className="w-3 h-3 text-indigo-400 opacity-60 group-hover:opacity-100" />
              </span>
              <div className="flex items-center gap-1.5 sm:justify-center">
                <span className="font-extrabold text-indigo-900 text-sm">
                  {win.finalScore} / 100
                </span>
                {options?.rank !== undefined && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">#{options.rank}</span>
                )}
              </div>
            </div>
          </MetricExplanationPopover>
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
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            {t.home.heroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t.home.heroTitle}
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            {t.home.heroDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              {t.home.constraintsTitle}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
                title="Reset form and cached settings"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              {profileLoaded && (
                <span
                  className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1.5"
                  title={t.home.prefilledFromProfile}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  {t.home.prefilledFromProfile}
                </span>
              )}
            </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.home.countryLabel}
                  </label>
                  <select
                    suppressHydrationWarning
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code} suppressHydrationWarning>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.home.homeStateLabel}
                  </label>
                  <select
                    suppressHydrationWarning
                    value={federalState}
                    onChange={(e) => setFederalState(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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

                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 sm:col-span-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>{t.home.holidayScopeNotice}</span>
                </p>
              </div>
            </div>

            {/* Step 2: Travel Destinations & Vacation Style */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              {/* Multi-Entry Destination Input */}
              <MultiDestinationInput
                selectedDestinations={targetDestinations}
                onChange={setTargetDestinations}
              />

              {/* Kind of Vacation (Vacation Style) selector - Only visible when no destinations are defined */}
              {targetDestinations.length === 0 && (
                <div>
                  <div className="mb-2.5 space-y-0.5">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t.home.vacationKindLabel}</span>
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
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
                          onClick={() => toggleVacationStyle(item.type)}
                          className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/25'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {/* Top row: Icon & Selection indicator */}
                          <div className="flex items-center justify-between w-full">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                            )}
                          </div>

                          {/* Middle: Label */}
                          <span className="font-bold text-xs truncate block text-left w-full">
                            {item.label}
                          </span>

                          {/* Bottom: Sub-option or category hint */}
                          <div className="w-full text-left">
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
                                    <Snowflake className={`w-2.5 h-2.5 flex-shrink-0 ${requireSnow ? 'text-indigo-950' : 'text-blue-200'}`} />
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
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Alle Stile & flexibel' : 'All styles & flexible'}
                              </span>
                            ) : item.type === 'CITY' ? (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Kultur & City' : 'Culture & city trip'}
                              </span>
                            ) : item.type === 'NATURE' ? (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                {locale.startsWith('de') ? 'Natur & Erholung' : 'Nature & outdoor'}
                              </span>
                            ) : (
                              <span className={`text-[10px] truncate block ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
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
            <div className="pt-2 border-t border-slate-100">
              <div className="mb-2.5 space-y-0.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.home.travelVehicleLabel}</span>
                </label>
                <p className="text-[11px] text-slate-500 font-medium">
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
                      onClick={() => toggleVehicle(v.type)}
                      className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer select-none shadow-2xs h-[82px] sm:h-[86px] ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/25'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {/* Top row: Icon & Selection indicator */}
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                        )}
                      </div>

                      {/* Middle: Label */}
                      <span className="font-bold text-xs truncate block text-left w-full">
                        {v.label}
                      </span>

                      {/* Bottom: Vehicle Hint */}
                      <div className="w-full text-left">
                        <span
                          className={`text-[10px] truncate block ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {v.hint}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preferred Board Type & Max Overland Travel Time */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t.home.filterByBoardType}</span>
                </label>
                <select
                  value={preferredBoardType || 'ALL'}
                  onChange={(e) => setPreferredBoardType(e.target.value === 'ALL' ? undefined : (e.target.value as BoardType))}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium text-slate-800"
                >
                  <option value="ALL">{t.home.allBoardTypes}</option>
                  <option value="ALL_INCLUSIVE">{t.home.boardTypeAllInclusive}</option>
                  <option value="HALF_BOARD">{t.home.boardTypeHalfBoard}</option>
                  <option value="BREAKFAST">{t.home.boardTypeBreakfast}</option>
                  <option value="ROOM_ONLY">{t.home.boardTypeRoomOnly}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-teal-600" />
                  <span>{t.home.filterByOverlandDuration}</span>
                </label>
                <select
                  value={maxOverlandDurationHours ? String(maxOverlandDurationHours) : 'ALL'}
                  onChange={(e) => setMaxOverlandDurationHours(e.target.value === 'ALL' ? undefined : Number(e.target.value))}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium text-slate-800"
                >
                  <option value="ALL">{t.home.overlandDurationAny}</option>
                  <option value="6">{t.home.overlandDuration6h}</option>
                  <option value="10">{t.home.overlandDuration10h}</option>
                  <option value="14">{t.home.overlandDuration14h}</option>
                </select>
              </div>
            </div>

            {/* Step 3: Departure Airports (for Plane) or Overland Transit Note (for Car/Train/Bus) */}
            {selectedVehicles.includes('PLANE') ? (
              <div className="pt-2 border-t border-slate-100">
                <AirportSelector
                  selectedAirports={originAirports}
                  onChange={setOriginAirports}
                  coordinates={departureCoords}
                  targetDestinations={targetDestinations}
                />
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100">
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-slate-800">
                      {selectedVehicles.map((v) => getVehicleMeta(v).label).join(' / ')}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Reisedistanz, Transitzeit und Fahrtkosten werden direkt von Ihren Startkoordinaten über Land berechnet. Es werden nur erreichbare Destinationen ohne Flugstrecke vorgeschlagen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Travelers (Adults & Children) */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  {t.home.partyTitle}
                </label>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {adultsCount + childrenList.length} {adultsCount + childrenList.length === 1 ? 'Traveler' : 'Travelers'}
                </span>
              </div>

              {/* Adults Selector */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-800">
                    {t.home.adultsLabel}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {t.home.adultsHint}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdultsCount((prev) => Math.max(1, prev - 1))}
                    disabled={adultsCount <= 1}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs text-xs cursor-pointer"
                    aria-label="Decrease adults"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-900">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdultsCount((prev) => Math.min(10, prev + 1))}
                    disabled={adultsCount >= 10}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs text-xs cursor-pointer"
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
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.home.durationLabel}</span>
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.durationMinLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMin}
                    onChange={(e) => setDurationDaysMin(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.durationMaxLabel}
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={durationDaysMax}
                    onChange={(e) => setDurationDaysMax(Number(e.target.value))}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 6: Search Date Range (Strictly Future Dates) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{locale.startsWith('de') ? 'Reisezeitraum' : 'Travel Dates'} ({t.home.earliestDateLabel} &amp; {t.home.latestDateLabel})</span>
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.earliestDateLabel}
                  </span>
                  <input
                    type="date"
                    min={todayStr}
                    value={earliestDate}
                    onChange={(e) => setEarliestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                    {t.home.latestDateLabel}
                  </span>
                  <input
                    type="date"
                    min={earliestDate || todayStr}
                    value={latestDate}
                    onChange={(e) => setLatestDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 7: Blackout Periods (Sperrzeiten) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    {t.home.blackoutFilterTitle}
                  </span>
                  {searchBlackouts.length > 0 && (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/70">
                      {searchBlackouts.length}
                    </span>
                  )}
                </div>

                {/* Blackout List & Presets: Only show holiday buttons when user is adding or has blackout periods */}
                {searchBlackouts.length === 0 && !isAddingBlackout ? (
                  <div className="p-2.5 bg-amber-50/50 rounded-xl border border-dashed border-amber-300 text-center">
                    <p className="text-xs text-amber-800/80">{t.home.noBlackouts}</p>
                    <button
                      type="button"
                      onClick={addBlackout}
                      className="mt-1 text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                    >
                      + {t.home.addBlackout}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Quick Add Special Moving Periods (Ostern, Pfingsten, Himmelfahrt, Fronleichnam, Silvester) */}
                    {annualSpecialTimes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900/75">
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
                                    : 'bg-white/80 hover:bg-white text-amber-900 border-amber-200/90 hover:border-amber-300 shadow-2xs'
                                }`}
                                title={`${period.name} (${period.startDate} - ${period.endDate}): ${period.description}`}
                              >
                                <span>{period.icon}</span>
                                <span>{period.displayName}</span>
                                {isSelected ? (
                                  <Check className="w-3 h-3 ml-0.5" />
                                ) : (
                                  <Plus className="w-3 h-3 ml-0.5 text-amber-600" />
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
                          className="px-2.5 py-1.5 bg-white/95 rounded-lg border border-amber-200/90 flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs transition-all hover:bg-white hover:border-amber-300 shadow-xs"
                        >
                          {/* Number & Date Range */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300/80 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="date"
                              min={todayStr}
                              value={b.startDate}
                              onChange={(e) => updateBlackout(idx, 'startDate', e.target.value)}
                              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white outline-none w-28 sm:w-32 focus:ring-1 focus:ring-amber-500"
                            />
                            <span className="text-slate-400 font-medium text-xs flex-shrink-0">→</span>
                            <input
                              type="date"
                              min={b.startDate || todayStr}
                              value={b.endDate}
                              onChange={(e) => updateBlackout(idx, 'endDate', e.target.value)}
                              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white outline-none w-28 sm:w-32 focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          {/* Optional Reason & Delete */}
                          <div className="flex items-center gap-1.5 flex-grow min-w-[120px]">
                            <input
                              type="text"
                              placeholder={t.home.blackoutReasonPlaceholder}
                              value={b.reason || ''}
                              onChange={(e) => updateBlackout(idx, 'reason', e.target.value)}
                              className="w-full text-xs rounded border border-slate-300 px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-amber-500"
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

            {/* Profile Sync Button */}
            {session && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSaveToProfile}
                  disabled={savingProfile}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 transition-colors disabled:opacity-50"
                >
                  {saveProfileSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">{t.home.savedToProfileSuccess}</span>
                    </>
                  ) : savingProfile ? (
                    <>
                      <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>{t.home.savingToProfile}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t.home.saveToProfile}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Submit Optimization Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
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
          <div className="border-b border-slate-200 pb-2.5 space-y-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              {t.home.resultsTitle}
            </h2>
            {results && (
              <p className="text-xs font-medium text-slate-500">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[11px]">
                  {filteredResults.length} / {results.length} {t.home.windowsFound}
                </span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
              {error}
            </div>
          )}

          {!results && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl">
                <Sun className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-slate-800 font-semibold text-base">{t.home.readyTitle}</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">{t.home.readyDescription}</p>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="font-semibold text-amber-900 text-sm">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationTitle
                  : t.home.noResultsTitle}
              </p>
              <p className="text-xs text-amber-700">
                {targetDestinations.length > 0
                  ? t.home.noResultsForDestinationHint
                  : t.home.noResultsHint}
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <>
              {/* Filter and Sort Toolbar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Filter Toggle Button + Active Count + Reset */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResultFilters((prev) => !prev)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        showResultFilters
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      <span>{showResultFilters ? t.home.filterToggleHide : t.home.filterToggleShow}</span>
                      {activeFilterCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          {activeFilterCount}
                        </span>
                      )}
                      {showResultFilters ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-[11px] font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded transition hover:bg-red-50 cursor-pointer"
                        title={t.home.filterResetAll}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">{t.home.filterResetAll}</span>
                      </button>
                    )}
                  </div>

                  {/* Right: View Mode Switcher */}
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setViewMode('destination')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                        viewMode === 'destination'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
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
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
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
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>{t.home.viewModeList}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Filter Panel: One clean filter per line */}
                {showResultFilters && (
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {/* Line 1: Month Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.home.filterByMonth}</span>
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
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
                    </div>

                    {/* Line 2: Vacation Style Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.home.filterByVacationStyle}</span>
                      </label>
                      <select
                        value={resultStyleFilter}
                        onChange={(e) => {
                          setResultStyleFilter(e.target.value as DestinationType);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="ALL">{t.home.vacationKindAll}</option>
                        <option value="BEACH">{t.home.vacationKindBeach}</option>
                        <option value="ALPINE">{t.home.vacationKindAlpine}</option>
                        <option value="CITY">{t.home.vacationKindCity}</option>
                        <option value="NATURE">{t.home.vacationKindNature}</option>
                        <option value="LONGRANGE">{t.home.vacationKindLongrange}</option>
                      </select>
                    </div>

                    {/* Line 3: Flight Distance Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Plane className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.home.filterByDistance}</span>
                      </label>
                      <select
                        value={distanceFilter}
                        onChange={(e) => {
                          setDistanceFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="ALL">{t.home.allDistances}</option>
                        <option value="SHORT">{t.home.distShort}</option>
                        <option value="MID">{t.home.distMid}</option>
                        <option value="EXTENDED">{t.home.distExtended}</option>
                        <option value="LONG">{t.home.distLong}</option>
                        <option value="INTERCONTINENTAL">{t.home.distIntercontinental}</option>
                      </select>
                    </div>

                    {/* Line 4: Travel Vehicle Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.home.filterByVehicle}</span>
                      </label>
                      <select
                        value={vehicleFilter}
                        onChange={(e) => {
                          setVehicleFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="ALL">{t.home.vehicleAll}</option>
                        <option value="PLANE">{t.home.vehiclePlane}</option>
                        <option value="CAR">{t.home.vehicleCar}</option>
                        <option value="TRAIN">{t.home.vehicleTrain}</option>
                        <option value="BUS">{t.home.vehicleBus}</option>
                      </select>
                    </div>

                    {/* Line 5: Destination Safety Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.home.filterBySafety}</span>
                      </label>
                      <select
                        value={safetyFilter}
                        onChange={(e) => {
                          setSafetyFilter(e.target.value as any);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="SAFE_ONLY">{t.home.safetyFilterSafeOnly}</option>
                        <option value="ALL">{t.home.safetyFilterAll}</option>
                      </select>
                    </div>

                    {/* Line 6: Seasonal Warnings Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.home.filterByWarnings}</span>
                      </label>
                      <select
                        value={warningFilter}
                        onChange={(e) => {
                          setWarningFilter(e.target.value as any);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="CLEAN_ONLY">{t.home.warningsFilterCleanOnly}</option>
                        <option value="ALL">{t.home.warningsFilterAll}</option>
                      </select>
                    </div>

                    {/* Line 7: Board Type Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5 text-violet-600" />
                        <span>{t.home.filterByBoardType}</span>
                      </label>
                      <select
                        value={boardTypeFilter}
                        onChange={(e) => {
                          setBoardTypeFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="ALL">{t.home.allBoardTypes}</option>
                        <option value="ALL_INCLUSIVE">{t.home.boardTypeAllInclusive}</option>
                        <option value="HALF_BOARD">{t.home.boardTypeHalfBoard}</option>
                        <option value="BREAKFAST">{t.home.boardTypeBreakfast}</option>
                        <option value="ROOM_ONLY">{t.home.boardTypeRoomOnly}</option>
                      </select>
                    </div>

                    {/* Line 8: Max Overland Duration Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-teal-600" />
                        <span>{t.home.filterByOverlandDuration}</span>
                      </label>
                      <select
                        value={overlandDurationFilter}
                        onChange={(e) => {
                          setOverlandDurationFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="ALL">{t.home.overlandDurationAny}</option>
                        <option value="360">{t.home.overlandDuration6h}</option>
                        <option value="600">{t.home.overlandDuration10h}</option>
                        <option value="840">{t.home.overlandDuration14h}</option>
                      </select>
                    </div>

                    {/* Line 9: School Calendar Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.home.schoolHolidaysFilterLabel}</span>
                      </label>
                      <select
                        value={schoolHolidayFilter}
                        onChange={(e) => {
                          setSchoolHolidayFilter(e.target.value as any);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="all">{t.home.filterAllDates}</option>
                        <option value="holidaysOnly">{t.home.filterSchoolHolidaysOnly}</option>
                      </select>
                    </div>

                    {/* Line 6: Max Cost Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 border-b border-slate-50">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.home.filterByCost}</span>
                      </label>
                      <input
                        type="number"
                        placeholder="z. B. 3500 €"
                        value={maxCostFilter || ''}
                        onChange={(e) => {
                          setMaxCostFilter(e.target.value ? Number(e.target.value) : undefined);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      />
                    </div>

                    {/* Line 7: Sort By */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.home.sortBy}</span>
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full sm:w-64 text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="score">{t.home.sortScore}</option>
                        <option value="date-asc">{t.home.sortDateAsc}</option>
                        <option value="date-desc">{t.home.sortDateDesc}</option>
                        <option value="price">{t.home.sortPrice}</option>
                        <option value="pto">{t.home.sortPto}</option>
                        <option value="duration">{t.home.sortDuration}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {filteredResults.length === 0 ? (
                <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-xs">
                  No vacation windows match the active filters.
                </div>
              ) : viewMode === 'destination' ? (
                /* Group by Destination View */
                <div className="space-y-4">
                  {/* Destination View Controls & Filter Bar */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/90 space-y-2.5">
                    {/* Full-width Search Bar Overlay when search is opened or active */}
                    {(isDestinationSearchOpen || destinationSearchFilter) && (
                      <div className="relative flex items-center w-full animate-in fade-in duration-150">
                        <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={destinationSearchFilter}
                          onChange={(e) => setDestinationSearchFilter(e.target.value)}
                          placeholder={t.home.filterDestinationsPlaceholder}
                          className="w-full text-xs sm:text-sm rounded-xl border border-blue-400 pl-9 pr-9 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-xs font-medium placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDestinationSearchFilter('');
                            setIsDestinationSearchOpen(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
                          title="Schließen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Search Button (when search field is not open) */}
                        {!isDestinationSearchOpen && !destinationSearchFilter && (
                          <button
                            type="button"
                            onClick={() => setIsDestinationSearchOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer hover:border-slate-300 transition"
                          >
                            <Search className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t.home.searchDestinationsButton}</span>
                          </button>
                        )}

                        {/* Country / Territory Dropdown Filter */}
                        {availableDestinationCountries.length > 1 && (
                          <div className="w-48 sm:w-56">
                            <select
                              value={destinationCountryFilter}
                              onChange={(e) => setDestinationCountryFilter(e.target.value)}
                              className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium shadow-2xs"
                            >
                              <option value="ALL">
                                {t.home.allCountries} ({availableDestinationCountries.length})
                              </option>
                              {availableDestinationCountries.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Right side controls: Count badge & Compact Collapse/Expand All */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-600 text-xs">
                          <span className="font-bold text-blue-700">{filteredDestinationGroups.length}</span>
                          {destinationGroups.length !== filteredDestinationGroups.length && (
                            <span className="text-slate-400"> / {destinationGroups.length}</span>
                          )}{' '}
                          {t.home.destinationsCountBadge}
                        </span>

                        {filteredDestinationGroups.length > 0 && (
                          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                            <button
                              type="button"
                              onClick={expandAllDestinations}
                              title={t.home.expandAllAlternativeDates}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:border-blue-300 transition"
                            >
                              <ChevronsUpDown className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[11px]">+</span>
                            </button>
                            <button
                              type="button"
                              onClick={collapseAllDestinations}
                              title={t.home.collapseAllAlternativeDates}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:border-slate-300 transition"
                            >
                              <ChevronsDownUp className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[11px]">-</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Country Pills if multiple countries exist */}
                  {availableDestinationCountries.length > 2 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setDestinationCountryFilter('ALL')}
                        className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap ${
                          destinationCountryFilter === 'ALL'
                            ? 'bg-blue-600 text-white shadow-xs font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t.home.allCountries}
                      </button>
                      {availableDestinationCountries.slice(0, 10).map((c) => {
                        const count = destinationGroups.filter((g) => g.destinationCountry === c).length;
                        const isSelected = destinationCountryFilter === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setDestinationCountryFilter(isSelected ? 'ALL' : c)}
                            className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap flex items-center gap-1 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span>{c}</span>
                            <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state when destination filter matches 0 */}
                  {filteredDestinationGroups.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                      <p className="text-xs text-slate-600 font-medium">
                        {t.home.noDestinationsMatchFilter}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDestinationSearchFilter('');
                          setDestinationCountryFilter('ALL');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t.home.clearDestinationFilter}
                      </button>
                    </div>
                  ) : (
                    /* Destination Cards List */
                    <div className="space-y-6">
                      {filteredDestinationGroups.map((group) => {
                    const isExpanded = expandedDestinations[group.destinationCode];
                    return (
                      <div
                        key={group.destinationCode}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition"
                      >
                        {/* Group Header */}
                        <div className="bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/20 p-4 border-b border-slate-200 space-y-3">
                          {/* Top: Airport Code, Destination Title & Vacation Style Tags (Wide full row) */}
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs flex-shrink-0 mt-0.5 sm:mt-0">
                              {group.destinationCode}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                                  {group.destinationName}
                                </h3>
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
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Stats & Action Buttons (Pulled down for maximum room) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70">
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                              <span title={`${group.totalWindows} raw date & duration combinations evaluated`}>
                                {t.home.destGroupTimeframesFound.replace(
                                  '{count}',
                                  String(group.alternativeWindows.length + 1)
                                )}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">
                                {t.home.destGroupFromPrice.replace(
                                  '{price}',
                                  formatCurrency(group.lowestPrice)
                                )}
                              </span>
                            </p>

                            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
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
                                className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                                title={t.home.showOnMap}
                              >
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                <span>{t.home.showOnMap}</span>
                              </button>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                {t.home.destGroupFeaturedBadge}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Featured Top-Scoring Vacation Window */}
                        <div className="p-4 bg-white">
                          {renderVacationCard(group.featuredWindow, { rank: 1, hideDestinationHeader: true })}
                        </div>

                        {/* Alternative Dates Accordion */}
                        {group.alternativeWindows.length > 0 && (
                          <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                            <button
                              type="button"
                              onClick={() => toggleDestinationExpand(group.destinationCode)}
                              className="w-full flex items-center justify-between text-xs font-bold text-blue-700 hover:text-blue-900 transition py-1 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                {isExpanded
                                  ? t.home.destGroupHideAlternativeDates
                                  : t.home.destGroupAlternativeDates.replace('{count}', String(group.alternativeWindows.length))}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
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
                  {timeframeGroups.map((group) => {
                    const isExpanded = expandedTimeframes[group.key];
                    const shownWindows = isExpanded ? group.windows : group.windows.slice(0, 3);
                    return (
                      <div key={group.key} className="space-y-3">
                        {/* Timeframe Group Header */}
                        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-yellow-300" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-white text-base sm:text-lg">
                                {group.title}
                              </h3>
                              <p className="text-xs text-blue-100 flex items-center gap-2 mt-0.5">
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
                              className="px-4 py-2 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
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
                </div>
              ) : (
                /* Flat List View */
                <div className="space-y-4">
                  {displayedResults.map((win, idx) => {
                    const globalRank = (currentPage - 1) * pageSize + idx + 1;
                    return renderVacationCard(win, { rank: globalRank });
                  })}

                  {/* Pagination Controls */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{t.home.resultsPerPage}:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white outline-none"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                      <span className="text-slate-400 ml-2">
                        {t.home.page} {currentPage} {t.home.of} {totalPages}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
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
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
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
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
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
