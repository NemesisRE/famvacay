import { COUNTRIES } from '@/lib/regions/subdivisions';
import type { GeocodedLocation } from './geocoding';

export type { GeocodedLocation };

/**
 * Country and holiday region of a geocoded place: the ISO subdivision code when the geocoder
 * returns one (Nominatim: DE-HH), otherwise matched by name, otherwise the country's first region.
 */
export function resolveCountryAndRegion(
  loc: Pick<GeocodedLocation, 'countryCode' | 'stateCode' | 'stateName'>
): { country: string; region: string } | null {
  const country = (loc.countryCode || '').toUpperCase();
  if (!country) return null;
  const subdivisions = COUNTRIES[country]?.subdivisions || [];
  if (subdivisions.length === 0) return { country, region: country };

  const code = (loc.stateCode || '').toUpperCase();
  const byCode = code && subdivisions.find((s) => s.code.toUpperCase() === code);
  if (byCode) return { country, region: byCode.code };

  const name = (loc.stateName || '').toLowerCase().trim();
  if (name) {
    const byName = subdivisions.find((s) => {
      const n = s.name.toLowerCase().trim();
      return n === name || name.includes(n) || n.includes(name);
    });
    if (byName) return { country, region: byName.code };
  }
  return { country, region: subdivisions[0].code };
}

/** "76131 Karlsruhe, Baden-Württemberg, Deutschland" in the interface language */
export function formatLocationLabel(loc: GeocodedLocation, locale = 'en'): string {
  const cityName = loc.city || loc.name;
  const parts: string[] = [loc.postcode && !loc.name.includes(loc.postcode) ? `${loc.postcode} ${cityName}` : loc.name || cityName];
  if (loc.stateName && loc.stateName !== cityName) parts.push(loc.stateName);
  if (loc.countryCode) {
    let countryName = loc.countryCode;
    try {
      countryName = new Intl.DisplayNames([locale], { type: 'region' }).of(loc.countryCode) || loc.countryCode;
    } catch {
      // keep the code
    }
    parts.push(countryName);
  }
  return parts.join(', ');
}

export type BrowserLocationError = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

/**
 * The browser's position (asks for permission). Browsers only allow this on secure origins
 * (https / localhost) - over plain http, e.g. the dev server opened from a phone on the LAN, it is
 * 'insecure'.
 */
export function getBrowserCoordinates(timeoutMs = 10000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unsupported');
      return;
    }
    if (!window.isSecureContext) {
      reject('insecure');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'),
      // Town-level accuracy is enough; a cached position up to 10 minutes old is fine
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 }
    );
  });
}

/** Browser position -> town (reverse geocoded in the interface language). Rejects with a BrowserLocationError. */
export async function detectUserLocation(locale = 'en'): Promise<GeocodedLocation> {
  const { lat, lon } = await getBrowserCoordinates();
  const res = await fetch(`/api/locations/reverse?lat=${lat}&lon=${lon}&locale=${encodeURIComponent(locale)}`);
  if (!res.ok) throw 'unavailable' as BrowserLocationError;
  const data = await res.json();
  if (!data?.location) throw 'unavailable' as BrowserLocationError;
  return data.location as GeocodedLocation;
}
