import { describe, expect, it } from 'vitest';
import { DATASET_DEFINITIONS } from '../definitions';
import { isDatasetAutoRefreshEnabled } from '../scheduler';

const def = (name: string) => DATASET_DEFINITIONS.find((d) => d.name === name)!;

describe('dataset sanity checks', () => {
  it('runs generators in dependency order: airports first, climate last', () => {
    const order = DATASET_DEFINITIONS.map((d) => d.name);
    expect(order[0]).toBe('airports');
    expect(order[order.length - 1]).toBe('climate-normals');
  });

  it('accepts the bundled seeds themselves', () => {
    for (const d of DATASET_DEFINITIONS) expect(d.validate(d.seed, d.seed), d.name).toBeNull();
  });

  it('rejects a dataset that lost a large share of its entries', () => {
    const airports = def('airports');
    const half = (airports.seed as unknown[]).slice(0, Math.floor((airports.seed as unknown[]).length / 2));
    expect(airports.validate(half, airports.seed)).toMatch(/shrank/);
  });

  it('rejects malformed records', () => {
    const airports = def('airports');
    const broken = [...(airports.seed as any[]), { code: 'x', lat: 'n/a' }];
    expect(airports.validate(broken, airports.seed)).toMatch(/invalid airport record/);

    const climate = def('climate-normals');
    const seed = climate.seed as Record<string, number[]>;
    expect(climate.validate({ ...seed, FRA: [1, 2, 3] }, seed)).toBe('invalid climate rows');
  });
});

describe('DATASET_AUTO_REFRESH', () => {
  it('is on by default in production only, and can be forced either way', () => {
    expect(isDatasetAutoRefreshEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(isDatasetAutoRefreshEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isDatasetAutoRefreshEnabled({ NODE_ENV: 'production', DATASET_AUTO_REFRESH: 'false' })).toBe(false);
    expect(isDatasetAutoRefreshEnabled({ NODE_ENV: 'development', DATASET_AUTO_REFRESH: 'true' })).toBe(true);
  });
});
