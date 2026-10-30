import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory stand-in for Valkey; only the optimizer's cache keys matter here
const store = new Map<string, unknown>();
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(async (key: string) => store.get(key) ?? null),
  setCached: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
}));
vi.mock('@/lib/security/rate-limit', () => ({
  RATE_LIMITS: { optimize: {} },
  rateLimitByClient: vi.fn(async () => null),
}));
// A cache miss runs the optimization: keep it offline and instant
vi.mock('@/lib/integrations/open-holidays', () => ({
  getSchoolHolidays: vi.fn(async () => []),
  getPublicHolidays: vi.fn(async () => []),
}));
vi.mock('@/lib/safety/safety-service', () => ({ ensureTravelAdvisoriesLoaded: vi.fn(async () => {}) }));
vi.mock('@/lib/holidays/source-market-loader', () => ({ loadSourceMarketCalendars: vi.fn(async () => []) }));
vi.mock('@/lib/optimizer/engine', () => ({ optimizeVacationWindows: vi.fn(() => []) }));

const { POST } = await import('@/app/api/vacations/optimize/route');
const { getCached } = await import('@/lib/cache/redis');

/** Optimizer cache keys the route looked up, in order */
const optimizerLookups = () =>
  vi.mocked(getCached).mock.calls.map((c) => c[0] as string).filter((k) => k.startsWith('famvac:opt:'));

const query = {
  durationDays: 7,
  durationDaysMin: 7,
  durationDaysMax: 7,
  earliestDate: '2027-07-01',
  latestDate: '2027-08-31',
  userProfile: { homeLocation: 'Karlsruhe', federalState: 'DE-BW', originAirports: ['FKB'], adults: 2, childrenAges: [] },
};
const request = (body: object) =>
  new NextRequest('http://localhost:3000/api/vacations/optimize', { method: 'POST', body: JSON.stringify(body) });

/** Seeds the cache entry the route would write for this body */
async function seed(body: object, payload: object) {
  vi.mocked(getCached).mockClear();
  await POST(request(body));
  store.clear();
  store.set(optimizerLookups().at(-1)!, payload);
}

describe('Vacations Optimize API - progressive search cache', () => {
  beforeEach(() => store.clear());

  it('answers a first-tier search with the cached full result, marked as extended', async () => {
    const full = { success: true, count: 1, windows: [{ destinationAirport: 'PMI' }] };
    await seed({ ...query, discoveryScope: 'extended' }, full);

    const res = await POST(request(query));
    expect(res.headers.get('X-Famvac-Scope')).toBe('extended');
    expect(res.headers.get('X-Famvac-Cache')).toBe('HIT');
    expect(await res.json()).toEqual(full);
  });

  it('serves the first-tier entry unmarked when only that one is cached', async () => {
    const primary = { success: true, count: 1, windows: [{ destinationAirport: 'BCN' }] };
    vi.mocked(getCached).mockClear();
    await POST(request(query));
    // The extended key is checked first, then the first-tier one
    const keys = optimizerLookups();
    expect(keys).toHaveLength(2);
    store.clear();
    store.set(keys[1], primary);

    const res = await POST(request(query));
    expect(res.headers.get('X-Famvac-Scope')).toBeNull();
    expect(await res.json()).toEqual(primary);
  });

  it('does not look for an extended result when destinations were picked', async () => {
    vi.mocked(getCached).mockClear();
    await POST(request({ ...query, targetDestinations: ['Mallorca'] }));
    expect(optimizerLookups()).toHaveLength(1);
  });
});
