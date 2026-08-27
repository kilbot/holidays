import "server-only";

import { unstable_cache } from "next/cache";

import { MIDDLE_EAST_TRANSIT_HUBS } from "@/lib/flights/comfort";
import { appendFareHistory } from "@/lib/flights/history";
import { reserveFareCall } from "@/lib/flights/quota";
import { getKv } from "@/lib/store/kv";

const ADULTS = 2;

export interface FareResult {
  priceEur: number;
  carrier: string;
  durationMin: number;
  stops: number;
}

/** A parsed candidate, before the Middle East rule has thrown any of them out. */
interface FareCandidate extends FareResult {
  viaMiddleEast: boolean;
}

interface FareBounds {
  ttlSeconds: number;
  minEur: number;
  maxEur: number;
}

interface SearchApiFlight {
  price?: unknown;
  total_duration?: unknown;
  flights?: unknown;
  layovers?: unknown;
}

/** The airport codes a quoted itinerary touches, from whichever field has them. */
function airportsOf(flight: SearchApiFlight): string[] {
  const codes: string[] = [];
  for (const layover of Array.isArray(flight.layovers) ? flight.layovers : []) {
    const id = layover && typeof layover === "object" ? (layover as { id?: unknown }).id : null;
    if (typeof id === "string") codes.push(id);
  }
  for (const leg of Array.isArray(flight.flights) ? flight.flights : []) {
    if (!leg || typeof leg !== "object") continue;
    for (const key of ["departure_airport", "arrival_airport"] as const) {
      const airport = (leg as Record<string, unknown>)[key];
      const id = airport && typeof airport === "object" ? (airport as { id?: unknown }).id : null;
      if (typeof id === "string") codes.push(id);
    }
  }
  return codes;
}

function parseFlight(value: unknown): FareCandidate | null {
  if (!value || typeof value !== "object") return null;

  const flight = value as SearchApiFlight;
  if (typeof flight.price !== "number" || typeof flight.total_duration !== "number" || !Array.isArray(flight.flights)) {
    return null;
  }

  const carriers = flight.flights
    .map((leg) => (leg && typeof leg === "object" ? (leg as { airline?: unknown }).airline : null))
    .filter((airline): airline is string => typeof airline === "string");

  return {
    priceEur: flight.price / ADULTS,
    carrier: [...new Set(carriers)].join(" / ") || "Unknown carrier",
    durationMin: flight.total_duration,
    stops: Array.isArray(flight.layovers) ? flight.layovers.length : Math.max(0, flight.flights.length - 1),
    viaMiddleEast: airportsOf(flight).some((code) => MIDDLE_EAST_TRANSIT_HUBS.includes(code)),
  };
}

export async function fetchFare(
  from: string,
  to: string,
  date: string,
  { ttlSeconds, minEur, maxEur }: FareBounds,
): Promise<FareResult | null> {
  try {
    return await unstable_cache(async () => {
      const apiKey = process.env.SEARCHAPI_KEY;
      if (!apiKey) throw new Error("Fare API unavailable");
      const kv = getKv();
      if (!(await reserveFareCall(kv))) throw new Error("Fare quota exhausted");

      const params = new URLSearchParams({
        engine: "google_flights", flight_type: "one_way", departure_id: from,
        arrival_id: to, outbound_date: date, currency: "EUR", adults: String(ADULTS), api_key: apiKey,
      });
      const response = await fetch(`https://www.searchapi.io/api/v1/search?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Fare API unavailable");

      const data = (await response.json()) as { best_flights?: unknown; other_flights?: unknown };
      const candidates = [data.best_flights, data.other_flights]
        .flatMap((group) => (Array.isArray(group) ? group : []))
        .map(parseFlight)
        .filter((flight): flight is FareCandidate => flight !== null)
        // The cheapest quote on a Europe–Perth date is routinely a Gulf one,
        // and this number is the *default* the page and the Leg popups show —
        // the headline price, the carrier name, the stored history. A routing
        // the trip has excluded (docs/CONTEXT.md) must not be the thing that
        // sets it, so it is dropped before the sort rather than shown and
        // apologised for. If nothing else came back the route keeps its
        // research band, which is the honest answer anyway.
        .filter((flight) => !flight.viaMiddleEast)
        .sort((a, b) => a.priceEur - b.priceEur);
      const best = candidates[0];
      if (!best || best.priceEur < minEur || best.priceEur > maxEur) {
        throw new Error("Fare unavailable");
      }
      const cheapest: FareResult = {
        priceEur: best.priceEur,
        carrier: best.carrier,
        durationMin: best.durationMin,
        stops: best.stops,
      };
      await appendFareHistory(kv, from, to, date, {
        ts: new Date().toISOString(), priceEur: cheapest.priceEur,
        carrier: cheapest.carrier, source: "searchapi",
      });
      return cheapest;
    }, ["fare", from, to, date], { revalidate: ttlSeconds })();
  } catch {
    return null;
  }
}
