export interface AdministrativeSubdivision {
  code: string;
  name: string;
  country: string;
}

export interface CountryInfo {
  code: string;
  name: string;
  subdivisions: AdministrativeSubdivision[];
}

export const COUNTRIES: Record<string, CountryInfo> = {
  DE: {
    code: 'DE',
    name: 'Germany (Deutschland)',
    subdivisions: [
      { code: 'DE-BW', name: 'Baden-Württemberg', country: 'DE' },
      { code: 'DE-BY', name: 'Bayern', country: 'DE' },
      { code: 'DE-BE', name: 'Berlin', country: 'DE' },
      { code: 'DE-BB', name: 'Brandenburg', country: 'DE' },
      { code: 'DE-HB', name: 'Bremen', country: 'DE' },
      { code: 'DE-HH', name: 'Hamburg', country: 'DE' },
      { code: 'DE-HE', name: 'Hessen', country: 'DE' },
      { code: 'DE-MV', name: 'Mecklenburg-Vorpommern', country: 'DE' },
      { code: 'DE-NI', name: 'Niedersachsen', country: 'DE' },
      { code: 'DE-NW', name: 'Nordrhein-Westfalen', country: 'DE' },
      { code: 'DE-RP', name: 'Rheinland-Pfalz', country: 'DE' },
      { code: 'DE-SL', name: 'Saarland', country: 'DE' },
      { code: 'DE-SN', name: 'Sachsen', country: 'DE' },
      { code: 'DE-ST', name: 'Sachsen-Anhalt', country: 'DE' },
      { code: 'DE-SH', name: 'Schleswig-Holstein', country: 'DE' },
      { code: 'DE-TH', name: 'Thüringen', country: 'DE' },
    ],
  },
  AT: {
    code: 'AT',
    name: 'Austria (Österreich)',
    subdivisions: [
      { code: 'AT-1', name: 'Burgenland', country: 'AT' },
      { code: 'AT-2', name: 'Kärnten', country: 'AT' },
      { code: 'AT-3', name: 'Niederösterreich', country: 'AT' },
      { code: 'AT-4', name: 'Oberösterreich', country: 'AT' },
      { code: 'AT-5', name: 'Salzburg', country: 'AT' },
      { code: 'AT-6', name: 'Steiermark', country: 'AT' },
      { code: 'AT-7', name: 'Tirol', country: 'AT' },
      { code: 'AT-8', name: 'Vorarlberg', country: 'AT' },
      { code: 'AT-9', name: 'Wien', country: 'AT' },
    ],
  },
  CH: {
    code: 'CH',
    name: 'Switzerland (Schweiz / Suisse)',
    subdivisions: [
      { code: 'CH-ZH', name: 'Zürich', country: 'CH' },
      { code: 'CH-BE', name: 'Bern', country: 'CH' },
      { code: 'CH-BS', name: 'Basel-Stadt', country: 'CH' },
      { code: 'CH-BL', name: 'Basel-Landschaft', country: 'CH' },
      { code: 'CH-GE', name: 'Genève', country: 'CH' },
      { code: 'CH-VD', name: 'Vaud', country: 'CH' },
      { code: 'CH-LU', name: 'Luzern', country: 'CH' },
      { code: 'CH-SG', name: 'St. Gallen', country: 'CH' },
      { code: 'CH-TI', name: 'Ticino', country: 'CH' },
      { code: 'CH-AG', name: 'Aargau', country: 'CH' },
    ],
  },
  FR: {
    code: 'FR',
    name: 'France',
    subdivisions: [
      { code: 'FR-IDF', name: 'Île-de-France (Zone C)', country: 'FR' },
      { code: 'FR-ARA', name: 'Auvergne-Rhône-Alpes (Zone A)', country: 'FR' },
      { code: 'FR-GES', name: 'Grand Est / Alsace (Zone B)', country: 'FR' },
      { code: 'FR-HDF', name: 'Hauts-de-France (Zone B)', country: 'FR' },
      { code: 'FR-PAC', name: 'Provence-Alpes-Côte d’Azur (Zone B)', country: 'FR' },
      { code: 'FR-OCC', name: 'Occitanie (Zone C)', country: 'FR' },
      { code: 'FR-NAQ', name: 'Nouvelle-Aquitaine (Zone A)', country: 'FR' },
      { code: 'FR-BRE', name: 'Bretagne (Zone B)', country: 'FR' },
    ],
  },
  ES: {
    code: 'ES',
    name: 'Spain (España)',
    subdivisions: [
      { code: 'ES-MD', name: 'Comunidad de Madrid', country: 'ES' },
      { code: 'ES-CT', name: 'Cataluña', country: 'ES' },
      { code: 'ES-AN', name: 'Andalucía', country: 'ES' },
      { code: 'ES-VC', name: 'Comunitat Valenciana', country: 'ES' },
      { code: 'ES-PV', name: 'País Vasco', country: 'ES' },
      { code: 'ES-IB', name: 'Illes Balears', country: 'ES' },
      { code: 'ES-CN', name: 'Canarias', country: 'ES' },
      { code: 'ES-GA', name: 'Galicia', country: 'ES' },
    ],
  },
  IT: {
    code: 'IT',
    name: 'Italy (Italia)',
    subdivisions: [
      { code: 'IT-LOM', name: 'Lombardia', country: 'IT' },
      { code: 'IT-LAZ', name: 'Lazio', country: 'IT' },
      { code: 'IT-VEN', name: 'Veneto', country: 'IT' },
      { code: 'IT-EMR', name: 'Emilia-Romagna', country: 'IT' },
      { code: 'IT-PIE', name: 'Piemonte', country: 'IT' },
      { code: 'IT-TOS', name: 'Toscana', country: 'IT' },
      { code: 'IT-CAM', name: 'Campania', country: 'IT' },
      { code: 'IT-SIC', name: 'Sicilia', country: 'IT' },
    ],
  },
};

export function getCountryCodeFromSubdivision(subdivisionCode: string): string {
  if (!subdivisionCode) return 'DE';
  const prefix = subdivisionCode.split('-')[0]?.trim().toUpperCase();
  if (prefix && prefix.length === 2) {
    return prefix;
  }
  return subdivisionCode.slice(0, 2).toUpperCase() || 'DE';
}

