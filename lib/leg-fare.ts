"use client";

/**
 * What a Leg popup shows for money.
 *
 * Two tiers, and the popup labels which one it is looking at, because they are
 * not the same claim:
 *
 * - **Priced** — the Leg's route and date are both in `lib/flights/grid.ts`,
 *   so `/api/fares` has an answer. That answer is itself either `live` (a
 *   SearchAPI quote fetched now, cached for the route's TTL) or `snapshot`
 *   (the stored research estimate, when the key is absent or the quote failed
 *   its sanity bounds). The popup says which, and when it was fetched.
 * - **Estimate** — every other Leg. The demo Plan's own figure from
 *   `DEMO_LEG_FARES_EUR`, labelled as an estimate and never dressed up as a
 *   fare.
 *
 * The four Legs that price are PER→SYD, SYD→CNS, OOL→HBA and HBA→MEL. The
 * Barcelona and Singapore crossings do not, because the grid prices the
 * BCN→PER long-haul as one journey and the route draws it as two.
 */

import { DEMO_LEG_FARES_EUR } from "@/lib/demo-plan";
import { ROUTE_GRID } from "@/lib/flights/grid";
import { LEG_FACTS } from "@/lib/demo-route";

/** How many travellers the fares are quoted for. Matches the API's `ADULTS`. */
const TRAVELLERS = 2;

export interface LegFare {
  /** Per couple, in EUR — the unit every other number on the site uses. */
  totalEur: number;
  source: "live" | "snapshot" | "estimate";
  carrier: string;
  /** ISO instant for a live fetch, ISO date for a snapshot, null otherwise. */
  fetchedAt: string | null;
  durationMin: number | null;
  stops: number | null;
}

interface FaresResponse {
  priceEur?: unknown;
  carrier?: unknown;
  source?: unknown;
  fetchedAt?: unknown;
  durationMin?: unknown;
  stops?: unknown;
}

/** Whether `/api/fares` can answer for this Leg at all. */
export function legIsPriced(legId: string): boolean {
  const facts = LEG_FACTS[legId];
  if (!facts) return false;
  const [from, to] = legId.split(">");
  return ROUTE_GRID.some(
    (entry) =>
      entry.from === from &&
      entry.to === to &&
      entry.dates.some((date) => date === facts.date),
  );
}

/** The demo Plan's own figure, which is also the fallback when a fetch fails. */
export function legEstimate(legId: string): LegFare {
  const facts = LEG_FACTS[legId];
  return {
    totalEur: DEMO_LEG_FARES_EUR[legId] ?? 0,
    source: "estimate",
    carrier: facts?.carrier ?? "Multiple carriers",
    fetchedAt: null,
    durationMin: facts?.durationMin ?? null,
    stops: null,
  };
}

const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Fetch a priced Leg. Rejects nothing — an unreachable API, a 503 from an
 * exhausted quota or a malformed body all land on the demo estimate, because a
 * popup that says "—" is worse than one that says "estimate".
 */
export async function fetchLegFare(
  legId: string,
  signal: AbortSignal,
): Promise<LegFare> {
  const facts = LEG_FACTS[legId];
  if (!facts) return legEstimate(legId);
  const [from, to] = legId.split(">");

  try {
    const response = await fetch(
      `/api/fares?from=${from}&to=${to}&date=${facts.date}`,
      { signal },
    );
    if (!response.ok) return legEstimate(legId);

    const body = (await response.json()) as FaresResponse;
    const perPerson = number(body.priceEur);
    if (perPerson === null) return legEstimate(legId);

    return {
      totalEur: Math.round(perPerson * TRAVELLERS),
      source: body.source === "live" ? "live" : "snapshot",
      carrier:
        typeof body.carrier === "string" ? body.carrier : facts.carrier,
      fetchedAt:
        typeof body.fetchedAt === "string" ? body.fetchedAt : null,
      durationMin: number(body.durationMin) ?? facts.durationMin,
      stops: number(body.stops),
    };
  } catch {
    return legEstimate(legId);
  }
}

/** "8h 15m", "3h", "50m". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** How a fare's provenance reads on the popup. */
export const FARE_SOURCE_LABEL: Record<LegFare["source"], string> = {
  live: "live fare",
  snapshot: "fare snapshot",
  estimate: "estimate",
};
