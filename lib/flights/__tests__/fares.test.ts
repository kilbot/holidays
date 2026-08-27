import assert from "node:assert/strict";
import test from "node:test";

import { getFare } from "@/lib/flights/fares";
import type { RouteGridEntry } from "@/lib/flights/grid";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import { setKvClient } from "@/lib/store/kv";

const route: RouteGridEntry = {
  from: "BCN",
  to: "PER",
  dates: ["2026-12-14"],
  ttlSeconds: 604_800,
  minEur: 400,
  maxEur: 3_500,
};

test.afterEach(() => setKvClient(null));

test("a stored-only fare read returns history and never reaches SearchAPI", async () => {
  const kv = fakeKv({
    "fares:hist:BCN-PER:2026-12-14": [
      { ts: "2026-08-27T12:00:00.000Z", priceEur: 1_300, carrier: "Test Air", source: "searchapi" },
      { ts: "2026-08-20T12:00:00.000Z", priceEur: 1_100, carrier: "Test Air", source: "searchapi" },
    ],
  });
  setKvClient(kv);
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };

  try {
    const fare = await getFare(route, "2026-12-14", { allowApi: false });
    assert.equal(called, false);
    assert.equal(fare?.source, "history");
    assert.equal(fare?.priceEur, 1_300);
    assert.equal(fare?.trend, "up");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
