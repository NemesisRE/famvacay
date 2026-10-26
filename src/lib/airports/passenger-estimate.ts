import airportTrafficData from './data/airport-traffic.json';
import routeGraphData from './data/flight-routes.json';
import { derived, getDataset } from '@/lib/datasets/store';

/**
 * Annual passengers for airports Wikidata has no figure for (Malé, many holiday islands),
 * predicted from how many non-stop routes they serve: across the airports with both figures,
 * log(passengers) is close to linear in log(routes) (r ~ 0.84). The fit is recomputed from the
 * current datasets, so it follows every refresh instead of baking in constants.
 */

export interface RouteTrafficModel {
  intercept: number;
  slope: number;
}

export function routeCount(routes: Record<string, string>, code: string): number {
  const list = routes[code];
  return list ? list.split(' ').filter(Boolean).length : 0;
}

/** Least-squares fit of log(passengers) on log(routes); null without enough data */
export function fitRouteTrafficModel(traffic: Record<string, number>, routes: Record<string, string>): RouteTrafficModel | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [code, pax] of Object.entries(traffic)) {
    const n = routeCount(routes, code);
    if (n > 0 && pax > 0) {
      xs.push(Math.log(n));
      ys.push(Math.log(pax));
    }
  }
  if (xs.length < 30) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/** Measured passengers (millions), else the route-based estimate; undefined without routes */
export function estimatePassengersMillions(
  code: string,
  traffic: Record<string, number>,
  routes: Record<string, string>,
  model: RouteTrafficModel | null
): number | undefined {
  const measured = traffic[code];
  if (measured !== undefined) return measured;
  const n = routeCount(routes, code);
  if (!model || n === 0) return undefined;
  return Math.exp(model.intercept + model.slope * Math.log(n));
}

const currentTraffic = () => getDataset('airport-traffic', airportTrafficData as Record<string, number>);
const currentRoutes = () => getDataset('flight-routes', routeGraphData as Record<string, string>);
const currentModel = derived(() => fitRouteTrafficModel(currentTraffic(), currentRoutes()));

/** Annual passengers in millions: Wikidata's figure, or the route-based estimate */
export function getEstimatedPassengersMillions(code: string): number | undefined {
  return estimatePassengersMillions((code || '').toUpperCase(), currentTraffic(), currentRoutes(), currentModel());
}
