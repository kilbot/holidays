import "server-only";

import type { RouteGridEntry } from "@/lib/flights/grid";
import { fareTrend, readFareHistory } from "@/lib/flights/history";
import { fetchFare } from "@/lib/flights/searchapi";
import { FARE_SNAPSHOTS } from "@/lib/flights/snapshots";
import { getKv } from "@/lib/store/kv";

async function storedFare(route: RouteGridEntry, date: string) {
  const history = await readFareHistory(getKv(), route.from, route.to, date);
  const latest = history[0];
  if (latest) {
    return {
      priceEur: latest.priceEur,
      carrier: latest.carrier,
      durationMin: null,
      stops: null,
      source: "history" as const,
      fetchedAt: latest.ts,
      trend: fareTrend(history),
    };
  }

  const snapshot = FARE_SNAPSHOTS[`${route.from}-${route.to}`];
  return snapshot ? { ...snapshot, source: "snapshot" as const, trend: null } : null;
}

export async function getFare(
  route: RouteGridEntry,
  date: string,
  {
    allowApi = true,
    asker,
  }: { allowApi?: boolean; asker?: Request } = {},
) {
  // `asker` is passed through for one purpose: charging a live call against the
  // asking IP's daily allowance. Absent for the warming cron, which has no
  // visitor behind it.
  const live = allowApi
    ? await fetchFare(route.from, route.to, date, route, asker)
    : null;
  if (live) {
    const history = await readFareHistory(getKv(), route.from, route.to, date);
    return {
      priceEur: live.priceEur,
      carrier: live.carrier,
      // Passed through for the globe's Leg popup: a live fare that cannot say
      // how long the flight is, or how many times it stops, is half an answer
      // on a trip whose long-hauls are chosen comfort-first.
      durationMin: live.durationMin,
      stops: live.stops,
      source: "live" as const,
      fetchedAt: new Date().toISOString(),
      trend: fareTrend(history),
    };
  }

  return storedFare(route, date);
}
