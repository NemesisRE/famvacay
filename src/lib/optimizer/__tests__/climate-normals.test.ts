import { describe, it, expect } from 'vitest';
import { getClimateNormals, getEstimatedClimate } from '../weather';

describe('Measured climate normals (NASA POWER)', () => {
  it('replace the latitude formula that was off by up to 15 °C', () => {
    // Tenerife in April: ~19 °C (the formula said 36 °C)
    expect(getEstimatedClimate('TFS', 3).avgTempC).toBeGreaterThanOrEqual(17);
    expect(getEstimatedClimate('TFS', 3).avgTempC).toBeLessThanOrEqual(22);
    // Antalya: cool and rainy in January, hot and dry in July
    const jan = getEstimatedClimate('AYT', 0);
    const jul = getEstimatedClimate('AYT', 6);
    expect(jan.avgTempC).toBeLessThan(13);
    expect(jan.rainyDays!).toBeGreaterThan(jul.rainyDays!);
    expect(jul.avgTempC).toBeGreaterThanOrEqual(27);
  });

  it('cover airports and overland destinations, with highs above lows', () => {
    expect(getClimateNormals('srf:chamonix', 0)!.avgTempC).toBeLessThanOrEqual(0);
    const rome = getEstimatedClimate('FCO', 6);
    expect(rome.maxTempC!).toBeGreaterThan(rome.minTempC!);
    expect(getClimateNormals('XXX', 0)).toBeNull();
  });
});
