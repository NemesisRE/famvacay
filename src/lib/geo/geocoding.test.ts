import { describe, it, expect } from 'vitest';
import { geocodeLocation } from './geocoding';

describe('Geocoding Service & Offline Index Fallback', () => {
  it('geocodes European cities via fallback index when offline or uncached', async () => {
    const karlsruhe = await geocodeLocation('Karlsruhe');
    expect(karlsruhe.length).toBeGreaterThan(0);
    expect(karlsruhe[0].name.toLowerCase()).toContain('karlsruhe');
    expect(karlsruhe[0].lat).toBeCloseTo(49.0069, 1);
    expect(karlsruhe[0].lon).toBeCloseTo(8.4037, 1);

    const stuttgart = await geocodeLocation('Stuttgart');
    expect(stuttgart.length).toBeGreaterThan(0);
    expect(stuttgart[0].name.toLowerCase()).toContain('stuttgart');
    expect(stuttgart[0].lat).toBeCloseTo(48.7758, 1);
    expect(stuttgart[0].lon).toBeCloseTo(9.1829, 1);

    const paris = await geocodeLocation('Paris');
    expect(paris.length).toBeGreaterThan(0);
    expect(paris[0].name.toLowerCase()).toContain('paris');
    expect(paris[0].countryCode).toBe('FR');
  });

  it('handles partial searches gracefully', async () => {
    const munich = await geocodeLocation('München');
    expect(munich.length).toBeGreaterThan(0);
    expect(['Munich', 'München']).toContain(munich[0].name);
  });
});
