import { describe, it, expect } from 'vitest';
import { formatLocationLabel, resolveCountryAndRegion } from './location-helpers';

describe('Location -> country and holiday region', () => {
  it('uses the ISO subdivision code the geocoder returns (Hamburg is not the first German state)', () => {
    expect(resolveCountryAndRegion({ countryCode: 'de', stateCode: 'DE-HH', stateName: 'Hamburg' })).toEqual({ country: 'DE', region: 'DE-HH' });
  });

  it('falls back to the state name, then to the first region', () => {
    expect(resolveCountryAndRegion({ countryCode: 'DE', stateName: 'Bayern' })).toEqual({ country: 'DE', region: 'DE-BY' });
    expect(resolveCountryAndRegion({ countryCode: 'DE' })?.country).toBe('DE');
    expect(resolveCountryAndRegion({ countryCode: '' })).toBeNull();
  });
});

describe('Location label', () => {
  const loc = { name: 'München', displayName: '', city: 'München', lat: 48.1, lon: 11.6, countryCode: 'DE', stateCode: 'DE-BY', stateName: 'Bayern' };
  it('shows town, region and the country in the interface language', () => {
    expect(formatLocationLabel(loc, 'de')).toBe('München, Bayern, Deutschland');
    expect(formatLocationLabel({ ...loc, postcode: '80331' }, 'fr')).toBe('80331 München, Bayern, Allemagne');
  });
});
