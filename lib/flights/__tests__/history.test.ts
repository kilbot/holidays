import assert from "node:assert/strict";
import test from "node:test";

import {
  appendFareHistory,
  fareTrend,
  readFareHistory,
  type FareHistoryEntry,
} from "@/lib/flights/history";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";

const entry = (priceEur: number): FareHistoryEntry => ({
  ts: `2026-08-27T12:${String(priceEur).padStart(2, "0")}:00.000Z`,
  priceEur,
  carrier: "Test Air",
  source: "searchapi",
});

test("history writes newest first under the route and date key", async () => {
  const kv = fakeKv();
  await appendFareHistory(kv, "BCN", "PER", "2026-12-14", entry(100));
  await appendFareHistory(kv, "BCN", "PER", "2026-12-14", entry(120));

  assert.deepEqual(await readFareHistory(kv, "BCN", "PER", "2026-12-14"), [
    entry(120),
    entry(100),
  ]);
});

test("history retains only the latest 200 observations", async () => {
  const kv = fakeKv();
  for (let price = 1; price <= 205; price += 1) {
    await appendFareHistory(kv, "BCN", "PER", "2026-12-14", entry(price));
  }

  const history = await readFareHistory(kv, "BCN", "PER", "2026-12-14");
  assert.equal(history.length, 200);
  assert.equal(history[0].priceEur, 205);
  assert.equal(history.at(-1)?.priceEur, 6);
});

test("trend compares the latest fare with the median of its priors", () => {
  assert.equal(fareTrend([entry(130), entry(80), entry(100), entry(120)]), "up");
  assert.equal(fareTrend([entry(70), entry(80), entry(100), entry(120)]), "down");
  assert.equal(fareTrend([entry(100), entry(80), entry(120)]), "flat");
  assert.equal(fareTrend([entry(100)]), "flat");
});
