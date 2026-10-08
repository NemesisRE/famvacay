import { getCached, setCached } from '../cache/redis';
import { POPULAR_DESTINATIONS, getEstimatedClimate } from '../optimizer/weather';
import { WeatherAssessment } from '../optimizer/types';

const TTL_90_DAYS = 90 * 24 * 60 * 60;

/**
 * Open-Meteo Historical / Climate Integration with Redis Caching (90-day TTL)
 */
export async function getHistoricalWeather(
  destinationCode: string,
  targetDate: string
): Promise<WeatherAssessment> {
  const month = new Date(targetDate).getMonth();
  const cacheKey = `weather:openmeteo:${destinationCode}:${month}`;

  const cached = await getCached<WeatherAssessment>(cacheKey);
  if (cached) {
    return cached;
  }

  const dest = POPULAR_DESTINATIONS[destinationCode];
  if (!dest) {
    return getEstimatedClimate(destinationCode, month);
  }

  try {
    // Open-Meteo Climate API endpoint
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${dest.lat}&longitude=${dest.lon}&start_date=2024-${String(month + 1).padStart(2, '0')}-01&end_date=2024-${String(month + 1).padStart(2, '0')}-28&daily=temperature_2m_max,precipitation_sum&timezone=auto`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const temps: number[] = data.daily?.temperature_2m_max || [];
      const precips: number[] = data.daily?.precipitation_sum || [];

      if (temps.length > 0) {
        const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
        const rainyDays = precips.filter((p) => p > 1.0).length;
        const precipRisk = Math.round((rainyDays / precips.length) * 100);

        const isSuitable =
          avgTemp >= dest.idealMinTemp - 4 &&
          avgTemp <= dest.idealMaxTemp + 4 &&
          precipRisk <= dest.maxAcceptablePrecipRisk + 15;

        const assessment: WeatherAssessment = {
          avgTempC: avgTemp,
          precipitationRiskPercent: precipRisk,
          isSuitable,
          reason: isSuitable
            ? 'Historical climate matches family vacation requirements.'
            : `Temperature (${avgTemp}°C) or rain probability (${precipRisk}%) outside ideal bounds.`,
        };

        await setCached(cacheKey, assessment, TTL_90_DAYS);
        return assessment;
      }
    }
  } catch (err) {
    console.warn(`[Open-Meteo] Historical weather fetch failed for ${destinationCode}, using benchmark.`);
  }

  // Graceful fallback to built-in climate benchmark
  const fallback = getEstimatedClimate(destinationCode, month);
  await setCached(cacheKey, fallback, TTL_90_DAYS);
  return fallback;
}

