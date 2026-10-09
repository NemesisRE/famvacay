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

    // High-speed rail connectivity to Paris (direct 2.5h TGV from Karlsruhe Hbf)
    expect(codes).toContain('CDG');
    expect(codes).toContain('ORY');

    const cdgItem = recommended.find((a) => a.code === 'CDG');
    expect(cdgItem?.isHighSpeedRailConnected).toBe(true);
    expect(cdgItem?.railConnectivityNote).toContain('TGV');
  });
});

