import { getCached, setCached } from '../cache/redis';

const TTL_12_HOURS = 12 * 60 * 60;

export interface FlightPriceResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  totalCost: number;
  perPersonCost: number;
  currency: string;
  isCachedBenchmark: boolean;
}

let amadeusToken: { accessToken: string; expiresAt: number } | null = null;

async function getAmadeusAccessToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (amadeusToken && amadeusToken.expiresAt > Date.now()) {
    return amadeusToken.accessToken;
  }

  try {
    const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      amadeusToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };
      return amadeusToken.accessToken;
    }
  } catch (err) {
    console.warn('[Amadeus] Failed to obtain OAuth token.');
  }

  return null;
}

/**
 * Fetch Flight Offers from Amadeus Self-Service API
 * Cached in Redis with TTL = 12 hours (key: origin_dest_dates_pax)
 * Fallback gracefully to cached historical benchmarks with explicit indicator.
 */
export async function getFlightPrices(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  adultsCount: number,
  childrenAges: number[]
): Promise<FlightPriceResult> {
  const paxKey = `a${adultsCount}_c${childrenAges.length}`;
  const cacheKey = `flights:${origin}_${destination}_${departureDate}_${returnDate}_${paxKey}`;

  const cached = await getCached<FlightPriceResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const token = await getAmadeusAccessToken();
  if (token) {
    try {
      const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&returnDate=${returnDate}&adults=${adultsCount}&max=3&currencyCode=EUR`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const firstOffer = data.data?.[0];
        if (firstOffer?.price?.total) {
          const totalCost = parseFloat(firstOffer.price.total);
          const totalPax = adultsCount + childrenAges.length;
          const result: FlightPriceResult = {
            origin,
            destination,
            departureDate,
            returnDate,
            totalCost,
            perPersonCost: Math.round(totalCost / totalPax),
            currency: 'EUR',
            isCachedBenchmark: false,
          };

          await setCached(cacheKey, result, TTL_12_HOURS);
          return result;
        }
      }
    } catch (err) {
      console.warn(`[Amadeus] Flight search failed or rate-limited for ${origin}->${destination}, using historical benchmark.`);
    }
  }

  // Graceful fallback: Historical benchmark
  const depMonth = new Date(departureDate).getMonth();
  let baseAdult = 145;
  if (depMonth >= 5 && depMonth <= 7) {
    baseAdult = 270;
  } else if (depMonth === 3 || depMonth === 9) {
    baseAdult = 185;
  }

  let totalCost = baseAdult * adultsCount;
  for (const age of childrenAges) {
    if (age < 2) totalCost += baseAdult * 0.10;
    else if (age <= 11) totalCost += baseAdult * 0.75;
    else totalCost += baseAdult;
  }

  totalCost = Math.round(totalCost);
  const totalPax = adultsCount + childrenAges.length;

  const benchmarkResult: FlightPriceResult = {
    origin,
    destination,
    departureDate,
    returnDate,
    totalCost,
    perPersonCost: Math.round(totalCost / totalPax),
    currency: 'EUR',
    isCachedBenchmark: true, // Explicit indicator in UI
  };

  await setCached(cacheKey, benchmarkResult, TTL_12_HOURS);
  return benchmarkResult;
}

