import "server-only";

import { unstable_cache } from "next/cache";

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

function parseFlight(value: unknown): FareResult | null {
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
        .filter((flight): flight is FareResult => flight !== null)
        .sort((a, b) => a.priceEur - b.priceEur);
      const cheapest = candidates[0];
      if (!cheapest || cheapest.priceEur < minEur || cheapest.priceEur > maxEur) {
        throw new Error("Fare unavailable");
      }
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
