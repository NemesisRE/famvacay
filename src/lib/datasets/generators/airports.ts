import countries from 'i18n-iso-countries';
import enCountries from 'i18n-iso-countries/langs/en.json';
import openFlightsAirports from 'airport-data/airports.json';
import { type AirportRecord, type GeneratorContext, fetchText, parseCSVLine } from './common';

countries.registerLocale(enCountries);

/**
 * Commercial passenger airports worldwide, from OurAirports (public domain, fetched live) with
 * the city names travellers know from OpenFlights (ODbL): active airports with scheduled service
 * and a valid IATA code, sorted by code.
 *
 * OpenFlights comes from the pinned `airport-data` package rather than the live airports.dat:
 * the live file reassigns IATA codes to other airports (e.g. ACF -> Archerfield, Brisbane
 * instead of Aral, China), which would attach the wrong city to ~100 airports.
 */
const OURAIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

// Major hubs with directly integrated mainline / high-speed rail passenger terminals
const HSR_AIRPORT_CODES = new Set(['FRA', 'CDG', 'AMS', 'ZRH', 'BRU', 'DUS', 'LYS', 'LGW', 'LHR', 'FCO', 'VIE', 'BWI', 'HND']);

interface OpenFlightsAirport {
  name: string;
  city: string;
  icao: string;
}

function indexOpenFlights(): Map<string, OpenFlightsAirport> {
  const map = new Map<string, OpenFlightsAirport>();
  for (const a of openFlightsAirports as Array<{ iata?: string; icao?: string; name?: string; city?: string }>) {
    const iata = (a.iata || '').toUpperCase();
    if (iata.length === 3 && iata !== '\\N') map.set(iata, { name: a.name || '', city: a.city || '', icao: a.icao || '' });
  }
  return map;
}

export async function generateAirports(ctx: GeneratorContext): Promise<AirportRecord[]> {
  ctx.log('Airports: fetching OurAirports...');
  const csv = await fetchText(ctx, OURAIRPORTS_URL);
  const openFlights = indexOpenFlights();

  const lines = csv.split('\n');
  const header = parseCSVLine(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const [typeIdx, iataIdx, icaoIdx, nameIdx, latIdx, lonIdx, elevIdx, countryIdx, regionIdx, cityIdx, schedIdx, kwIdx] = [
    'type', 'iata_code', 'icao_code', 'name', 'latitude_deg', 'longitude_deg', 'elevation_ft',
    'iso_country', 'iso_region', 'municipality', 'scheduled_service', 'keywords',
  ].map(col);

  const airports: AirportRecord[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const parts = parseCSVLine(lines[i]);
    const iata = parts[iataIdx]?.toUpperCase();
    const type = parts[typeIdx];
    // Active commercial passenger airports with scheduled service and a valid 3-letter IATA code
    if (!iata || iata.length !== 3 || iata === '\\N' || seen.has(iata)) continue;
    if (type === 'closed' || type === 'heliport' || type === 'balloonport' || type === 'seaplane_base') continue;
    if (parts[schedIdx] !== 'yes') continue;
    const lat = parseFloat(parts[latIdx]);
    const lon = parseFloat(parts[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;
    seen.add(iata);

    const isoCountry = parts[countryIdx] || '';
    let state = parts[regionIdx] || '';
    if (iata === 'BER' || parts[cityIdx] === 'Berlin') state = 'DE-BE';
    const of = openFlights.get(iata);
    const item: AirportRecord = {
      code: iata,
      icao: parts[icaoIdx] || of?.icao || '',
      name: parts[nameIdx] || of?.name || '',
      city: of?.city || parts[cityIdx] || '',
      country: countries.getName(isoCountry, 'en') || isoCountry,
      state,
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      altitude: parseInt(parts[elevIdx], 10) || 0,
      type,
      isMajorHub: type === 'large_airport',
      isHighSpeedRailConnected: HSR_AIRPORT_CODES.has(iata),
    };
    if (parts[kwIdx]) item.keywords = parts[kwIdx];
    airports.push(item);
  }

  airports.sort((a, b) => a.code.localeCompare(b.code));
  ctx.log(`Airports: ${airports.length} commercial airports`);
  return airports;
}
