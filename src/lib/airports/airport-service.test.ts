import { describe, it, expect } from 'vitest';
import {
  searchAirports,
  getAirportByIata,
  getRecommendedAirportsForCoordinates,
  calculateGeodesicDistanceKm,
} from './airport-service';

describe('Dynamic Airport Engine & Proximity Service', () => {
  it('retrieves airports accurately by IATA code from worldwide airport-data', () => {
    const fra = getAirportByIata('FRA');
    expect(fra).toBeDefined();
    expect(fra?.code).toBe('FRA');
    expect(fra?.city.toLowerCase()).toContain('frankfurt');
    expect(fra?.country).toBe('Germany');

    const cdg = getAirportByIata('CDG');
    expect(cdg).toBeDefined();
    expect(cdg?.code).toBe('CDG');
    expect(cdg?.city.toLowerCase()).toContain('paris');
    expect(cdg?.country).toBe('France');

    const jfk = getAirportByIata('JFK');
    expect(jfk).toBeDefined();
    expect(jfk?.code).toBe('JFK');
    expect(jfk?.city.toLowerCase()).toContain('new york');
  });

  it('calculates geodesic distances correctly using geolib', () => {
    // Karlsruhe (49.0069, 8.4037) to Frankfurt Airport (50.0379, 8.5622) is ~115-120 km
    const distFra = calculateGeodesicDistanceKm(49.0069, 8.4037, 50.0379, 8.5622);
    expect(distFra).toBeGreaterThan(110);
    expect(distFra).toBeLessThan(125);

    // Karlsruhe to Paris CDG (49.0097, 2.5479) is ~420-435 km geodesic
    const distCdg = calculateGeodesicDistanceKm(49.0069, 8.4037, 49.0097, 2.5479);
    expect(distCdg).toBeGreaterThan(415);
    expect(distCdg).toBeLessThan(440);
  });

  it('searches airports by query including city, name, and IATA', () => {
    const berlinMatches = searchAirports('Berlin');
    expect(berlinMatches.length).toBeGreaterThan(0);
    expect(berlinMatches.some((a) => a.code === 'BER')).toBe(true);

    const munichMatches = searchAirports('MUC');
    expect(munichMatches.length).toBeGreaterThan(0);
    expect(munichMatches[0].code).toBe('MUC');

    const parisMatches = searchAirports('Paris');
    const parisCodes = parisMatches.map((a) => a.code);
    expect(parisCodes).toContain('CDG');
    expect(parisCodes).toContain('ORY');
  });

  it('recommends departure airports dynamically based on coordinates and includes High-Speed Rail connections', () => {
    // Karlsruhe coordinates (49.0069, 8.4037)
    const recommended = getRecommendedAirportsForCoordinates(49.0069, 8.4037, 450);
    const codes = recommended.map((a) => a.code);

    // Local regional hubs
    expect(codes).toContain('FKB'); // Karlsruhe/Baden-Baden
    expect(codes).toContain('STR'); // Stuttgart
    expect(codes).toContain('FRA'); // Frankfurt

    // High-speed rail connectivity to major integrated rail hubs (e.g. CDG)
    expect(codes).toContain('CDG');

    const cdgItem = recommended.find((a) => a.code === 'CDG');
    expect(cdgItem?.isHighSpeedRailConnected).toBe(true);
    expect(cdgItem?.railConnectivityNote?.toLowerCase()).toContain('rail');
  });

  it('recommends departure airports globally (e.g. Sydney, Tokyo, New York) without European bias', () => {
    // Sydney, Australia (-33.8688, 151.2093)
    const sydneyRecs = getRecommendedAirportsForCoordinates(-33.8688, 151.2093, 450);
    const sydneyCodes = sydneyRecs.map((a) => a.code);
    expect(sydneyCodes).toContain('SYD');
    expect(sydneyCodes).not.toContain('FRA');
    expect(sydneyCodes).not.toContain('STR');

    // Tokyo, Japan (35.6762, 139.6503)
    const tokyoRecs = getRecommendedAirportsForCoordinates(35.6762, 139.6503, 350);
    const tokyoCodes = tokyoRecs.map((a) => a.code);
    expect(tokyoCodes).toContain('HND');
    expect(tokyoCodes).toContain('NRT');

    // New York, USA (40.7128, -74.0060)
    const nyRecs = getRecommendedAirportsForCoordinates(40.7128, -74.0060, 200);
    const nyCodes = nyRecs.map((a) => a.code);
    expect(nyCodes).toContain('JFK');
  });

  it('prunes stale airports when coordinates move to another continent and auto-recommends local hubs', async () => {
    const { pruneStaleAirportsForCoordinates } = await import('./airport-service');

    // User previously had European airports selected: FRA, STR, FKB
    const previousAirports = ['FRA', 'STR', 'FKB'];

    // User changes origin to Sydney, Australia (-33.8688, 151.2093)
    const result = pruneStaleAirportsForCoordinates(previousAirports, -33.8688, 151.2093, 450);

    // All European airports must be pruned because they are > 15,000 km away
    expect(result.prunedCodes).toContain('FRA');
    expect(result.prunedCodes).toContain('STR');
    expect(result.prunedCodes).toContain('FKB');
    expect(result.validCodes.length).toBe(0);

    // Auto-populates local Australian hubs since selection became empty
    expect(result.updatedSelection).toContain('SYD');
    expect(result.updatedSelection).not.toContain('FRA');
  });
});

