/**
 * Client-safe Destination Vacation Styles Classifier
 * Computes vacation style tags (BEACH, ALPINE, CITY, NATURE, LONGRANGE)
 * using purely geographical, climate, and elevation models without server-only dependencies.
 */

import iso from 'iso-3166-2';
import { DestinationType } from './types';
import { getAirportByIata } from '../airports/airport-service';
import { getEstimatedClimate } from './weather';

export const ISLAND_OR_COASTAL_COUNTRIES = new Set([
  'Bahamas', 'Dominican Republic', 'Jamaica', 'Cuba', 'Maldives', 'Seychelles', 'Mauritius',
  'Fiji', 'Vanuatu', 'French Polynesia', 'Aruba', 'Barbados', 'Cape Verde', 'Malta', 'Cyprus',
  'Turks and Caicos Islands', 'Cayman Islands', 'Saint Lucia', 'Antigua and Barbuda',
  'Trinidad and Tobago', 'Grenada', 'Bermuda', 'Cook Islands', 'Samoa', 'Tonga', 'New Caledonia',
  'Solomon Islands', 'Curaçao', 'Sint Maarten', 'Saint Kitts and Nevis'
]);

export const ISLAND_SUBDIVISIONS = new Set([
  // Spain: Balearics & Canaries
  'ES-IB', 'ES-CN', 'ES-GC', 'ES-TF',
  // Portugal: Azores & Madeira
  'PT-20', 'PT-30',
  // France: Corsica & French overseas island departments
  'FR-20R', 'FR-2A', 'FR-2B', 'FR-GP', 'FR-MQ', 'FR-GF', 'FR-RE', 'FR-YT', 'FR-NC', 'FR-PF',
  // Italy: Sardinia & Sicily
  'IT-88', 'IT-82',
  // Greece: Aegean & Ionian islands, Crete
  'GR-M', 'GR-L', 'GR-K', 'GR-I', 'GR-A', 'GR-69',
  // USA: Hawaii, PR, VI, Guam, American Samoa
  'US-HI', 'US-PR', 'US-VI', 'US-GU', 'US-AS',
]);

export const COASTAL_KEYWORDS = new RegExp(
  '\\b(beach|coast|coastal|costa|playa|plage|strand|riviera|bay|cove|lagoon|shore|marina|seaside|lido|cape|punta|sea|island|islands|isle|isles|isla|islas|insel|inseln|illes|balears|canarias|bahamas|cay|caye|key|keys|atoll|archipelago|cancun|caribbean|yucatan|aegean|adriatic|mallorca|ibiza|menorca|tenerife|fuerteventura|lanzarote|grancanaria|corfu|rhodes|santorini|mykonos|crete|kreta|cyprus|malta|algarve|dalmatia|dalmatien|kotor|antalya|bodrum|dalaman|marmaris|hurghada|sharm|alghero|olbia|cagliari|palermo|catania|nice|cannes|antibes|rimini|split|dubrovnik|zadar|pula|faro)\\b',
  'i'
);

export const ALPINE_KEYWORDS = new RegExp(
  '\\b(alps|alpen|alpes|mountain|mount|mont|monte|peak|summit|dolomites|tirol|rockies|cordillera|sierra|andes|ski|highland|glacier)\\b',
  'i'
);

export const MAJOR_CULTURE_CITIES = new RegExp(
  '\\b(barcelona|rome|paris|vienna|prague|london|madrid|berlin|amsterdam|florence|athens|budapest|new york|chicago|boston|san francisco|tokyo|kyoto|melbourne|singapore|sydney)\\b',
  'i'
);

/**
 * Dynamically resolves all matching vacation styles for any given destination airport.
 * Evaluates elevation, latitude, coastal/marine proximity, climate, and distance.
 */
export function getDestinationVacationStyles(
  airportCode: string,
  distanceKm?: number
): DestinationType[] {
  const ap = getAirportByIata(airportCode);
  if (!ap) return ['ALL'];

  const styles = new Set<DestinationType>(['ALL']);
  const altitudeMeters = (ap.altitude || 0) * 0.3048;
  const lat = ap.lat;
  const lon = ap.lon;

  const winterMonth = lat >= 0 ? 0 : 6;
  const summerMonth = lat >= 0 ? 6 : 0;
  const winterClimate = getEstimatedClimate(ap.code, winterMonth, { lat, lon });
  const summerClimate = getEstimatedClimate(ap.code, summerMonth, { lat, lon });

  const subInfo = ap.state ? iso.subdivision(ap.state) : null;
  const subName = subInfo?.name || '';
  const geoText = `${ap.name} ${ap.city} ${ap.country} ${subName}`;
  const textToSearch = `${geoText} ${ap.keywords || ''}`;

  const hasAlpineGeo =
    (altitudeMeters >= 900 && Math.abs(lat) >= 28) ||
    ALPINE_KEYWORDS.test(textToSearch);
  const isAlpine = hasAlpineGeo && winterClimate.avgTempC <= 6;
  const isSki = altitudeMeters >= 550 && Math.abs(lat) >= 35 && winterClimate.avgTempC <= 3;

  if (isAlpine || isSki || altitudeMeters >= 450) {
    styles.add('ALPINE');
  }

  // Marine basin and coastal geography
  const isRedSea = lat >= 12 && lat <= 29.5 && lon >= 32.5 && lon <= 44 && altitudeMeters < 150;
  const isArabianGulf = lat >= 23.5 && lat <= 27.5 && lon >= 50 && lon <= 57 && altitudeMeters < 150;
  const isRedSeaOrGulf = isRedSea || isArabianGulf;
  const isCaribbeanOrGulf = lat >= 9 && lat <= 31 && lon >= -100 && lon <= -58 && altitudeMeters < 300;
  const isTropicalSeaLevel = Math.abs(lat) <= 25 && altitudeMeters < 120;
  const isIsland =
    ISLAND_OR_COASTAL_COUNTRIES.has(ap.country) ||
    Boolean(ap.state && ISLAND_SUBDIVISIONS.has(ap.state)) ||
    /\b(island|islands|isle|isles|isla|islas|insel|inseln|illes|isola|isole|atoll|archipelago|cay|caye|key|keys)\b/i.test(textToSearch);
  const hasCoastalKeywords = COASTAL_KEYWORDS.test(textToSearch);

  const hasCoastalGeo =
    isIsland ||
    hasCoastalKeywords ||
    isCaribbeanOrGulf ||
    isRedSeaOrGulf ||
    isTropicalSeaLevel;

  const isBeach =
    !isAlpine &&
    hasCoastalGeo &&
    (isIsland ? altitudeMeters <= 180 : altitudeMeters <= 65) &&
    (summerClimate.maxTempC ?? summerClimate.avgTempC) >= 22;

  if (isBeach) {
    styles.add('BEACH');
  }

  const isCity = Boolean(ap.isMajorHub) || MAJOR_CULTURE_CITIES.test(textToSearch);
  if (isCity) {
    styles.add('CITY');
  }

  const isNature = isAlpine || (hasCoastalGeo && altitudeMeters < 300) || Math.abs(lat) >= 55;
  if (isNature) {
    styles.add('NATURE');
  }

  const dist = distanceKm || 0;
  const isLongRange =
    dist >= 3500 ||
    isCaribbeanOrGulf ||
    isTropicalSeaLevel ||
    (dist === 0 && (isCaribbeanOrGulf || isTropicalSeaLevel || Math.abs(lat) <= 22));

  if (isLongRange) {
    styles.add('LONGRANGE');
  }

  return Array.from(styles);
}

