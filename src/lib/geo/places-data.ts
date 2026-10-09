export type PlaceCategory = 'country' | 'region' | 'island' | 'city' | 'airport';

export interface GlobalPlaceEntity {
  id: string;
  name: string;
  category: PlaceCategory;
  countryCode: string;
  countryName: string;
  subdivisionCode?: string;
  lat: number;
  lon: number;
  airportCodes: string[];
  parentRegionId?: string;
  parentRegionName?: string;
  aliases: string[];
  names: {
    en: string;
    de: string;
    fr: string;
    es: string;
    it: string;
  };
}