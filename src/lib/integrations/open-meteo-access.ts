/**
 * Which Open-Meteo archive endpoint we may use, given the operation mode and an optional paid
 * plan. Open-Meteo's free endpoint is licensed for non-commercial use only, so a commercial
 * operator must bring a paid-plan API key (served from the customer-* hostnames); without one
 * the archive is not used at all and callers fall back to data that needs no such license.
 *
 * Call accounting follows Open-Meteo's pricing rules: one location counts as one call per
 * 2 weeks of requested data (fractional), so a multi-year daily series costs ~26 calls/year.
 */
export type OpenMeteoTier = 'free' | 'paid';

export interface OpenMeteoAccess {
  tier: OpenMeteoTier;
  archiveUrl: string;
  apiKey?: string;
  /** Calls one generation run may spend per day; free tier allows 10,000/day, keep headroom. */
  dailyCallBudget: number;
  /** Full calendar years of history to average for climatological rain statistics. */
  historyYears: number;
}

export const OPEN_METEO_FREE_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
export const OPEN_METEO_CUSTOMER_ARCHIVE_URL = 'https://customer-archive-api.open-meteo.com/v1/archive';

type AccessEnv = Partial<
  Record<'LEGAL_OPERATION_MODE' | 'OPEN_METEO_API_KEY' | 'OPEN_METEO_ARCHIVE_URL' | 'OPEN_METEO_CUSTOMER_ARCHIVE_URL', string>
>;

export function resolveOpenMeteoAccess(env: AccessEnv = process.env as AccessEnv): OpenMeteoAccess | null {
  const apiKey = env.OPEN_METEO_API_KEY?.trim();
  if (apiKey) {
    return {
      tier: 'paid',
      archiveUrl: env.OPEN_METEO_CUSTOMER_ARCHIVE_URL || OPEN_METEO_CUSTOMER_ARCHIVE_URL,
      apiKey,
      // Paid plans have no daily limit, only a monthly budget (1M calls on Standard): a full
      // 10-year run over ~3,000 locations is ~780k calls, so it can run in one go.
      dailyCallBudget: Number.POSITIVE_INFINITY,
      historyYears: 10,
    };
  }
  if ((env.LEGAL_OPERATION_MODE || 'private') === 'commercial') return null;
  return {
    tier: 'free',
    archiveUrl: env.OPEN_METEO_ARCHIVE_URL || OPEN_METEO_FREE_ARCHIVE_URL,
    dailyCallBudget: 9_000,
    historyYears: 3,
  };
}

/** Fractional call cost of one daily-resolution request for one location (Open-Meteo pricing). */
export function openMeteoCallCost(days: number, variables: number): number {
  return Math.max(1, days / 14) * Math.max(1, variables / 10);
}

export function withOpenMeteoKey(url: string, access: OpenMeteoAccess): string {
  return access.apiKey ? `${url}&apikey=${encodeURIComponent(access.apiKey)}` : url;
}
