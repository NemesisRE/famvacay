# ADR 0003: Pluggable Geocoding Provider & Autocomplete Policy Compliance

## Status
Accepted

## Context
Location autocompletion and reverse geocoding are core features of FamVacay. Users type postal codes, towns, islands, regions, and countries into typeahead search inputs.

OpenStreetMap offers two primary geocoding technologies:
1. **Nominatim Public API (`nominatim.openstreetmap.org`):**
   - Strictly forbids dynamic typeahead/autocomplete in its Acceptable Use Policy (AUP). The public server limits requests to 1 request per second and will block user agents submitting rapid keypress queries.
   - Ideal only for single, one-off server-side coordinate resolutions.
2. **Photon (`photon.komoot.io`):**
   - Built specifically on Elasticsearch and OSM data by Komoot for search-as-you-type autocomplete.
   - Fully permits debounced autocomplete and can be self-hosted via Docker for offline, high-throughput privacy-preserving setups.

## Decision
1. **Primary Autocomplete Provider:** We configure **Photon** as the default pluggable `GeocodingProvider` for all autocomplete typeahead endpoints.
2. **Self-Hosting Compatibility:** Configurable via `PHOTON_API_URL` (defaulting to `https://photon.komoot.io/api`), allowing self-hosters to point to a local containerized Photon instance.
3. **Server-Side Proxy Architecture:**
   - All client geocoding requests pass through the server-side proxy route `/api/locations/geocode` or `/api/destinations/search`.
   - Never expose external geocoding endpoints or API keys to the browser client.
   - Results are cached in Redis with a 7-day TTL (`geo:v1:*`).
4. **Entity Categorization:**
   - Provider classification tags (`osm_value`, `type`, `osm_key`) are dynamically mapped to canonical entity categories: `CITY`, `ISLAND`, `REGION`, `COUNTRY`, `OTHER`.
   - Client displays human-readable names (`"City, Region, Country"`), never raw coordinates or bare postal codes.

## Implementation status (2026-10-30)
Implemented: `src/lib/geo/photon.ts` is the only forward geocoder (`geocoding.ts` for the departure location, `places.ts` for destinations), reading `PHOTON_API_URL`. Nominatim remains for reverse geocoding on an explicit "My location" click.
- Photon has no ISO 3166-2 codes, so the holiday region is matched from the subdivision name against the ISO data's local names. When the localized name does not match ("Bavaria"), the same search runs once more with local names (`lang=default`) and the result is matched by OSM id.
- The public server has names in English, German and French only; Spanish and Italian interfaces get local names.
- A bare postcode is ambiguous worldwide, so searches are biased towards the home country chosen in the form (`lat`/`lon` at `zoom=5`).

## Consequences
- Complies 100% with OpenStreetMap Foundation usage policies.
- Enables lightning-fast, debounced autocomplete with zero IP blocking risk.
- Zero vendor lock-in; self-hosters can achieve complete data sovereignty by running a local Photon instance.

