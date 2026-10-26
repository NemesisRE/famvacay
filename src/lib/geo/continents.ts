/**
 * Continent per country (ISO 3166-1 alpha-2), from the UN M49 standard's regions, for grouping
 * destinations in the results filter. One deviation, following how holiday portals group them:
 * Turkey and Cyprus count as Europe (M49: Western Asia), so "Asia" means the long-haul trip a
 * family expects, not the Turkish Riviera.
 */
export type Continent = 'EUROPE' | 'ASIA' | 'AFRICA' | 'AMERICAS' | 'OCEANIA';

export const CONTINENT_ORDER: Continent[] = ['EUROPE', 'AFRICA', 'ASIA', 'AMERICAS', 'OCEANIA'];

const COUNTRIES_BY_CONTINENT: Record<Continent, string> = {
  EUROPE:
    'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL ' +
    'NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK',
  ASIA:
    'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA ' +
    'SG SY TH TJ TL TM TW UZ VN YE',
  AFRICA:
    'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW IO KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG ' +
    'RE RW SC SD SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW',
  AMERICAS:
    'AG AI AR AW BB BL BM BO BQ BR BS BV BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GS GT GY HN HT JM KN KY LC MF MQ MS ' +
    'MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI',
  OCEANIA: 'AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS',
};

const CONTINENT_BY_COUNTRY = new Map<string, Continent>(
  (Object.entries(COUNTRIES_BY_CONTINENT) as [Continent, string][]).flatMap(([continent, codes]) =>
    codes.split(' ').map((code) => [code, continent] as [string, Continent])
  )
);

export function getCountriesOfContinent(continent: Continent): string[] {
  return COUNTRIES_BY_CONTINENT[continent].split(' ');
}

export function getContinentForCountry(countryCode: string | undefined): Continent | undefined {
  return countryCode ? CONTINENT_BY_COUNTRY.get(countryCode.toUpperCase()) : undefined;
}
