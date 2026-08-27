import "server-only";

import type { RouteGridEntry } from "@/lib/flights/grid";
import { fetchFare } from "@/lib/flights/searchapi";
import { FARE_SNAPSHOTS } from "@/lib/flights/snapshots";

export async function getFare(route: RouteGridEntry, date: string) {
  const live = await fetchFare(route.from, route.to, date, route);
  if (live) {
    return {
      priceEur: live.priceEur,
      carrier: live.carrier,
      source: "live" as const,
      fetchedAt: new Date().toISOString(),
    };
  }

  const snapshot = FARE_SNAPSHOTS[`${route.from}-${route.to}`];
  return snapshot ? { ...snapshot, source: "snapshot" as const } : null;
}
