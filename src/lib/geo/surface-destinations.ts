import type { DestinationType } from '../optimizer/types';

/**
 * Overland-access class of a destination (mirrors OverlandAccessClass in optimizer/vehicles,
 * redeclared here so this pure data module has no optimizer imports).
 */
export type SurfaceAccessClass = 'MAINLAND_OR_BRIDGE' | 'SHORT_FERRY' | 'LONG_FERRY';

/**
 * A road/rail destination node that is NOT derived from an airport. Overland discovery used to
 * index only airport coordinates, so road-trip results were limited to the handful of coastal
 * towns that happen to have a commercial airport (Nice, Rimini, Olbia, Split, Elba...), and
 * whole coastlines without one (Costa Brava, Algarve, Istria, Côte d'Argent, the Baltic) could
 * never be recommended. These nodes give car/train/bus searches organic coverage.
 */
export interface SurfaceDestination {
  code: string;              // Stable id, always prefixed "srf:" so it can never collide with an IATA code
  city: string;              // Display name of the resort / town
  region: string;            // Human-readable coast / area ("Costa Brava")
  country: string;           // English country name (same convention as airport records)
  state: string;             // ISO 3166-2 subdivision code
  lat: number;
  lon: number;
  altitudeMeters: number;
  styles: DestinationType[]; // Vacation styles this node is a genuine match for
  access: SurfaceAccessClass;
  ferryTransitMinutes?: number; // Roundtrip crossing incl. check-in buffer (ferry nodes only)
  ferrySurchargeEur?: number;   // Roundtrip vehicle + family fare (ferry nodes only)
  isHighSpeedRailConnected?: boolean;
  keywords?: string;
  /** Display name per UI language where it differs from `city` (exonyms, translated lake names). */
  localizedCity?: Partial<Record<'en' | 'de' | 'fr' | 'es' | 'it', string>>;
}

export const SURFACE_CODE_PREFIX = 'srf:';

const BEACH: DestinationType[] = ['BEACH', 'NATURE'];
const LAKE: DestinationType[] = ['NATURE'];
const MOUNTAIN: DestinationType[] = ['ALPINE', 'NATURE'];

function node(
  slug: string,
  city: string,
  region: string,
  country: string,
  state: string,
  lat: number,
  lon: number,
  styles: DestinationType[],
  extra: Partial<SurfaceDestination> = {}
): SurfaceDestination {
  return {
    code: `${SURFACE_CODE_PREFIX}${slug}`,
    city,
    region,
    country,
    state,
    lat,
    lon,
    altitudeMeters: 5,
    styles,
    access: 'MAINLAND_OR_BRIDGE',
    keywords: styles.includes('BEACH') ? 'beach coast seaside' : undefined,
    ...extra,
  };
}

const longFerry = (minutes: number, eur: number): Partial<SurfaceDestination> => ({
  access: 'LONG_FERRY',
  ferryTransitMinutes: minutes,
  ferrySurchargeEur: eur,
});
const shortFerry = (minutes: number, eur: number): Partial<SurfaceDestination> => ({
  access: 'SHORT_FERRY',
  ferryTransitMinutes: minutes,
  ferrySurchargeEur: eur,
});

