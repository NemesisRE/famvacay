# ADR 0002: Flight Pricing Provider Architecture & API Evaluation

## Status
Accepted

## Context
Accurate flight pricing is critical for family vacation optimization. However, the flight distribution landscape presents significant operational and commercial challenges for self-hosted applications:
1. **Amadeus Self-Service API Decommissioning:** Amadeus officially decommissioned its Self-Service flight shopping and pricing APIs on 17 July 2026. Code relying on `test.api.amadeus.com` is obsolete.
2. **Evaluation of Current Available Self-Serve Flight Pricing APIs:**
   - **Duffel API:** Excellent developer experience and modern REST API. However, Duffel operates primarily as an NDC aggregator/agent requiring IATA/ARC accreditation or merchant agreement, and charges per-booking fees with strict live shopping query rate limits unsuitable for broad speculative grid searches.
   - **Kiwi.com / Tequila API:** Offered search APIs historically, but has heavily restricted access to approved commercial partners, with mandatory affiliate/booking requirements and frequent CORS/IP blocking.
   - **Skyscanner / RapidAPI:** Rate limits on RapidAPI endpoints are restrictive (e.g. 50-100 requests/month free tier), and pricing terms change rapidly.
   - **SerpApi / Google Flights Scraping:** Violates Google terms of service and carries significant cost per query ($0.01 per search), making real-time combinatorial grid evaluations (checking 15 dates × 4 airports = 60 queries) cost-prohibitive for self-hosters.

## Decision
We implement a pluggable, provider-agnostic interface `FlightPriceProvider`:
1. **Interface Contract:**
   ```typescript
   export interface FlightPriceProvider {
     name: string;
     getFlightPrices(params: FlightPriceRequest): Promise<FlightPriceResult>;
   }
   ```
2. **Provider Strategy:**
   - Provide an extensible adapter architecture with support for external flight API providers (e.g. Duffel, Skyscanner, or custom API endpoints configured via `FLIGHT_PROVIDER_URL` and `FLIGHT_PROVIDER_API_KEY`).
   - Ship a resilient, high-performance **Benchmark Estimation Provider** (`BenchmarkFlightProvider`) based on geodesic distance, seasonality curves, fuel index, and passenger age-tier multipliers.
   - Implement a mandatory Redis caching layer with key format `flights:v1:${origin}_${destination}_${departureDate}_${returnDate}_${paxKey}` and a 12-hour TTL.
3. **Honest User Presentation:**
   - The UI strictly distinguishes between live confirmed fares and benchmark estimates.
   - Estimated prices display an explicit badge: *"Estimated benchmark as of [Date]"* with a breakdown of per-tier costs. Estimates are never presented as live confirmed airline fares.

## Consequences
- Zero dependency on obsolete or paid third-party flight APIs out-of-the-box.
- Self-hosters can run FamVacay instantly without creating commercial travel API accounts.
- Commercial or custom providers can be plugged in seamlessly via configuration.

## Update (2026-10-21): Route network data & removal of the BYOK live-pricing hooks
- **Removed:** the bring-your-own-key live pricing path (`AmadeusPricingProvider`,
  `TequilaPricingProvider`, `getConfiguredLivePricingProvider`, `POST /api/pricing/live-enrich` and
  the "Live verified" price badge). Amadeus Self-Service is decommissioned and Tequila is restricted
  to approved partners, so the hooks could never return a live quote.
- **Added:** a real airline route network for flight logistics. `scripts/generate-flight-routes.js`
  (`npm run generate:flight-routes`) builds `src/lib/airports/data/flight-routes.json` from the
  OpenFlights route database (Open Database License). Non-stop vs. connecting flights and the
  connecting airports are resolved over routes that actually exist (fewest stops, then shortest
  total distance); airports without route data fall back to the distance/hub heuristic.
- **Limitation:** OpenFlights route data was last updated in 2014. A fresher (commercial) route
  source can replace it by producing the same `{ "IATA": "IATA IATA ..." }` adjacency file.
- Prices remain benchmark estimates (see Decision) and are presented as such.
