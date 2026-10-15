import { getCached, setCached } from '../cache/redis';
import { getEstimatedClimate } from '../optimizer/weather';
import { WeatherAssessment } from '../optimizer/types';
import { getAirportByIata } from '../airports/airport-service';

const TTL_90_DAYS = 90 * 24 * 60 * 60;

/**
 * Open-Meteo Historical / Climate Integration with Redis Caching (90-day TTL)
 * Dynamically resolves coordinates for any commercial airport or destination entity.
 */
export async function getHistoricalWeather(
  destinationCode: string,
  targetDate: string
): Promise<WeatherAssessment> {
  const month = new Date(targetDate).getMonth();
  const cacheKey = `weather:openmeteo:${destinationCode.toLowerCase()}:${month}`;

  const cached = await getCached<WeatherAssessment>(cacheKey);
  if (cached) {
    return cached;
  }

  const airport = getAirportByIata(destinationCode.toUpperCase());
  if (!airport) {
    return getEstimatedClimate(destinationCode, month);
  }

  const { lat, lon } = airport;

  try {
    // Open-Meteo Climate API endpoint for historical month
    const archiveUrl = process.env.OPEN_METEO_ARCHIVE_URL || 'https://archive-api.open-meteo.com/v1/archive';
    const sampleYear = 2024;
    const monthStr = String(month + 1).padStart(2, '0');
    const url = `${archiveUrl}?latitude=${lat}&longitude=${lon}&start_date=${sampleYear}-${monthStr}-01&end_date=${sampleYear}-${monthStr}-28&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=auto`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const maxTemps: number[] = data.daily?.temperature_2m_max || [];
      const minTemps: number[] = data.daily?.temperature_2m_min || [];
      const precips: number[] = data.daily?.precipitation_sum || [];
      const sunshines: number[] = data.daily?.sunshine_duration || [];

      if (maxTemps.length > 0) {
        const avgMax = maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length;
        const avgMin = minTemps.length > 0 ? minTemps.reduce((a, b) => a + b, 0) / minTemps.length : avgMax - 8;
        const avgTemp = Math.round((avgMax + avgMin) / 2);
        const rainyDays = precips.filter((p) => p > 1.0).length;
        const precipRisk = Math.round((rainyDays / Math.max(1, precips.length)) * 100);

        const avgSunshineSec = sunshines.length > 0 ? sunshines.reduce((a, b) => a + b, 0) / sunshines.length : 0;
        const sunshineHours = Math.round(avgSunshineSec / 3600) || 7;

        const isSuitable = avgTemp >= 15 && avgTemp <= 35 && precipRisk <= 40;

        const assessment: WeatherAssessment = {
          avgTempC: avgTemp,
          maxTempC: Math.round(avgMax),
          minTempC: Math.round(avgMin),
          rainyDays,
          sunshineHoursPerDay: sunshineHours,
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
  } catch {
    // Graceful fallback to built-in climate benchmark
  }

  const fallback = getEstimatedClimate(destinationCode, month, { lat, lon });
  await setCached(cacheKey, fallback, TTL_90_DAYS);
  return fallback;
}
