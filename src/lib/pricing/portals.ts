/**
 * Builds a HolidayCheck/CHECK24-style room-allocation string: one letter
 * token per adult, then each child encoded as its own age (not a headcount),
 * e.g. 2 adults + a 3-year-old => "a-a-3" (HolidayCheck) / "A-A-3" (CHECK24).
 */
function buildRoomAllocation(adults: number, childrenAges: number[] | undefined, adultToken: string): string {
  const tokens = [...Array(adults).fill(adultToken), ...(childrenAges || []).map(String)];
  return tokens.join('-');
}

export type PortalMarket = 'DACH' | 'OCEANIA' | 'NORTH_AMERICA' | 'GLOBAL';

export type PortalCategory = 'flight' | 'package' | 'lodging' | 'metasearch';

export type PortalBadgeKey = 'hotels' | 'package' | 'comparison' | 'deals' | 'direct';

export interface TravelPortal {
  id: string;
  name: string;
  markets: PortalMarket[];
  category: PortalCategory;
  /** Translated tag shown on the portal button */
  badgeKey?: PortalBadgeKey;
  /** Untranslated tag: the portal's own product name (e.g. "Express Deals") */
  badge?: string;
  colorClass: string;
  buildUrl: (params: {
    originAirport: string;
    /** All of the user's selected departure airports, when a portal's search supports a multi-airport list (falls back to [originAirport] if omitted). */
    originAirports?: string[];
    destinationAirport: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    adults?: number;
    /** Children's ages, used by portals (HolidayCheck, CHECK24) whose room-allocation parameter encodes each child as its age rather than a headcount. */
    childrenAges?: number[];
  }) => string;
}

