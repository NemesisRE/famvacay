import { describe, it, expect } from 'vitest';
import { getLocalizedDestinationLabel } from './destination-points';
import { getAirportByIata } from '../airports/airport-service';

describe('Localized destination labels', () => {
  it('translates airport city exonyms and country names per UI language', () => {
    expect(getLocalizedDestinationLabel('NCE', 'de').label).toBe('Nizza, Frankreich');
    expect(getLocalizedDestinationLabel('NCE', 'es').label).toBe('Niza, Francia');
    expect(getLocalizedDestinationLabel('CFU', 'it').city).toBe('Corfù');
    expect(getLocalizedDestinationLabel('NUE', 'en').city).toBe('Nuremberg');
    expect(getLocalizedDestinationLabel('JTR', 'de').city).toBe('Santorin');
  });

  it('translates surface destinations, including their country', () => {
    expect(getLocalizedDestinationLabel('srf:lake-garda', 'de').label).toBe('Gardasee (Sirmione), Italien');
    expect(getLocalizedDestinationLabel('srf:alcudia', 'fr').label).toBe('Alcúdia (Majorque), Espagne');
    expect(getLocalizedDestinationLabel('srf:jesolo', 'it').label).toBe('Jesolo, Italia');
  });

  it('never exposes internal surface codes as display names', () => {
    expect(getLocalizedDestinationLabel('srf:lloret-de-mar', 'en').label).not.toContain('srf');
  });

  it('uses the holiday name people book instead of the capital or airport town', () => {
    expect(getLocalizedDestinationLabel('MRU', 'en').label).toBe('Mauritius');
    expect(getLocalizedDestinationLabel('RUN', 'de').label).toBe('Réunion');
    expect(getLocalizedDestinationLabel('MLE', 'de').label).toBe('Malediven');
    expect(getLocalizedDestinationLabel('ZNZ', 'de').label).toBe('Sansibar, Tansania');
    expect(getLocalizedDestinationLabel('HNL', 'en').label).toBe('Hawaii (Honolulu), United States');
    expect(getLocalizedDestinationLabel('PMI', 'fr').city).toBe('Majorque');
    expect(getLocalizedDestinationLabel('GND', 'en').label).toBe('Grenada');
    expect(getLocalizedDestinationLabel('AOK', 'en').city).toBe('Karpathos');
  });

  it('keeps raw dataset names for search/matching (display-only translation)', () => {
    expect(getAirportByIata('MXP')?.city).toBe('Milano');
    expect(getLocalizedDestinationLabel('MXP', 'de').city).toBe('Mailand');
  });
});
