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