export const SURFACE_DESTINATIONS: SurfaceDestination[] = [
  // --- Spain ---
  node('lloret-de-mar', 'Lloret de Mar', 'Costa Brava', 'Spain', 'ES-CT', 41.7, 2.845, BEACH),
  node('salou', 'Salou', 'Costa Daurada', 'Spain', 'ES-CT', 41.076, 1.141, BEACH),
  node('peniscola', 'Peñíscola', 'Costa del Azahar', 'Spain', 'ES-VC', 40.359, 0.405, BEACH),
  node('denia', 'Dénia', 'Costa Blanca', 'Spain', 'ES-VC', 38.84, 0.106, BEACH),
  node('san-sebastian', 'San Sebastián', 'Basque Coast', 'Spain', 'ES-PV', 43.318, -1.981, ['BEACH', 'CITY'], { isHighSpeedRailConnected: true, localizedCity: {fr: 'Saint-Sébastien'} }),
  node('noja', 'Noja', 'Costa de Cantabria', 'Spain', 'ES-CB', 43.489, -3.524, BEACH),
  node('sanxenxo', 'Sanxenxo', 'Rías Baixas', 'Spain', 'ES-GA', 42.4, -8.807, BEACH),
  node('alcudia', 'Alcúdia', 'Mallorca', 'Spain', 'ES-IB', 39.853, 3.121, BEACH, { ...longFerry(16 * 60, 520), localizedCity: {en: 'Alcúdia (Mallorca)', de: 'Alcúdia (Mallorca)', fr: 'Alcúdia (Majorque)', es: 'Alcúdia (Mallorca)', it: 'Alcúdia (Maiorca)'} }),

  // --- Portugal ---
  node('espinho', 'Espinho', 'Costa Verde', 'Portugal', 'PT-13', 41.007, -8.641, BEACH),
  node('nazare', 'Nazaré', 'Costa de Prata', 'Portugal', 'PT-10', 39.602, -9.071, BEACH),
  node('albufeira', 'Albufeira', 'Algarve', 'Portugal', 'PT-08', 37.089, -8.25, BEACH),
  node('lagos', 'Lagos', 'Algarve', 'Portugal', 'PT-08', 37.102, -8.673, BEACH),

  // --- France ---
  node('argeles-sur-mer', 'Argelès-sur-Mer', 'Côte Vermeille', 'France', 'FR-OCC', 42.546, 3.023, BEACH),
  node('la-grande-motte', 'La Grande-Motte', 'Languedoc Coast', 'France', 'FR-OCC', 43.561, 4.085, BEACH),
  node('frejus', 'Fréjus', 'Côte d’Azur', 'France', 'FR-PAC', 43.433, 6.737, BEACH),
  node('arcachon', 'Arcachon', 'Côte d’Argent', 'France', 'FR-NAQ', 44.658, -1.168, BEACH),
  node('biarritz', 'Biarritz', 'Basque Coast', 'France', 'FR-NAQ', 43.483, -1.559, BEACH),
  node('ile-de-re', 'Île de Ré', 'Atlantic Coast', 'France', 'FR-NAQ', 46.201, -1.403, BEACH, { localizedCity: {en: 'Île de Ré', es: 'Isla de Ré', it: 'Isola di Ré'} }),
  node('la-baule', 'La Baule', 'Côte d’Amour', 'France', 'FR-PDL', 47.286, -2.393, BEACH),
  node('saint-malo', 'Saint-Malo', 'Brittany', 'France', 'FR-BRE', 48.649, -2.026, BEACH),
  node('porto-vecchio', 'Porto-Vecchio', 'Corsica', 'France', 'FR-COR', 41.591, 9.279, BEACH, { ...longFerry(12 * 60, 450), localizedCity: {en: 'Porto-Vecchio (Corsica)', de: 'Porto-Vecchio (Korsika)', fr: 'Porto-Vecchio (Corse)', es: 'Porto-Vecchio (Córcega)', it: 'Porto-Vecchio (Corsica)'} }),
  node('chamonix', 'Chamonix', 'Mont Blanc', 'France', 'FR-ARA', 45.924, 6.869, MOUNTAIN, { altitudeMeters: 1035 }),

  // --- Italy ---
  node('jesolo', 'Jesolo', 'Venetian Riviera', 'Italy', 'IT-34', 45.507, 12.645, BEACH),
  node('lignano', 'Lignano Sabbiadoro', 'Friulian Riviera', 'Italy', 'IT-36', 45.676, 13.137, BEACH),
  node('alassio', 'Alassio', 'Riviera di Ponente', 'Italy', 'IT-42', 44.004, 8.172, BEACH),
  node('levanto', 'Levanto', 'Cinque Terre', 'Italy', 'IT-42', 44.17, 9.611, BEACH),
  node('viareggio', 'Viareggio', 'Versilia', 'Italy', 'IT-52', 43.866, 10.25, BEACH),
  node('castiglione-della-pescaia', 'Castiglione della Pescaia', 'Maremma', 'Italy', 'IT-52', 42.763, 10.881, BEACH),
  node('sorrento', 'Sorrento', 'Amalfi Coast', 'Italy', 'IT-72', 40.626, 14.376, BEACH),
  node('vieste', 'Vieste', 'Gargano', 'Italy', 'IT-75', 41.882, 16.176, BEACH),
  node('villasimius', 'Villasimius', 'Sardinia', 'Italy', 'IT-88', 39.141, 9.519, BEACH, { ...longFerry(14 * 60, 480), localizedCity: {en: 'Villasimius (Sardinia)', de: 'Villasimius (Sardinien)', fr: 'Villasimius (Sardaigne)', es: 'Villasimius (Cerdeña)', it: 'Villasimius (Sardegna)'} }),
  node('cefalu', 'Cefalù', 'Sicily', 'Italy', 'IT-82', 38.038, 14.022, BEACH, { ...shortFerry(90, 120), localizedCity: {en: 'Cefalù (Sicily)', de: 'Cefalù (Sizilien)', fr: 'Cefalù (Sicile)', es: 'Cefalù (Sicilia)', it: 'Cefalù (Sicilia)'} }),
  node('lake-garda', 'Lake Garda (Sirmione)', 'Lake Garda', 'Italy', 'IT-25', 45.493, 10.608, LAKE, { altitudeMeters: 68, localizedCity: {de: 'Gardasee (Sirmione)', fr: 'Lac de Garde (Sirmione)', es: 'Lago de Garda (Sirmione)', it: 'Lago di Garda (Sirmione)'} }),
  node('val-gardena', 'Val Gardena (Ortisei)', 'Dolomites', 'Italy', 'IT-32', 46.574, 11.672, MOUNTAIN, { altitudeMeters: 1236, localizedCity: {de: 'Grödnertal (St. Ulrich)'} }),

  // --- Adriatic & Balkans ---
  node('piran', 'Piran', 'Slovenian Istria', 'Slovenia', 'SI-090', 45.528, 13.568, BEACH, { localizedCity: {it: 'Pirano (Piran)'} }),
  node('porec', 'Poreč', 'Istria', 'Croatia', 'HR-18', 45.227, 13.595, BEACH, { localizedCity: {it: 'Parenzo (Poreč)'} }),
  node('rovinj', 'Rovinj', 'Istria', 'Croatia', 'HR-18', 45.081, 13.639, BEACH, { localizedCity: {it: 'Rovigno (Rovinj)'} }),
  node('krk', 'Krk', 'Kvarner', 'Croatia', 'HR-08', 45.027, 14.575, BEACH, { localizedCity: {it: 'Veglia (Krk)'} }),
  node('makarska', 'Makarska', 'Makarska Riviera', 'Croatia', 'HR-17', 43.297, 17.018, BEACH),
  node('hvar', 'Hvar', 'Dalmatian Islands', 'Croatia', 'HR-17', 43.172, 16.443, BEACH, { ...shortFerry(150, 160), localizedCity: {it: 'Lesina (Hvar)'} }),
  node('budva', 'Budva', 'Montenegrin Riviera', 'Montenegro', 'ME-05', 42.288, 18.84, BEACH),
  node('sarande', 'Sarandë', 'Albanian Riviera', 'Albania', 'AL-12', 39.875, 20.005, BEACH),
  node('halkidiki', 'Kassandra', 'Halkidiki', 'Greece', 'GR-B', 40.05, 23.42, BEACH, { localizedCity: {en: 'Kassandra (Halkidiki)', de: 'Kassandra (Chalkidiki)', fr: 'Kassandra (Chalcidique)', es: 'Kassandra (Calcídica)', it: 'Kassandra (Calcidica)'} }),
  node('parga', 'Parga', 'Epirus Coast', 'Greece', 'GR-D', 39.285, 20.4, BEACH),

  // --- North Sea & Baltic ---
  node('zandvoort', 'Zandvoort', 'North Holland Coast', 'Netherlands', 'NL-NH', 52.374, 4.533, BEACH),
  node('texel', 'Texel', 'Wadden Islands', 'Netherlands', 'NL-NH', 53.055, 4.797, BEACH, shortFerry(60, 70)),
  node('renesse', 'Renesse', 'Zeeland', 'Netherlands', 'NL-ZE', 51.733, 3.775, BEACH),
  node('de-haan', 'De Haan', 'Belgian Coast', 'Belgium', 'BE-VWV', 51.273, 3.034, BEACH),
  node('st-peter-ording', 'St. Peter-Ording', 'North Frisia', 'Germany', 'DE-SH', 54.303, 8.633, BEACH),
  node('norderney', 'Norderney', 'East Frisian Islands', 'Germany', 'DE-NI', 53.707, 7.15, BEACH, shortFerry(100, 110)),
  node('timmendorfer-strand', 'Timmendorfer Strand', 'Bay of Lübeck', 'Germany', 'DE-SH', 53.995, 10.778, BEACH),
  node('binz', 'Binz', 'Rügen', 'Germany', 'DE-MV', 54.401, 13.61, BEACH),
  node('heringsdorf', 'Heringsdorf', 'Usedom', 'Germany', 'DE-MV', 53.946, 14.119, BEACH),
  node('henne-strand', 'Henne Strand', 'West Jutland', 'Denmark', 'DK-83', 55.735, 8.18, BEACH),
  node('miedzyzdroje', 'Międzyzdroje', 'Wolin Coast', 'Poland', 'PL-ZP', 53.928, 14.448, BEACH, { localizedCity: {de: 'Misdroy (Międzyzdroje)'} }),
  node('sopot', 'Sopot', 'Gdańsk Bay', 'Poland', 'PL-PM', 54.441, 18.56, BEACH),

  // --- Lakes & mountains within driving range of Central Europe ---
  node('titisee', 'Titisee', 'Black Forest', 'Germany', 'DE-BW', 47.899, 8.152, LAKE, { altitudeMeters: 850, localizedCity: {en: 'Titisee (Black Forest)', de: 'Titisee (Schwarzwald)', fr: 'Titisee (Forêt-Noire)', es: 'Titisee (Selva Negra)', it: 'Titisee (Foresta Nera)'} }),
  node('lindau', 'Lindau', 'Lake Constance', 'Germany', 'DE-BY', 47.546, 9.684, LAKE, { altitudeMeters: 400, localizedCity: {en: 'Lindau (Lake Constance)', de: 'Lindau (Bodensee)', fr: 'Lindau (lac de Constance)', es: 'Lindau (lago de Constanza)', it: 'Lindau (lago di Costanza)'} }),
  node('garmisch', 'Garmisch-Partenkirchen', 'Bavarian Alps', 'Germany', 'DE-BY', 47.492, 11.095, MOUNTAIN, { altitudeMeters: 708 }),
  node('velden', 'Velden am Wörthersee', 'Carinthian Lakes', 'Austria', 'AT-2', 46.613, 14.04, LAKE, { altitudeMeters: 440 }),
  node('zell-am-see', 'Zell am See', 'Salzburger Land', 'Austria', 'AT-5', 47.323, 12.796, MOUNTAIN, { altitudeMeters: 757 }),
  node('interlaken', 'Interlaken', 'Bernese Oberland', 'Switzerland', 'CH-BE', 46.686, 7.863, MOUNTAIN, { altitudeMeters: 568, isHighSpeedRailConnected: true }),
];

const surfaceByCode = new Map<string, SurfaceDestination>(
  SURFACE_DESTINATIONS.map((d) => [d.code, d])
);

export function isSurfaceDestinationCode(code: string | undefined | null): boolean {
  return Boolean(code && code.startsWith(SURFACE_CODE_PREFIX));
}

export function getSurfaceDestination(code: string | undefined | null): SurfaceDestination | undefined {
  if (!code || !code.startsWith(SURFACE_CODE_PREFIX)) return undefined;
  return surfaceByCode.get(code);
}