export const TRAVEL_PORTALS: TravelPortal[] = [
  // --- GLOBAL / METASEARCH ---
  {
    id: 'google_flights',
    name: 'Google Flights',
    markets: ['GLOBAL', 'DACH', 'OCEANIA', 'NORTH_AMERICA'],
    category: 'metasearch',
    colorClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate }) =>
      `https://www.google.com/travel/flights?q=Flights%20to%20${destinationAirport}%20from%20${originAirport}%20on%20${startDate}%20through%20${endDate}`,
  },
  {
    id: 'skyscanner',
    name: 'Skyscanner',
    markets: ['GLOBAL', 'DACH', 'OCEANIA', 'NORTH_AMERICA'],
    category: 'metasearch',
    colorClass: 'bg-sky-600 hover:bg-sky-700 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate, adults = 2 }) => {
      const s = startDate.replace(/-/g, '').slice(2);
      const e = endDate.replace(/-/g, '').slice(2);
      return `https://www.skyscanner.net/transport/flights/${originAirport.toLowerCase()}/${destinationAirport.toLowerCase()}/${s}/${e}/?adultsv2=${adults}`;
    },
  },
  {
    id: 'kayak',
    name: 'Kayak',
    markets: ['GLOBAL', 'NORTH_AMERICA', 'DACH'],
    category: 'metasearch',
    colorClass: 'bg-orange-600 hover:bg-orange-700 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate }) =>
      `https://www.kayak.com/flights/${originAirport}-${destinationAirport}/${startDate}/${endDate}?sort=bestflight_a`,
  },
  {
    id: 'booking_com',
    name: 'Booking.com',
    markets: ['GLOBAL', 'DACH', 'OCEANIA', 'NORTH_AMERICA'],
    category: 'lodging',
    badgeKey: 'hotels',
    colorClass: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    buildUrl: ({ destinationAirport, startDate, endDate, adults = 2 }) =>
      `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destinationAirport)}&checkin=${startDate}&checkout=${endDate}&group_adults=${adults}`,
  },
  {
    id: 'trip_com',
    name: 'Trip.com',
    markets: ['GLOBAL', 'OCEANIA'],
    category: 'metasearch',
    colorClass: 'bg-blue-800 hover:bg-blue-900 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate }) =>
      `https://www.trip.com/flights/${originAirport.toLowerCase()}-to-${destinationAirport.toLowerCase()}/airtickets?dcity=${originAirport}&acity=${destinationAirport}&ddate=${startDate}&rdate=${endDate}`,
  },

  // --- DACH MARKET (Germany, Austria, Switzerland) ---
  // HolidayCheck and CHECK24's per-hotel deal links are addressed by internal
  // destination UUIDs we have no mapping for, but both also expose a
  // destination-less "browse by airport/dates" results listing, which is
  // what these build instead of a fabricated per-destination query string.
  {
    id: 'holidaycheck',
    name: 'HolidayCheck',
    markets: ['DACH'],
    category: 'package',
    badgeKey: 'package',
    colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    // Real, confirmed-working endpoint: /ah without `destinations` shows a
    // general (continent-level) hotel/package listing filtered by departure
    // airport(s), dates, and room allocation (airports lowercase, hyphen
    // separated; rooms = one lowercase "a" per adult, then each child as its
    // own age, hyphen separated, e.g. "a-a-3").
    buildUrl: ({ originAirport, originAirports, startDate, endDate, adults = 2, childrenAges }) => {
      const airports = originAirports && originAirports.length > 0 ? originAirports : [originAirport];
      const rooms = buildRoomAllocation(adults, childrenAges, 'a');
      const params = new URLSearchParams({
        airport: airports.join('-').toLowerCase(),
        availability: '1',
        departuredate: startDate,
        returndate: endDate,
        duration: 'exactly',
        rooms,
        travelkind: 'package',
      });
      return `https://www.holidaycheck.de/ah?${params.toString()}`;
    },
  },
  {
    id: 'check24',
    name: 'CHECK24',
    markets: ['DACH'],
    category: 'package',
    badgeKey: 'comparison',
    colorClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    // Real, confirmed-working endpoint: a region-level results browse (no
    // destination areaId/UUID needed, since we have no mapping from our
    // airport-code destinations to CHECK24's internal region/hotel ids)
    // filtered by departure airport(s), exact dates, and room allocation
    // (one "A" per adult, then each child as its own age, e.g. "A-A-3").
    buildUrl: ({ originAirport, originAirports, startDate, endDate, adults = 2, childrenAges }) => {
      const airports = originAirports && originAirports.length > 0 ? originAirports : [originAirport];
      const roomAllocation = buildRoomAllocation(adults, childrenAges, 'A');
      const params = new URLSearchParams({
        airport: airports.join(','),
        transportType: 'flight',
        roomAllocation,
        departureDate: startDate,
        returnDate: endDate,
        days: 'exact',
        pageArea: 'package',
        offerSort: 'default',
        areaSort: 'topregion',
        sorting: 'categoryDistribution',
        noRedirect: '1',
      });
      return `https://urlaub.check24.de/suche/region?${params.toString()}`;
    },
  },
  {
    id: 'ab_in_den_urlaub',
    name: 'ab-in-den-urlaub',
    markets: ['DACH'],
    category: 'package',
    badgeKey: 'deals',
    colorClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    // Real results endpoint is /find/hotels (confirmed working), driven by
    // dateMin/dateMax/durationMin/durationMax/adults/travelType/sortBy.
    // destinationId uses internal slugs (e.g. "destination-es-mallorca")
    // we have no mapping for, and the web form has no departure-airport
    // parameter (only the mobile app deep link does), so both are omitted
    // rather than guessed — this still lands on real, date-filtered results
    // instead of a dead /ibe/... path.
    buildUrl: ({ startDate, endDate, adults = 2 }) => {
      const durationDays = Math.max(
        1,
        Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
      );
      return `https://www.ab-in-den-urlaub.de/find/hotels?dateMin=${startDate}&dateMax=${endDate}&durationMin=${durationDays}&durationMax=${durationDays}&adults=${adults}&travelType=packageTour&sortBy=priceReductionDesc`;
    },
  },

  // --- OCEANIA / AUSTRALIA & NEW ZEALAND ---
  {
    id: 'webjet',
    name: 'Webjet',
    markets: ['OCEANIA'],
    category: 'flight',
    badge: 'AU Hub',
    colorClass: 'bg-red-600 hover:bg-red-700 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate, adults = 2 }) =>
      `https://www.webjet.com.au/flights/?from=${originAirport}&to=${destinationAirport}&depart=${startDate}&return=${endDate}&adults=${adults}`,
  },
  {
    id: 'wotif',
    name: 'Wotif',
    markets: ['OCEANIA'],
    category: 'package',
    badgeKey: 'package',
    colorClass: 'bg-teal-600 hover:bg-teal-700 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate, adults = 2 }) =>
      `https://www.wotif.com/Flights-Search?trip=roundtrip&leg1=from:${originAirport},to:${destinationAirport},departure:${startDate}TANYT&leg2=from:${destinationAirport},to:${originAirport},departure:${endDate}TANYT&passengers=adults:${adults}`,
  },

  // --- NORTH AMERICA (USA & CANADA) ---
  {
    id: 'expedia',
    name: 'Expedia',
    markets: ['NORTH_AMERICA', 'GLOBAL'],
    category: 'package',
    badgeKey: 'direct',
    colorClass: 'bg-yellow-500 hover:bg-yellow-600 text-slate-900',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate, adults = 2 }) =>
      `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=roundtrip&leg1=from:${originAirport},to:${destinationAirport},departure:${startDate}TANYT&leg2=from:${destinationAirport},to:${originAirport},departure:${endDate}TANYT&passengers=adults:${adults}`,
  },
  {
    id: 'priceline',
    name: 'Priceline',
    markets: ['NORTH_AMERICA'],
    category: 'metasearch',
    badge: 'Express Deals',
    colorClass: 'bg-blue-700 hover:bg-blue-800 text-white',
    buildUrl: ({ originAirport, destinationAirport, startDate, endDate, adults = 2 }) => {
      const s = startDate.replace(/-/g, '');
      const e = endDate.replace(/-/g, '');
      return `https://www.priceline.com/m/fly/search/${originAirport}-${destinationAirport}-${s}/${destinationAirport}-${originAirport}-${e}/?cabin-class=ECO&num-adults=${adults}`;
    },
  },
];

