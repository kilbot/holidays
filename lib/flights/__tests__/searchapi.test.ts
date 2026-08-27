import assert from "node:assert/strict";
import test from "node:test";

import { MONTHLY_CALL_BUDGET } from "@/lib/flights/quota";
import { fetchFare } from "@/lib/flights/searchapi";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import { setKvClient } from "@/lib/store/kv";

const originalFetch = globalThis.fetch;
const originalKey = process.env.SEARCHAPI_KEY;
const month = new Date().toISOString().slice(0, 7);

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.SEARCHAPI_KEY = originalKey;
  setKvClient(null);
});

test("a real fare call consumes quota and writes its result through to history", async () => {
  const kv = fakeKv();
  setKvClient(kv);
  process.env.SEARCHAPI_KEY = "test-key";
  globalThis.fetch = async () => Response.json({
    best_flights: [{
      price: 2_400,
      total_duration: 1_200,
      flights: [{ airline: "Test Air" }],
      layovers: [],
    }],
  });

  const fare = await fetchFare("BCN", "PER", "2026-12-14", {
    ttlSeconds: 604_800,
    minEur: 400,
    maxEur: 3_500,
  });

  assert.equal(fare?.priceEur, 1_200);
  assert.equal(await kv.getJson(`quota:${month}`), 1);
  const history = await kv.listRange<Record<string, unknown>>(
    "fares:hist:BCN-PER:2026-12-14",
    0,
    199,
  );
  assert.equal(history[0]?.priceEur, 1_200);
  assert.equal(history[0]?.source, "searchapi");
});

test("the monthly cutoff returns null without calling SearchAPI", async () => {
  const kv = fakeKv({ [`quota:${month}`]: MONTHLY_CALL_BUDGET });
  setKvClient(kv);
  process.env.SEARCHAPI_KEY = "test-key";
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };

  const fare = await fetchFare("BCN", "PER", "2026-12-14", {
    ttlSeconds: 604_800,
    minEur: 400,
    maxEur: 3_500,
  });

  assert.equal(fare, null);
  assert.equal(called, false);
});

test("the cheapest quote is never a Gulf routing", async () => {
  const kv = fakeKv();
  setKvClient(kv);
  process.env.SEARCHAPI_KEY = "test-key";
  globalThis.fetch = async () => Response.json({
    // What Google Flights actually returns for a Europe–Perth December date:
    // the cheapest itinerary is a Gulf one. It is the number the page would
    // print as the live fare and the Leg popups would name a carrier from.
    best_flights: [{
      price: 1_600,
      total_duration: 1_400,
      flights: [
        { airline: "Qatar Airways", departure_airport: { id: "BCN" }, arrival_airport: { id: "DOH" } },
        { airline: "Qatar Airways", departure_airport: { id: "DOH" }, arrival_airport: { id: "PER" } },
      ],
      layovers: [{ id: "DOH" }],
    }],
    other_flights: [{
      price: 2_400,
      total_duration: 1_500,
      flights: [
        { airline: "Singapore Airlines", departure_airport: { id: "BCN" }, arrival_airport: { id: "SIN" } },
        { airline: "Singapore Airlines", departure_airport: { id: "SIN" }, arrival_airport: { id: "PER" } },
      ],
      layovers: [{ id: "SIN" }],
    }],
  });

  const fare = await fetchFare("BCN", "PER", "2026-12-16", {
    ttlSeconds: 604_800,
    minEur: 400,
    maxEur: 3_500,
  });

  assert.equal(fare?.carrier, "Singapore Airlines");
  assert.equal(fare?.priceEur, 1_200);
  // And the Gulf price is not written through to history either, so a stored
  // fallback cannot resurrect it later.
  const history = await kv.listRange<Record<string, unknown>>(
    "fares:hist:BCN-PER:2026-12-16",
    0,
    199,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0]?.carrier, "Singapore Airlines");
});

test("a search with nothing but Gulf routings keeps the research band", async () => {
  const kv = fakeKv();
  setKvClient(kv);
  process.env.SEARCHAPI_KEY = "test-key";
  globalThis.fetch = async () => Response.json({
    best_flights: [{
      price: 1_600,
      total_duration: 1_400,
      flights: [
        { airline: "Emirates", departure_airport: { id: "BCN" }, arrival_airport: { id: "DXB" } },
        { airline: "Emirates", departure_airport: { id: "DXB" }, arrival_airport: { id: "PER" } },
      ],
      layovers: [{ id: "DXB" }],
    }],
  });

  const fare = await fetchFare("BCN", "PER", "2026-12-12", {
    ttlSeconds: 604_800,
    minEur: 400,
    maxEur: 3_500,
  });

  assert.equal(fare, null);
});
