import { describe, it, expect } from 'vitest';
import { estimatePassengersMillions, fitRouteTrafficModel, getEstimatedPassengersMillions } from './passenger-estimate';

describe('Route-based passenger estimate', () => {
  it('fits passengers from route counts and prefers measured figures', () => {
    const traffic: Record<string, number> = {};
    const routes: Record<string, string> = {};
    for (let i = 1; i <= 40; i++) {
      const code = `A${String(i).padStart(2, '0')}`;
      routes[code] = Array.from({ length: i }, (_, j) => `X${j}`).join(' ');
      traffic[code] = 0.1 * i;
    }
    const model = fitRouteTrafficModel(traffic, routes);
    expect(model?.slope).toBeCloseTo(1, 5);
    routes.NEW = Array.from({ length: 20 }, (_, j) => `X${j}`).join(' ');
    expect(estimatePassengersMillions('NEW', traffic, routes, model)).toBeCloseTo(2, 5);
    expect(estimatePassengersMillions('A10', traffic, routes, model)).toBe(1);
    expect(estimatePassengersMillions('NONE', traffic, routes, model)).toBeUndefined();
  });

  it('ranks a busy gateway without a Wikidata figure above an island airstrip', () => {
    expect(getEstimatedPassengersMillions('MLE')!).toBeGreaterThan(1);
    expect(getEstimatedPassengersMillions('HAQ') ?? 0).toBeLessThan(0.5);
  });
});