/**
 * Returns market-aware default portal IDs based on origin country.
 */
export function getDefaultPortalsForCountry(countryCode?: string): string[] {
  const c = (countryCode || '').toUpperCase();

  if (['DE', 'AT', 'CH'].includes(c)) {
    return ['google_flights', 'holidaycheck', 'check24', 'skyscanner', 'booking_com'];
  }

  if (['AU', 'NZ'].includes(c)) {
    return ['webjet', 'google_flights', 'wotif', 'skyscanner', 'booking_com'];
  }

  if (['US', 'CA', 'MX'].includes(c)) {
    return ['expedia', 'google_flights', 'priceline', 'kayak', 'booking_com'];
  }

  // Global default
  return ['google_flights', 'skyscanner', 'kayak', 'booking_com', 'trip_com'];
}

/**
 * Retrieves the user's active portal preferences from localStorage or country defaults.
 */
export function getActivePortals(countryCode?: string): TravelPortal[] {
  if (typeof window === 'undefined') {
    const defaultIds = getDefaultPortalsForCountry(countryCode);
    return TRAVEL_PORTALS.filter((p) => defaultIds.includes(p.id));
  }

  try {
    const stored = localStorage.getItem('famvac_preferred_portals');
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const matched = TRAVEL_PORTALS.filter((p) => parsed.includes(p.id));
        if (matched.length > 0) return matched;
      }
    }
  } catch {
    // Graceful fallback
  }

  const defaultIds = getDefaultPortalsForCountry(countryCode);
  return TRAVEL_PORTALS.filter((p) => defaultIds.includes(p.id));
}

/**
 * Saves user portal preferences to localStorage.
 */
export function saveActivePortalIds(portalIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('famvac_preferred_portals', JSON.stringify(portalIds));
  } catch (e) {
    console.error('Failed to save preferred portals:', e);
  }
}

