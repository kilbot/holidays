/**
 * Which days already hold a fare, answered without spending a fare call.
 *
 * This is the other half of date freedom (#61). Once every day in the window is
 * clickable, "click one and find out" is a quota bill the couple never agreed
 * to — so the page has to be able to say, before anything is clicked, which
 * days are free to look at and which will cost live calls.
 *
 * Three sources, in descending order of how much they actually know:
 *
 * 1. **History.** The route's coverage index (`lib/flights/history.ts`) names
 *    every day that route has ever been quoted on, with the newest price. Those
 *    days are free and instant, and they can show a real number.
 * 2. **Warmed.** The three days per route the cron pays for. Warm is a claim
 *    about the *cache*, not about the data: with no `SEARCHAPI_KEY` in the
 *    environment nothing has ever been warmed, so a warmed day says "this one
 *    is on the cron's list", never "this one has a price".
 * 3. **Cold.** Everything else — the other eighty-seven days. Reachable,
 *    priced honestly before the fact, and never fetched without being asked.
 *
 * Nothing here touches SearchAPI, and nothing here writes. It is KV reads and
 * two static tables, which is what makes it safe to call on every render of a
 * calendar covering ninety days.
 */

import "server-only";

import {
  FARE_WINDOW_END,
  FARE_WINDOW_START,
  routeFor,
  type RouteGridEntry,
} from "@/lib/flights/grid";
import { readFareCoverage, type FareCoverageEntry } from "@/lib/flights/history";
import { FARE_SNAPSHOTS } from "@/lib/flights/snapshots";
import type { KvClient } from "@/lib/store/kv";

/**
 * How many routes one coverage request may ask about.
 *
 * The outbound search has fourteen airport pairs and the return has ten, so
 * this is the whole page with headroom. It is a bound on KV reads per request,
 * not a policy: the cost of the endpoint has to stay legible.
 */
export const MAX_COVERAGE_ROUTES = 24;

export type CoverageSource = "history" | "warm" | "cold";

/** What one route knows about the window. */
export interface RouteCoverage {
  /** `"BCN-PER"` — the same key the request used. */
  route: string;
  from: string;
  to: string;
  /** Days this route holds an observation for, newest price each. */
  dates: Record<string, FareCoverageEntry>;
  /** Days the cron warms on this route. */
  warmed: readonly string[];
  /**
   * The research estimate for the pair, per person. Not a quote and not tied to
   * a date — it is what a cold day falls back to, and saying so is the point.
   */
  snapshotEur: number | null;
}

/** What the whole request knows about one day. */
export interface CoverageDay {
  date: string;
  source: CoverageSource;
  /** Cheapest stored fare across the requested routes, per person. */
  cheapestEur: number | null;
  /** How many of the requested routes hold an observation for this day. */
  routes: number;
}

export interface CoverageReport {
  window: { start: string; end: string };
  routes: RouteCoverage[];
  /**
   * Every day that is not cold, cheapest first by date. Cold days are omitted
   * rather than listed as nulls: ninety entries of nothing is ninety entries of
   * nothing, and absence is exactly what the caller needs to read as cold.
   */
  days: CoverageDay[];
}

/** `"BCN-PER"` → the grid entry, or null if that pair is not searchable. */
export function parseRouteKeys(value: string | null): RouteGridEntry[] {
  if (!value) return [];
  const seen = new Set<string>();
  const routes: RouteGridEntry[] = [];
  for (const token of value.split(",")) {
    const key = token.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const [from, to] = key.split("-");
    const route = routeFor(from, to);
    if (route) routes.push(route);
    if (routes.length >= MAX_COVERAGE_ROUTES) break;
  }
  return routes;
}

export async function readCoverage(
  kv: KvClient,
  routes: readonly RouteGridEntry[],
): Promise<CoverageReport> {
  const perRoute: RouteCoverage[] = [];
  const days = new Map<string, CoverageDay>();

  for (const route of routes) {
    const dates = await readFareCoverage(kv, route.from, route.to);
    perRoute.push({
      route: `${route.from}-${route.to}`,
      from: route.from,
      to: route.to,
      dates,
      warmed: route.dates,
      snapshotEur: FARE_SNAPSHOTS[`${route.from}-${route.to}`]?.priceEur ?? null,
    });

    for (const date of route.dates) {
      const existing = days.get(date);
      if (!existing) days.set(date, { date, source: "warm", cheapestEur: null, routes: 0 });
    }

    for (const [date, entry] of Object.entries(dates)) {
      const existing = days.get(date) ?? { date, source: "warm" as CoverageSource, cheapestEur: null, routes: 0 };
      days.set(date, {
        date,
        source: "history",
        cheapestEur:
          existing.cheapestEur === null
            ? entry.priceEur
            : Math.min(existing.cheapestEur, entry.priceEur),
        routes: existing.routes + 1,
      });
    }
  }

  return {
    window: { start: FARE_WINDOW_START, end: FARE_WINDOW_END },
    routes: perRoute,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
