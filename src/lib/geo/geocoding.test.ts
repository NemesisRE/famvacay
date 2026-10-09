import { describe, it, expect, vi } from 'vitest';
import { geocodeLocation, resolveLocationCoordinates } from './geocoding';

// Mock Redis to test dynamic geocoder directly
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(true),
}));

describe('Universal Dynamic Geocoding Service', () => {
  it('geocodes cities dynamically via live geocoding engines without static dictionaries', async () => {
    const karlsruhe = await geocodeLocation('Karlsruhe');
    expect(karlsruhe.length).toBeGreaterThan(0);
    expect(karlsruhe[0].name.toLowerCase()).toContain('karlsruhe');
    expect(karlsruhe[0].lat).toBeCloseTo(49.0069, 1);
    expect(karlsruhe[0].lon).toBeCloseTo(8.4037, 1);

    const paris = await geocodeLocation('Paris');
    expect(paris.length).toBeGreaterThan(0);
    expect(paris[0].name.toLowerCase()).toContain('paris');
    expect(paris[0].countryCode).toBe('FR');
  });

  it('geocodes international destinations dynamically worldwide', async () => {
    const sydney = await geocodeLocation('Sydney');
    expect(sydney.length).toBeGreaterThan(0);
    expect(sydney[0].countryCode).toBe('AU');

    const tokyo = await geocodeLocation('Tokyo');
    expect(tokyo.length).toBeGreaterThan(0);
    expect(tokyo[0].lat).toBeCloseTo(35.6762, 1);
  });

  it('resolves location coordinates dynamically with resolvedName', async () => {
    const coords = await resolveLocationCoordinates('Berlin');
    expect(coords).not.toBeNull();
    expect(coords?.lat).toBeCloseTo(52.5200, 1);
    expect(coords?.lon).toBeCloseTo(13.4050, 1);
    expect(coords?.resolvedName?.toLowerCase()).toContain('berlin');
  });
});
