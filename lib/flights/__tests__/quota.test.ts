import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_CALL_CAP,
  MONTHLY_CALL_BUDGET,
  readFareQuota,
  reserveFareCall,
} from "@/lib/flights/quota";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";

const NOW = new Date("2026-08-27T12:00:00.000Z");

test("a permitted real call increments its monthly and daily counters", async () => {
  const kv = fakeKv();

  assert.equal(await reserveFareCall(kv, NOW), true);
  assert.equal(await kv.getJson("quota:2026-08"), 1);
  assert.equal(await kv.getJson("quota:day:2026-08-27"), 1);
});

test("the monthly budget blocks a call without incrementing either counter", async () => {
  const kv = fakeKv({ "quota:2026-08": MONTHLY_CALL_BUDGET });

  assert.equal(await reserveFareCall(kv, NOW), false);
  assert.equal(await kv.getJson("quota:2026-08"), MONTHLY_CALL_BUDGET);
  assert.equal(await kv.getJson("quota:day:2026-08-27"), null);
});

test("the daily soft cap blocks a call without consuming monthly budget", async () => {
  const kv = fakeKv({
    "quota:2026-08": 12,
    "quota:day:2026-08-27": DAILY_CALL_CAP,
  });

  assert.equal(await reserveFareCall(kv, NOW), false);
  assert.equal(await kv.getJson("quota:2026-08"), 12);
});

test("the quota read reports the current month and zero when unused", async () => {
  assert.deepEqual(await readFareQuota(fakeKv(), NOW), {
    used: 0,
    budget: 2_000,
    month: "2026-08",
  });
});
